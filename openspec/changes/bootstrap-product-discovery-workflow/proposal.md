# Proposal

## Why

ProductKit은 Obsidian Canvas의 아이디어를 사람과의 대화로 검토해 결정 근거가 추적되는
Product Definition으로 만드는 로컬 도구다. 아직 저장소에 실행 가능한 것이 없어서
Canvas ingest, discovery, 검증, OpenSpec export 같은 이후 작업이 올라설 바닥이 없다.
이 change는 그 바닥만 만든다. 워크플로 전체를 한 번에 구현하지 않는다.

## What Changes

- Commander 기반 `productkit` CLI 진입점을 추가한다. `--help`와 `--version`이 동작한다.
- 모든 명령이 공유하는 종료 코드 규약을 고정한다: `0` 정상/Gate 통과, `1` 검증 실패/Gate
  차단, `2` 잘못된 명령·입력·파일 처리 오류.
- `productkit init [path]`를 추가한다. 대상 앱에 `product/` workspace를 만든다.
  경로를 생략하면 현재 디렉터리를 쓴다.
- `init`은 재실행 시 기존 파일을 덮어쓰지 않고 없는 파일만 만든다. 생성·건너뜀·충돌을
  구분해 출력한다.
- `init`은 파일이 있어야 할 경로가 디렉터리인 경우(또는 그 반대) 아무것도 쓰지 않고
  충돌을 먼저 진단한다.
- `init`은 대상 앱의 `openspec/`, `AGENTS.md`, `CLAUDE.md`를 변경하지 않는다.
- `product/config.yaml`의 Zod schema를 추가한다. `schema_version: 0`, 단계 상태는
  `not_started`로 시작하고 READY/PASS를 표시하지 않는다.
- `templates/`에 init이 복사하는 파일을 두고, npm 패키징 결과에 포함한다.
- `CONSTITUTION.md`, `docs/architecture.md`, `docs/artifact-contracts.md`,
  `docs/roadmap.md`, `README.md`를 작성한다.

명시적으로 포함하지 않는 것: Canvas 파싱, discovery/challenge/propose/decide/define/
review 명령, skill 본문, 검증 Gate, OpenSpec export. 성공만 반환하는 placeholder
명령도 만들지 않는다.

## Capabilities

### New Capabilities

- `cli-foundation`: `productkit` 실행 파일의 진입점, 도움말과 버전 출력, 모든 명령이
  공유하는 종료 코드 규약, 미구현 명령을 구현된 것처럼 노출하지 않는 규칙.
- `product-workspace`: 대상 앱의 `product/` workspace 구조와 그 초기화 동작. 기존
  내용 보존, 구조 충돌 진단, 초기 상태 표기 규칙을 포함한다.

### Modified Capabilities

없음. 저장소의 첫 change다.

## Impact

- 새 Node.js 패키지: `commander`, `zod`, `yaml`. 개발 의존성 `typescript`, `vitest`,
  `@fission-ai/openspec`.
- 새 실행 파일 `productkit` (`bin` 엔트리).
- 대상 앱에 쓰는 경로는 `<target>/product/` 하위뿐이다.
- 이후 모든 Change는 여기서 정의한 종료 코드 규약과 workspace 구조를 전제로 한다.
