const limit = 1_000_000;
const json = (data, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'no-store'}});

function validBoard(board) {
  if (!Array.isArray(board?.tasks) || !Array.isArray(board?.records)) return false;
  const fields = ['id','title','area','phase','priority','status','done','test','next','risk'];
  const ids = new Set(board.tasks.map(task => task?.id));
  return ids.size === board.tasks.length && board.tasks.every(task =>
    task && fields.every(key => typeof task[key] === 'string') &&
    ['설계','구현'].includes(task.phase) && ['P0','P1','P2'].includes(task.priority) &&
    ['대기','진행 중','검증 중','완료'].includes(task.status) &&
    Array.isArray(task.deps) && task.deps.every(id => ids.has(id) && id !== task.id)
  ) && board.records.every(record =>
    record && ['type','title','body'].every(key => typeof record[key] === 'string') &&
    (record.date === undefined || typeof record.date === 'string' && Number.isFinite(Date.parse(record.date)))
  );
}

async function boardApi(request, db) {
  if (!request.headers.get('oai-authenticated-user-id')) return json({error:'로그인이 필요합니다.'},401);
  if (request.method === 'GET') {
    const row = await db.prepare('SELECT revision, content FROM board_state WHERE id = 1').first();
    return json(row ? {revision:row.revision, board:JSON.parse(row.content)} : {revision:0, board:null});
  }
  if (request.method !== 'PUT') return json({error:'지원하지 않는 요청입니다.'},405);
  if (request.headers.get('Origin') !== new URL(request.url).origin ||
      request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') {
    return json({error:'보드 페이지에서 저장해 주세요.'},403);
  }
  if (Number(request.headers.get('Content-Length')) > limit) return json({error:'저장 용량을 초과했습니다.'},413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > limit) return json({error:'저장 용량을 초과했습니다.'},413);
  let input;
  try { input = JSON.parse(raw); } catch { return json({error:'저장 데이터 형식이 올바르지 않습니다.'},400); }
  if (!Number.isSafeInteger(input?.revision) || input.revision < 0 || !validBoard(input.board)) {
    return json({error:'보드 데이터 형식이 올바르지 않습니다.'},400);
  }
  const {revision,board} = input;
  const content = JSON.stringify(board);
  const result = revision === 0
    ? await db.prepare('INSERT INTO board_state (id, revision, content) VALUES (1, 1, ?) ON CONFLICT(id) DO NOTHING').bind(content).run()
    : await db.prepare('UPDATE board_state SET revision = revision + 1, content = ? WHERE id = 1 AND revision = ?').bind(content,revision).run();
  if (!result.meta.changes) return json({error:'다른 기기에서 보드가 변경됐습니다.'},409);
  return json({revision:revision + 1});
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/mcp' || path === '/agent-mcp') return handleMcp(request, env, path);
    if (path === '/api/board') return boardApi(request, env.DB);
    const asset = Object.hasOwn(assets,path) && assets[path];
    if (!asset) return new Response('Not found', {status:404});
    return new Response(asset.body, {headers:{'Content-Type':asset.type + '; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
  }
};
