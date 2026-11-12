const statuses = ['대기', '진행 중', '검증 중', '완료'];
const storageKey = 'tellus-dev-board-v1';
let data = {tasks:seed, records:initialRecords};
let revision = 0;
let ready = false;
let busy = false;
let editingId = null;
const $ = id => document.getElementById(id);
const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const find = id => data.tasks.find(task => task.id === id);
const compare = (a,b) => a.priority.localeCompare(b.priority);
const dateFormat = new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeZone:'Asia/Seoul'});

function notice(message = '') {
  $('sync-notice').textContent = message;
  $('sync-notice').hidden = !message;
}

async function sharedRequest(method, board) {
  return fetch('/api/board', {
    method,
    cache:'no-store',
    ...(board ? {headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,board})} : {})
  });
}

async function refresh(importLegacy = false) {
  if (busy || document.querySelector('dialog[open]')) return;
  busy = true;
  try {
    const response = await sharedRequest('GET');
    if (!response.ok) throw Error('read');
    let shared = await response.json();
    if (importLegacy && !shared.board) {
      let legacy;
      try { legacy = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}
      if (legacy) {
        const imported = await sharedRequest('PUT', legacy);
        if (imported.ok) {
          shared = {...await imported.json(), board:legacy};
          notice('이 브라우저에 있던 작업 현황을 공유 보드로 가져왔습니다.');
        } else if (imported.status === 409) {
          const latest = await sharedRequest('GET');
          if (!latest.ok) throw Error('read');
          shared = await latest.json();
          notice('다른 기기에서 먼저 저장한 공유 보드를 불러왔습니다. 이 브라우저의 기존 기록은 보존됩니다.');
        } else {
          throw Error('import');
        }
      }
    }
    revision = shared.revision;
    if (shared.board) data = shared.board;
    ready = true;
    $('new-task').disabled = false;
    $('new-record').disabled = false;
    $('sync-status').textContent = '공유 보드에 연결됨';
    render();
  } catch {
    $('sync-status').textContent = '공유 보드 연결 실패';
    notice('공유 보드를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');
  } finally {
    busy = false;
  }
}

async function save(board, dialog) {
  if (!ready || busy) return;
  busy = true;
  const submit = dialog.querySelector('button.primary');
  submit.disabled = true;
  let conflict = false;
  try {
    const response = await sharedRequest('PUT', board);
    if (response.status === 409) {
      conflict = true;
      dialog.close();
      notice('다른 기기에서 먼저 변경 사항을 저장했습니다. 최신 보드에서 과제나 기록을 다시 편집해 주세요.');
      return;
    }
    if (!response.ok) throw Error('write');
    revision = (await response.json()).revision;
    data = board;
    render();
    notice();
    dialog.close();
  } catch {
    dialog.querySelector('.error').textContent = '공유 보드에 저장하지 못했습니다. 다시 시도해 주세요.';
  } finally {
    busy = false;
    submit.disabled = false;
    if (conflict) await refresh();
  }
}

function pendingDeps(task, lookup = find, visited = new Set()) {
  return task.deps.flatMap(id => {
    if (visited.has(id)) return [];
    visited.add(id);
    const dependency = lookup(id);
    if (!dependency) return [];
    return [...(dependency.status === '완료' ? [] : [dependency]), ...pendingDeps(dependency, lookup, visited)];
  });
}

function monday(now) {
  const date = new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(now) + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date;
}

function recommend(tasks, week) {
  const open = tasks.filter(task => task.status !== '완료');
  const lookup = id => tasks.find(task => task.id === id);
  const ready = open.filter(task => pendingDeps(task, lookup).length === 0);
  const sorted = [...(ready.length ? ready : open)].sort(compare);
  const top = sorted.filter(task => task.priority === sorted[0]?.priority);
  const weeks = Math.floor(week.getTime() / 604800000);
  return top[weeks % top.length];
}

function renderRecommendation() {
  const week = monday(new Date());
  const task = recommend(data.tasks, week);
  const done = data.tasks.filter(item => item.status === '완료');
  const percent = Math.round(100 * done.length / Math.max(1, data.tasks.length));
  $('progress').innerHTML = '<h2>전체 진행률</h2><div class="metric">' + percent + '%</div><progress aria-label="완료율" value="' + percent + '" max="100"></progress><p>' + done.length + ' / ' + data.tasks.length + '개 과제 완료</p><p>설계 ' + done.filter(t => t.phase === '설계').length + '개 · 구현 ' + done.filter(t => t.phase === '구현').length + '개 완료</p>';
  const label = '<div class="rec-top"><span class="eyebrow">이번 주 추천 과제</span><span>' + dateFormat.format(week) + ' 시작 주</span></div>';
  if (!task) {
    $('recommend').innerHTML = label + '<h2>모든 과제가 완료되었습니다</h2>';
    return;
  }
  const remaining = pendingDeps(task);
  const unlocked = data.tasks.filter(item => item.status !== '완료' && item.deps.includes(task.id));
  $('recommend').innerHTML = label + '<h2>' + esc(task.title) + '</h2><p>' + esc(task.next) + '</p><div class="rec-details"><div><strong>남은 선행 과제</strong><p>' + (remaining.map(item => esc(item.title)).join(' · ') || '없음 · 바로 진행 가능') + '</p><strong>이 과제에 의존하는 작업</strong><p>' + (unlocked.map(item => esc(item.title)).join(' · ') || '없음') + '</p></div><div><strong>위험 요소</strong><p>' + esc(task.risk) + '</p></div></div><button data-task="' + esc(task.id) + '">과제 열기 →</button>';
}

