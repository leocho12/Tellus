# Tellus 개발 보드

[비공개 개발 보드](https://tellus-dev-board.equaljive2.chatgpt.site)에 같은 소유자 계정으로 로그인하면 여러 PC에서 과제와 변경 이력을 이어서 관리할 수 있습니다. Git에는 보드 코드가, Sites D1에는 보드에서 편집한 데이터가 저장됩니다.

## 기존 브라우저 데이터

공유 보드가 비어 있을 때, 이전 보드에 작업을 저장했던 브라우저에서 Site를 열면 기존 과제와 기록을 자동으로 가져옵니다. 기존 작업이 있다면 다른 PC에서 첫 변경 사항을 저장하기 전에 그 브라우저에서 한 번 열어 주세요.

## 코드와 배포

Node.js로 `node build.mjs`를 실행하면 `dist/server/index.js`가 생성됩니다. 화면은 `assets/`, 저장 API는 `worker/index.js`, D1 마이그레이션은 `drizzle/`에 있습니다.

GitHub에 올린 코드 변경을 서비스에 반영하려면 기존 Sites 프로젝트의 소스 저장소로 변경을 동기화하고 배포해야 합니다. 빌드 결과와 계정 인증 정보는 Git에 올릴 필요가 없습니다.

## Claude Code와 Codex에서 작업하기

Claude Code에서 Tellus 저장소를 열고 프로젝트의 `tellus-board` MCP 서버를 승인합니다. 이 PC의 Windows 사용자 자격 증명은 DPAPI로 암호화됩니다. 다른 PC에서는 Sites 소유자의 서비스 자격 증명을 해당 PC에 별도로 구성해야 합니다. 브리지는 환경 변수 `TELLUS_BOARD_ACCESS`도 읽을 수 있습니다. 자격 증명은 Git에 추가하지 마세요.

Codex에서는 이 Site의 개인 플러그인을 연결합니다. 두 도구에서 `read_board`로 현재 과제를 읽고, 작업 후 `update_task`로 상태와 변경 이력을 함께 저장하거나 `add_record`로 기술 결정을 추가할 수 있습니다. 작업을 시작하기 전에 최신 상태를 확인하고, 다른 에이전트가 같은 과제를 먼저 갱신했다면 다시 읽으세요.
