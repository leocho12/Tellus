const boardUrl = 'https://tellus-dev-board.equaljive2.chatgpt.site';
const taskStatuses = ['대기', '진행 중', '검증 중', '완료'];
const schema = (properties, required = []) => ({type:'object', properties, required, additionalProperties:false});
const statusSchema = {type:'string', enum:taskStatuses};
const textSchema = {type:'string', minLength:1, maxLength:4000};
const tools = [
  {name:'read_board', description:'Open the Tellus board and read current tasks, dependencies, completion criteria, tests, and recent records. An optional task ID limits the result.', inputSchema:schema({task_id:textSchema}), annotations:{readOnlyHint:true}},
  {name:'update_task', description:'Change a task status and write an audit record together. Supply the task version from read_board. For a completed task, summarize what you verified in the change note.', inputSchema:schema({task_id:textSchema,expected_version:textSchema,status:statusSchema,note:textSchema,next:textSchema},['task_id','expected_version','status','note']), annotations:{readOnlyHint:false,destructiveHint:false}},
  {name:'add_record', description:'Append a technical decision or change record to the shared board.', inputSchema:schema({type:{enum:['기술 결정','변경 이력']},title:textSchema,body:textSchema},['type','title','body']), annotations:{readOnlyHint:false,destructiveHint:false}}
];

async function sharedBoard(db) {
  const row = await db.prepare('SELECT revision, content FROM board_state WHERE id = 1').first();
  return row ? {revision:row.revision,board:JSON.parse(row.content)} : {revision:0,board:{tasks:seed,records:initialRecords}};
}

async function updateBoard(db, change) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const {revision,board} = await sharedBoard(db);
    const {updated,result} = await change(board);
    const content = JSON.stringify(updated);
    if (new TextEncoder().encode(content).length > limit) throw Error('보드 저장 용량을 초과했습니다.');
    const write = revision
      ? await db.prepare('UPDATE board_state SET revision = revision + 1, content = ? WHERE id = 1 AND revision = ?').bind(content,revision).run()
      : await db.prepare('INSERT INTO board_state (id, revision, content) VALUES (1, 1, ?) ON CONFLICT(id) DO NOTHING').bind(content).run();
    if (write.meta.changes) return result;
  }
  throw Error('보드에 동시 변경이 계속 발생했습니다. 최신 상태를 읽고 다시 시도하세요.');
}

async function taskVersion(task) {
  const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(task)));
  return Array.from(new Uint8Array(hash),byte => byte.toString(16).padStart(2,'0')).join('');
}

function field(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4000) throw Error(label + ' 항목은 1~4000자여야 합니다.');
  return value.trim();
}

async function callTool(db, name, input, source) {
  const add = (board,type,title,body) => [
    {type,title,body:'[' + source + '] ' + body,date:new Date().toISOString()},
    ...board.records
  ];
  if (name === 'read_board') {
    const {revision,board} = await sharedBoard(db);
    const tasks = input.task_id === undefined ? board.tasks : board.tasks.filter(task => task.id === input.task_id);
    if (!tasks.length && input.task_id !== undefined) throw Error('해당 ID의 과제를 찾을 수 없습니다.');
    const versioned = await Promise.all(tasks.map(async task => ({...task,version:await taskVersion(task)})));
    return {url:boardUrl,revision,tasks:versioned,records:board.records.slice(0,20)};
  }
  if (name === 'update_task') {
    const id = field(input.task_id,'과제 ID');
    const note = field(input.note,'변경 내용');
    const next = input.next === undefined ? undefined : field(input.next,'다음 작업');
    if (!taskStatuses.includes(input.status)) throw Error('과제 상태가 올바르지 않습니다.');
    return updateBoard(db, async board => {
      const task = board.tasks.find(item => item.id === id);
      if (!task) throw Error('해당 ID의 과제를 찾을 수 없습니다.');
      if (await taskVersion(task) !== input.expected_version) throw Error('과제가 변경됐습니다. 최신 과제를 다시 읽어 주세요.');
      const updatedTask = {...task,status:input.status,next:next ?? task.next};
      const description = task.status + ' → ' + updatedTask.status + '\n' + note +
        (updatedTask.next === task.next ? '' : '\n다음 작업 · ' + task.next + ' → ' + updatedTask.next);
      const records = add(board,'변경 이력',task.title,description);
      const updated = {...board,tasks:board.tasks.map(item => item.id === id ? updatedTask : item),records};
      return {updated,result:{task:{...updatedTask,version:await taskVersion(updatedTask)},record:records[0]}};
    });
  }
  if (name === 'add_record') {
    const {type} = input;
    if (!['기술 결정','변경 이력'].includes(type)) throw Error('기록 유형이 올바르지 않습니다.');
    const title = field(input.title,'제목');
    const body = field(input.body,'내용');
    return updateBoard(db, board => {
      const records = add(board,type,title,body);
      return {updated:{...board,records},result:{record:records[0]}};
    });
  }
  throw Error('알 수 없는 도구입니다.');
}

function matchesSecret(actual, expected) {
  if (!expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

async function handleMcp(request, env, path) {
  const external = path === '/agent-mcp';
  if (external && !matchesSecret(request.headers.get('X-Tellus-Board-Key') ?? '',env.TELLUS_AGENT_KEY)) return json({error:'Unauthorized'},401);
  if (request.method !== 'POST') return json({error:'Method not allowed'},405);
  let message;
  try { message = await request.json(); } catch { return json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}},400); }
  const {id,method,params} = message ?? {};
  const reply = result => json({jsonrpc:'2.0',id:id ?? null,result});
  if (method === 'server/discover') return reply({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
  if (method === 'tools/list') return reply({tools});
  if (method !== 'tools/call') return json({jsonrpc:'2.0',id:id ?? null,error:{code:-32601,message:'Method not found'}});
  if (!external && !request.headers.get('oai-authenticated-user-id')) return json({error:'Unauthorized'},401);
  try {
    const result = await callTool(env.DB,params?.name,params?.arguments ?? {},external ? 'Claude Code' : 'Codex / Sites');
    return reply({content:[{type:'text',text:JSON.stringify(result)}]});
  } catch (error) {
    return reply({content:[{type:'text',text:error.message}],isError:true});
  }
}