function renderBoard() {
  const search = $('search').value.trim().toLowerCase();
  const phase = $('phase').value;
  const priority = $('priority').value;
  const tasks = data.tasks.filter(t => (!phase || t.phase === phase) && (!priority || t.priority === priority) && (t.title + ' ' + t.area + ' ' + t.next).toLowerCase().includes(search)).sort(compare);
  $('count').textContent = tasks.length;
  $('columns').innerHTML = statuses.map(status => {
    const group = tasks.filter(t => t.status === status);
    return '<section class="column"><div class="column-title"><i class="dot"></i>' + status + '<span>' + group.length + '</span></div>' + (group.map(task => {
      const remaining = pendingDeps(task).length;
      return '<button class="card" data-task="' + esc(task.id) + '"><span class="chips"><span class="chip ' + task.priority.toLowerCase() + '">' + task.priority + '</span><span class="chip">' + task.phase + '</span><span class="chip">' + esc(task.area) + '</span></span><h3>' + esc(task.title) + '</h3><p>' + esc(task.next) + '</p><small>' + (remaining ? '선행 과제 ' + remaining + '개 남음' : '선행 과제 없음') + '</small></button>';
    }).join('') || '<p class="empty">과제 없음</p>') + '</section>';
  }).join('');
}

function render() {
  renderRecommendation();
  renderBoard();
  $('records').innerHTML = data.records.map(record => '<article class="record"><div class="rec-top"><span class="chip">' + esc(record.type) + '</span><time>' + (record.date ? dateFormat.format(new Date(record.date)) : '초기 기획') + '</time></div><h3>' + esc(record.title) + '</h3><p>' + esc(record.body) + '</p></article>').join('');
}

function openTask(id) {
  if (!ready || busy) return;
  const task = find(id);
  editingId = task?.id ?? null;
  $('task-heading').textContent = task ? '과제 편집' : '과제 추가';
  $('task-form').reset();
  $('task-error').textContent = '';
  for (const input of $('task-form').querySelectorAll('[name]')) {
    if (task) input.value = task[input.name];
  }
  $('dependencies').innerHTML = data.tasks.filter(item => item.id !== editingId).map(item =>
    '<label><input type="checkbox" name="dependency" value="' + esc(item.id) + '"' + (task?.deps.includes(item.id) ? ' checked' : '') + '>' + esc(item.title) + ' · ' + esc(item.status) + '</label>'
  ).join('');
  $('task-dialog').showModal();
}

function record(type,title,body) {
  return {type,title,body,date:new Date().toISOString()};
}

function dependsOn(task, id, visited = new Set()) {
  if (!task || visited.has(task.id)) return false;
  visited.add(task.id);
  return task.deps.includes(id) || task.deps.some(dependency => dependsOn(find(dependency), id, visited));
}

const runes = {
  '불꽃': {mana:5, cost:0, opposite:'서리', description:'열 부여'},
  '서리': {mana:5, cost:0, opposite:'불꽃', description:'냉기 부여'},
  '증폭': {mana:3, cost:0, opposite:'감쇠', description:'효과 확대'},
  '감쇠': {mana:2, cost:0, opposite:'증폭', description:'효과 축소'},
  '고정': {mana:2, cost:1, opposite:'해방', description:'효과 유지'},
  '해방': {mana:2, cost:1, opposite:'고정', description:'효과 해제'}
};

function validateSpell(input) {
  const tokens = input.match(/[()]|[^\s()]+/g) ?? [];
  if (!tokens.length) throw Error('룬을 하나 이상 입력하세요.');
  if (tokens.length > 120) throw Error('한 주문에는 룬과 괄호를 합해 120개까지 입력할 수 있어요.');
  const stack = [[]];
  const used = new Set();
  let mana = 0;
  let sacrifice = 0;
  for (const token of tokens) {
    const group = stack.at(-1);
    if (token === '(') {
      if (stack.length === 5) throw Error('중첩은 네 단계까지 허용됩니다.');
      const nested = [];
      group.push(nested);
      stack.push(nested);
    } else if (token === ')') {
      if (stack.length === 1 || !group.length) throw Error('닫는 괄호에 대응하는 내용이 있는 중첩이 필요합니다.');
      stack.pop();
    } else {
      if (!Object.hasOwn(runes, token)) throw Error('알 수 없는 룬 · ' + token);
      const rune = runes[token];
      if (used.has(rune.opposite)) throw Error('상충 룬 · ' + rune.opposite + ' ↔ ' + token + '. 중첩 위치와 관계없이 한 주문에 함께 쓸 수 없습니다.');
      used.add(token);
      group.push(token);
      mana += rune.mana * stack.length;
      sacrifice += rune.cost;
    }
  }
  if (stack.length !== 1) throw Error('닫히지 않은 괄호가 있습니다.');
  return {order:stack[0],mana,sacrifice};
}

