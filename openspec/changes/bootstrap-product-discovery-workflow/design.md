# Design

## Context

저장소는 비어 있고 Node.js 24가 설치되어 있다. 동기는 proposal.md - Why를 참고한다.
이 change가 고정해야 할 제약은 세 가지다.

- CLI는 LLM을 호출하지 않는다. 대화와 추론은 Claude Code / Codex가 맡는다.
- `init` 재실행이 사용자의 편집 내용을 덮어쓰면 안 된다(Constitution 10).
- 초기 상태를 READY/PASS로 표시하면 안 된다(Constitution 9).

이후 Change 02~08이 같은 CLI 위에 명령을 추가하므로, 종료 코드와 workspace 경로
구조는 지금 고정해야 나중에 깨지지 않는다.

## Goals / Non-Goals

**Goals:**

- `--help`, `--version`, `init`만 있는 작은 실행 표면
- 쓰기 전에 전체 계획을 세우고 충돌을 먼저 진단하는 init
- 패키징 후 저장소 밖에서도 템플릿을 찾아 동작하는 CLI
- 이후 Change가 재사용할 종료 코드와 scaffolding 유틸

**Non-Goals:**

- 전체 도메인 schema를 미리 정의하는 것 (`config.yaml`만 구현)
- 범용 migration 프레임워크 (`schema_version` 기록까지만)
- 템플릿 엔진 도입 (단순 placeholder 치환으로 충분)
- `--force` 류의 덮어쓰기 옵션 (Constitution 10과 충돌)

## Decisions

### D1. ESM + TypeScript, `tsc`로 빌드

대안은 번들러(tsup/esbuild)다. 의존성이 세 개뿐이고 Node 24가 ESM을 그대로 실행하므로
번들러를 넣을 이유가 없다. `tsc`가 만든 `dist/`를 그대로 실행한다. 빌드 설정이
적을수록 Change 02 이후 추가 비용이 작다.

### D2. 템플릿은 실제 파일로 두고 패키지에 포함한다

대안은 템플릿을 TypeScript 문자열 상수로 넣는 것이다. 문자열로 넣으면 패키징이
확실해지지만 Markdown 템플릿을 사람이 읽고 고치기 나빠진다. `templates/`를 실제
디렉터리로 두고 `package.json`의 `files`에 포함한다. 런타임에는
`new URL('../../templates/', import.meta.url)`로 찾는다. `src/workspace/`와
`dist/workspace/` 양쪽에서 패키지 루트의 `templates/`로 해석되므로 개발과 설치본에
같은 코드가 쓰인다. `npm pack` 결과에 템플릿이 들어 있는지 테스트로 확인한다.

### D3. init은 plan → conflict check → write 3단계로 나눈다

파일을 만들면서 동시에 검사하면 충돌을 만나는 시점에 이미 절반이 쓰여 있다. 먼저 전체
경로 계획(`FilePlanEntry[]`)을 만들고, 모든 경로의 현재 상태를 조사해 충돌을 모은 뒤,
충돌이 하나라도 있으면 아무것도 쓰지 않고 종료한다. 이 구조 덕분에 `--dry-run`은
세 번째 단계만 건너뛰면 된다.

### D4. 덮어쓰기 옵션을 제공하지 않는다

`--force`는 Constitution 10("조용히 덮어쓰지 않는다")과 직접 충돌한다. 사용자가
템플릿을 다시 받고 싶으면 해당 파일을 직접 지우고 `init`을 다시 실행한다. 이 동작을
`init` 출력에 안내한다.

### D5. artifact 디렉터리는 `README.md`로 유지한다

빈 디렉터리는 git이 추적하지 않는다. `.gitkeep`은 디렉터리의 용도를 설명하지 못한다.
각 디렉터리에 그 디렉터리가 담을 artifact와 ID 규칙을 설명하는 `README.md`를 둔다.
이 파일은 안내 문서이며 artifact로 집계되지 않는다. 예시 Decision이나 Journey는 만들지
않는다(Constitution 1, 10).

### D6. 템플릿 치환은 `{{key}}` 단순 문자열 치환

대안은 Handlebars 같은 템플릿 엔진이다. 치환 대상이 제품 이름과 생성일 두 개뿐이라
의존성을 추가할 가치가 없다. 알 수 없는 `{{key}}`가 남으면 렌더 시점에 오류를 낸다 —
조용히 빈 문자열로 치환하면 템플릿 오타가 생성 파일로 흘러간다.

### D7. 종료 코드는 전용 예외 타입으로 전달한다

`CliError(message, exitCode)`를 던지고 CLI 진입점에서 한 번만 잡아 메시지를 표준
오류로 출력한 뒤 `process.exitCode`를 설정한다. 명령 구현이 `process.exit()`를 직접
부르지 않으므로 테스트에서 함수 단위로 호출할 수 있다. Commander의 파싱 오류도
`exitOverride`로 가로채 코드 `2`로 통일한다. `--help`와 `--version`은 Commander가
같은 경로로 던지므로 코드 `0`으로 따로 처리한다.

## Risks / Trade-offs

- **템플릿 경로 해석이 패키징 환경에서 깨질 위험** → `npm pack` 결과를 임시
  디렉터리에 설치해 저장소 밖에서 `init`을 실행하는 테스트로 확인한다.
- **plan 작성과 템플릿 파일 목록이 어긋날 위험** → 계획을 템플릿 디렉터리 순회로
  생성하지 않고 명시적 목록으로 선언한다. 목록에 없는 템플릿 파일이 있으면 렌더에서
  파일 없음 오류가 난다. 테스트가 생성 경로 집합을 고정한다.
- **검사와 쓰기 사이의 TOCTOU** → 로컬 단일 사용자 CLI이므로 수용한다. 쓰기는
  `wx` 플래그를 써서, 검사 이후 생긴 파일을 덮어쓰지 않고 실패하게 한다.
- **종료 코드 `1`이 이 change에서는 쓰이지 않음** → 규약만 고정하고 실제 사용은
  Change 07의 Gate에서 시작한다. 지금 쓰이지 않는다고 규약을 늦추면 나중에 명령마다
  제각각이 된다.

## Migration Plan

신규 저장소라 마이그레이션 대상이 없다. 대상 앱 쪽에서는 `init`이 기존 파일을
건드리지 않으므로 롤백은 생성된 `product/` 디렉터리를 지우는 것으로 충분하다.
