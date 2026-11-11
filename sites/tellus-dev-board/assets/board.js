const statuses = ['대기', '진행 중', '검증 중', '완료'];
const seed = [
  ['W1','세계 초기 상태와 행동 계약','세계','설계','P0',[],'국가·인물·지역·소지품 스키마와 명령 검증 규칙이 문서화된다.','중복 ID, 잘못된 소지품 보유자, 이동 권한 누락을 각각 검증한다.','초기 월드 스키마와 명령·이벤트 예시를 작성한다.','AI나 UI가 직접 상태를 수정하면 재현성이 깨질 수 있다.'],
  ['W2','초기 세계 로딩과 이벤트 기록','세계','구현','P0',['W1'],'플레이어 설정을 불러오고 승인된 행동만 상태에 반영하며 원인 이벤트를 기록한다.','같은 시드와 명령 기록을 두 번 재생해 최종 상태를 비교한다.','로더와 명령 검증기를 연결한다.','저장 형식 변경 시 기존 세계 호환성이 깨질 수 있다.'],
  ['A1','인물 판단과 지식 범위','인물','설계','P0',['W1'],'신념·가치·목표·기억·관계·능력치·소지품이 행동 후보에 어떻게 반영되는지 정의한다.','동일 상황에서 충성과 안전을 우선하는 인물이 다른 판단을 하고 비공개 정보에는 반응하지 않는지 검토한다.','이동·교섭·거부 행동의 평가 요소를 정의한다.','세계 상태를 그대로 노출하면 비밀 정보가 샐 수 있다.'],
  ['A2','자율 이동과 인물 간 상호작용','인물','구현','P0',['W2','A1','G2','T2'],'인물이 가능한 이동과 상호작용을 선택하고 엔진이 위치·권한·보유품을 검증한다.','경로가 차단되거나 요구 소지품을 잃은 인물이 대체 행동을 선택하는지 확인한다.','제한된 관측 데이터로 행동 후보를 평가한다.','동일 대상에 대한 행동이 한 틱에 충돌할 수 있다.'],
  ['N1','국가 통치체계와 입법 모델','국가','설계','P1',['W1'],'정체별 의사결정 권한, 국가 가치, 외교 관계, 법률 제정과 집행 절차를 정의한다.','같은 법안을 제국과 공화국에 제안해 승인 경로를 비교한다.','법률과 강제 세계 규칙의 범위를 결정안으로 기록한다.','법의 관할권과 우선순위가 모호하면 집행이 일관되지 않을 수 있다.'],
  ['N2','국가와 인물의 양방향 변화','국가','구현','P1',['A2','N1'],'인물의 행동이 국가 관계와 제도에 영향을 주며 새 법률과 외교 변화가 인물에게 전달된다.','조세법 제정 후 서로 다른 이해관계의 귀족이 준수, 협상, 위반 중 하나를 선택하는지 확인한다.','승인 절차와 공포 이벤트를 명령 처리기에 연결한다.','정보 전달과 시행 시점이 섞이면 인물이 법을 미리 알 수 있다.'],
  ['T1','시간 제어와 플레이어 개입 설계','시간','설계','P0',['W1'],'일시정지·단일 틱·배속과 관찰·직접 개입의 명령 처리 시점을 정의한다.','일시정지 중 개입을 예약하고 단일 틱에 정확히 한 번 적용되는지 검토한다.','틱 내부 처리 순서와 명령 큐의 계약을 작성한다.','배속에 따라 행동 순서가 달라질 수 있다.'],
  ['T2','틱 진행과 시간 조작 구현','시간','구현','P0',['T1','W2'],'정지·재개·단일 틱·배속이 동작하고 승인된 개입을 역사에 남긴다.','동일 명령을 1배속과 고배속에서 실행해 상태 해시와 이벤트 순서를 비교한다.','고정 틱과 명령 큐를 연결한다.','고배속에서 UI가 멈추거나 틱이 누락될 수 있다.'],
  ['G1','절차적 지형 생성 설계','지형','설계','P1',['W1'],'시드, 고도, 수계, 생물군계 및 국가 초기 배치의 제약을 정의한다.','섬·대륙·좁은 육교 시드에서 이동과 정착이 가능한지 검토한다.','지형 파라미터와 지역 연결 그래프를 정의한다.','접근 불가 지역에 시작 거점이 생길 수 있다.'],
  ['G2','시드 지형과 이동 그래프 구현','지형','구현','P1',['G1'],'동일 시드는 동일 지도와 경로 그래프를 생성하고 시작 위치의 접근성을 검사한다.','시드를 반복 실행하고 경계·수역·연결 끊김을 검증한다.','고도와 수계 생성 후 통행 가능 지역을 연결한다.','생성기 변경 시 저장된 시드의 재현성이 깨질 수 있다.'],
  ['M1','룬 배열·중첩 문법과 비용 설계','마법','설계','P1',['W1'],'순서, 중첩 범위, 상충표, 마력과 주술 대가의 계산식을 정의한다.','상충 룬을 다른 괄호에 배치해도 한 주문이면 거부되는지 확인한다.','룬 사전 초안과 상충 조합을 검토한다.','중첩 비용과 적용 범위가 모호하면 결과가 달라질 수 있다.'],
  ['M2','시전 검증기와 자원 처리','마법','구현','P1',['M1','W2'],'상충·잘못된 구문·자원 부족을 거부하며 유효한 주문만 비용을 한 번 차감한다.','상충 배열, 빈 중첩, 마력 부족, 주술 대가 부족을 검증하고 실패 시 상태가 그대로인지 확인한다.','구조화된 배열을 파싱하고 엔진의 시전 명령에 연결한다.','비용 차감과 효과 적용이 따로 실패하면 상태가 어긋날 수 있다.']
].map(([id,title,area,phase,priority,deps,done,test,next,risk]) => ({id,title,area,phase,priority,deps,done,test,next,risk,status:'대기'}));

const initialRecords = [
  {type:'기술 결정',title:'행동 제안과 상태 변경 권한',body:'설계안 · AI와 플레이어가 행동 의도를 제출하고, 엔진이 권한과 조건을 검증한 뒤 세계 상태와 사건 기록을 갱신한다.'},
  {type:'기술 결정',title:'기술 스택 후보',body:'검토 중 · Unity/C#과 UI에서 분리된 시뮬레이션 코어를 후보로 둔다. 재현성과 화면 없이 실행하는 테스트를 판단 기준으로 삼는다.'},
  {type:'기술 결정',title:'플레이 중 설정 추가와 입법',body:'설계안 · 플레이어는 법을 제정해 제약을 추가한다. 국가별 입법 절차와 창조자 권한의 적용 범위는 결정이 필요하다.'}
];
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