function showSpell() {
  try {
    const result = validateSpell($('spell').value);
    $('spell-result').className = 'success';
    $('spell-result').textContent = '유효한 배열 · ' + JSON.stringify(result.order);
    $('mana').textContent = result.mana + ' MP';
    $('sacrifice').textContent = result.sacrifice ? '공물 ' + result.sacrifice + '개' : '없음';
  } catch (error) {
    $('spell-result').className = 'error';
    $('spell-result').textContent = error.message;
    $('mana').textContent = '—';
    $('sacrifice').textContent = '—';
  }
}

$('runes').innerHTML = Object.entries(runes).map(([name,rune]) => '<button class="rune" data-rune="' + name + '"><strong>' + name + ' <small>' + rune.description + '</small></strong><small>' + rune.mana + ' MP · 상충 ' + rune.opposite + '</small></button>').join('');
function resetSpellResult() {
  $('spell-result').textContent = '';
  $('mana').textContent = '—';
  $('sacrifice').textContent = '—';
}
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const {view,task,rune} = button.dataset;
  if (view) {
    document.querySelectorAll('nav [data-view]').forEach(item => {
      const active = item === button;
      $(item.dataset.view).hidden = !active;
      if (active) item.setAttribute('aria-current','page');
      else item.removeAttribute('aria-current');
    });
    if (view === 'board') renderRecommendation();
  }
  if (task) openTask(task);
  if (rune) {
    $('spell').value += ($('spell').value && !/\s$/.test($('spell').value) ? ' ' : '') + rune;
    showSpell();
    $('spell').focus();
  }
  if ('close' in button.dataset) button.closest('dialog').close();
});

$('task-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const fields = Object.fromEntries([...form].filter(([key]) => key !== 'dependency').map(([key,value]) => [key,value.trim()]));
  const deps = form.getAll('dependency');
  if (Object.values(fields).some(value => !value)) {
    $('task-error').textContent = '모든 과제 항목을 입력하세요.';
    return;
  }
  if (editingId && deps.some(id => id === editingId || dependsOn(find(id), editingId))) {
    $('task-error').textContent = '선행 과제에 순환 의존성이 생깁니다.';
    return;
  }
  const previous = find(editingId);
  const updated = {...fields,deps,id:editingId ?? crypto.randomUUID()};
  const board = {...data};
  let entry;
  if (previous) {
    const names = {title:'이름',area:'영역',phase:'단계',priority:'우선순위',status:'상태',done:'완료 기준',test:'테스트 시나리오',next:'다음 작업',risk:'위험 요소',deps:'선행 과제'};
    const changed = Object.keys(names).filter(key => JSON.stringify(previous[key]) !== JSON.stringify(updated[key]));
    const describe = (item,key) => key === 'deps' ? item.deps.map(id => find(id)?.title ?? id).join(', ') || '없음' : item[key];
    if (changed.length) entry = record('변경 이력',updated.title,changed.map(key => names[key] + ' · ' + describe(previous,key) + ' → ' + describe(updated,key)).join('\n'));
    board.tasks = data.tasks.map(item => item.id === updated.id ? updated : item);
  } else {
    board.tasks = [...data.tasks, updated];
    entry = record('변경 이력',updated.title,'과제 추가 · ' + updated.phase + ' / ' + updated.priority + ' / ' + updated.status);
  }
  if (entry) board.records = [entry, ...data.records];
  void save(board, $('task-dialog'));
});
$('record-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const title = form.get('title').trim();
  const body = form.get('body').trim();
  if (!title || !body) return;
  const entry = record(form.get('type'),title,body);
  void save({...data,records:[entry,...data.records]}, $('record-dialog'));
});
$('new-task').onclick = () => openTask();
$('new-record').onclick = () => {
  if (!ready || busy) return;
  $('record-form').reset();
  $('record-dialog').querySelector('.error').textContent = '';
  $('record-dialog').showModal();
};
for (const id of ['search','phase','priority']) $(id).addEventListener('input',renderBoard);
$('validate').onclick = showSpell;
$('spell').addEventListener('input',resetSpellResult);
$('clear-spell').onclick = () => {
  $('spell').value = '';
  resetSpellResult();
};
window.addEventListener('focus',() => { if (ready) void refresh(); });
setInterval(() => { if (ready && !document.hidden) void refresh(); },60000);
render();
void refresh(true);
