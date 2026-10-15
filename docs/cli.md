# ProductKit CLI 레퍼런스

> 처음이라면 [README](../README.md)부터 읽는다. 이 문서는 명령·옵션·종료 코드 레퍼런스다.

자연어 프롬프트로 입력한 아이디어를, 사람과의 대화를 통해 명료화·검토하고, 결정
근거가 추적되는 Product Definition으로 만드는 로컬 CLI와 Agent Skills.

**ProductKit은 LLM을 호출하지 않는다.** CLI는 파일·스키마·검증을 담당하고, 대화와
추론은 Claude Code나 Codex가 담당한다.

## 현재 상태

Change 01~09의 파일 기반 구조 CLI, artifact 계약, Decision Application,
readiness/승인 Gate, OpenSpec export가 구현되어 있다. CLI는 LLM을 호출하지 않으므로
의미 검토는 설치된 Agent Skill로 수행하고 별도 기록한다. 자동화된 파이프라인 테스트의
합성 발언은 실제 사용자 확인이나 제품 승인이 아니다.

## 요구 사항

- Node.js 20.19 이상 (개발은 24.0.2에서 확인)
- npm

## 설치와 빌드

저장소에서 직접:

```bash
git clone https://github.com/gilgim/productkit.git
cd productkit
npm install
npm run build
```

로컬 설치본으로 쓰려면:

```bash
npm pack                       # productkit-0.1.0-beta.1.tgz 생성
npm install -g ./productkit-0.1.0-beta.1.tgz
```

beta 태그를 설치하고 Claude Code/Codex Skill을 연결하는 방법은 [설치 가이드](installation.md)를 참고한다.

OpenSpec strict 검증은 배포 런타임에 포함되지 않습니다. `export openspec`을 사용하려면 ProductKit과 같은 Node 패키지 탐색 경로에서 OpenSpec CLI 1.14.0을 별도로 설치해야 합니다.

```bash
npm install --save-dev @fission-ai/openspec@1.14.0
```

ProductKit은 해당 CLI를 별도 Node 프로세스에서 최대 30초 동안 실행합니다. OpenSpec 1.14.0의 전이 의존성에는 현재 공개된 High 취약점이 있어, 신뢰할 수 없는 OpenSpec workspace의 Strict Validation은 upstream 수정 전까지 실행하지 마세요. ProductKit 배포 패키지에는 OpenSpec과 그 취약 의존성 트리가 포함되지 않습니다.

빌드 없이 저장소에서 바로 실행:

```bash
node dist/cli/bin.js --help
```

## 사용

```bash
productkit --help
productkit --version
productkit init [path]
productkit intake "<아이디어 프롬프트>"
productkit clarify
productkit atomize
productkit challenge
productkit propose add --input proposal.yaml
productkit decide record --input decision.yaml --rationale "<근거>" --scope "<적용 범위>"   # 사용자가 터미널에서 직접 답변을 입력
productkit decide status
productkit assumption add --input assumption.yaml
productkit define status
productkit define application plan --input application.yaml
productkit define application apply <APP-id>
productkit validate
productkit validate review --input semantic-review.yaml
productkit approve record --validation <VAL-id> --scope "<승인 범위>"   # 사용자가 터미널에서 직접 승인 문장을 입력
productkit approve status
productkit export openspec --change <change-id> --capability <capability-id>
```

`decide record`와 `approve record`는 `--user-statement`를 생략하면 **실행한 터미널에서** 사용자
발언을 직접 읽는다. 에이전트는 터미널이 없어 이 명령을 못 끝내고 "No terminal is attached"로
멈춘다 — 그게 의도다. 명령을 사용자에게 넘긴다. `product/config.yaml`의 `attestation: flag`일
때만 `--user-statement`를 받으며, 그 워크스페이스의 모든 검증 보고에 경고가 붙는다.

`validate`는 현재 snapshot과 구조를 재검증한다. 구조 검증 PASS는 의미적 정확성을
증명하지 않는다. 누락을 잡는 검사 네 가지가 있다 — `source.coverage`(intake된 Prompt
전부가 Clarification·NodeGroup까지 갔는가), `definition.node_coverage`(모든 Node가
Definition·제외 Decision·unresolved Finding 중 한 곳에 있는가), `definition.normative`
(요구사항·AC 항목이 하나라도 있는가), `semantic.*`(reviewed 영역마다 제품 artifact 증거가
있는가). 이 검사는 "빠짐"을 잡지, "틀림"을 잡지 않는다. 승인 명령은 사용자가 명시적으로 응답한 다음에만 실행해야 하며,
로컬 CLI는 발언자의 신원이나 기록의 진위를 인증하지 못한다. 입력이 바뀌면 기존 승인은
stale 처리된다.

OpenSpec export는 현재 Approval과 readiness를 다시 확인한 뒤 새 change에
`proposal.md`, `specs/<capability>/spec.md`, `product/exports/` manifest를 생성하고
OpenSpec 1.14 Strict Validation을 실행한다. 기존 change는 수정하지 않으며 `design.md`,
`tasks.md`를 생성하거나 구현을 시작하지 않는다.

### `productkit init [path]`

대상 앱에 `product/` workspace를 만든다.

| 옵션 | 설명 |
|---|---|
| `[path]` | 대상 디렉터리. 생략하면 현재 디렉터리 |
| `--name <name>` | `config.yaml`에 기록할 제품 이름. 생략하면 디렉터리 이름 |
| `--dry-run` | 무엇을 만들지만 출력하고 아무것도 쓰지 않음 |

```bash
cd ~/projects/workout-app
productkit init
```

생성 결과:

```text
workout-app/
└── product/
    ├── config.yaml        # schema_version, 단계 상태(모두 not_started)
    ├── constitution.md    # 이 workspace가 지키는 원칙
    ├── overview.md        # 사람이 읽는 요약
    ├── sources/           # Prompt 원문 보존
    ├── discovery/         # 발견한 사용자·문제·목적·흐름
    ├── nodes/             # 원자적 Node(NodeGroup)
    ├── findings/          # 허점·가정·모순
    ├── proposals/         # 대안과 trade-off
    ├── decisions/         # 사용자의 명시적 결정
    ├── journeys/          # 사용자 여정
    ├── policies/          # 제품 행동 규칙
    ├── assumptions/       # 가정의 검증 상태
    ├── reviews/           # Challenge coverage
    ├── applications/      # Decision 적용 저널과 검증 이력
    ├── validations/       # readiness 보고서
    ├── semantic-reviews/  # snapshot-bound 의미 검토 기록
    ├── approvals/         # 사용자 승인 이력
    └── exports/           # OpenSpec Export manifest
```

artifact 디렉터리에는 용도를 설명하는 `README.md`만 들어간다. 빈 예시 Decision이나
Journey는 만들지 않는다.

동작 규칙:

- 재실행해도 기존 파일을 덮어쓰지 않는다. 없는 파일만 만든다.
- 생성·건너뜀·충돌을 구분해 출력한다.
- 파일이 있어야 할 자리에 디렉터리가 있으면(또는 그 반대) 아무것도 쓰지 않고 충돌
  경로를 먼저 출력한다.
- 대상 앱의 `openspec/`, `AGENTS.md`, `CLAUDE.md`는 건드리지 않는다.
- 덮어쓰기 옵션은 제공하지 않는다. 템플릿을 다시 받으려면 해당 파일을 지우고 다시
  실행한다.

### `productkit intake <text>`

프롬프트 원문을 `product/sources/`에 수정 없이 보존한다. 같은 세션에서 다시
입력해도 기존 레코드를 지우지 않고 새 ID를 만든다(append-only).

| 옵션 | 설명 |
|---|---|
| `<text>` | 프롬프트 원문. 생략하면 `--file` 필요 |
| `--file <path>` | 텍스트 대신 파일에서 원문을 읽음 |

### `productkit clarify`

Prompt의 모든 span이 `decomposition`·`finding_candidates`·`steps.span_coverage` 중 한
곳에 있어야 완료다. 빠진 span은 `uncovered_spans`로 나열한다.

프롬프트가 6단계(정의·분해·구체화·관계검증·반례검증·해석확인)로 명료화됐는지
판정한다. 명료화 내용 자체는 CLI가 생성하지 않는다 — `skills/clarify/SKILL.md`
instruction을 따라 Agent가 작성한다. 사용자의 명시적 해석 확인이 없으면, 또는
확인 이후 내용이 바뀌었으면 완료로 판정하지 않는다.

| 옵션 | 설명 |
|---|---|
| `--prompt <id>` | 특정 Prompt를 지정(생략하면 가장 최근 Prompt) |

### `productkit atomize`

confirmed 상태인 Clarification을 단일 검증 대상·분해 가능성·의미 보존 세
기준으로 원자적 Node로 변환했는지 판정한다. Node 내용 자체는 CLI가 생성하지
않는다 — `skills/model/SKILL.md` instruction을 따라 Agent가 작성한다. 추가·
조건 변경·논리 연산자 변경·왜곡 위험 신호가 열려 있으면, 또는 소스
Clarification이 바뀌었으면 완료(`modeled`)로 판정하지 않는다.

| 옵션 | 설명 |
|---|---|
| `--clarification <id>` | 특정 Clarification을 지정(생략하면 가장 최근 것) |

### 종료 코드

| 코드 | 의미 |
|---|---|
| `0` | 정상 완료 또는 Gate 통과 |
| `1` | 검증 실패 또는 Gate 차단 (Change 07부터 사용) |
| `2` | 잘못된 명령, 입력, 파일 처리 오류 |

## 구현 범위

### 지금 동작하는 것

- `productkit --help`, `productkit --version`
- `productkit init [path]` — workspace 생성, 재실행 안전, 충돌 진단
- `productkit intake <text>` — Prompt 원문 보존(append-only), 해시·span 기록
- `productkit clarify` — Clarification 완료 여부 판정(해석 확인 해시를 매번
  다시 계산, 저장된 상태를 신뢰하지 않음)
- `productkit atomize` — Node/NodeGroup 완료 여부 판정(단일 검증 대상·분해
  가능성·의미 보존 세 기준, 위험 신호 게이트, 소스 변경 시 자동 무효화)
- `productkit graph` — 6종 관계, RelationCandidate 보존, 구조 검증, provenance trace, 영향 분석
- `productkit challenge` — Finding 및 검토 범위 기록, 완료 coverage 구조 검증
- `productkit propose` / `productkit decide` / `productkit assumption` — 대안, 명시적 사용자 결정, 가정 상태 기록
- `productkit migrate` — 기존 v0 설정을 백업 가능한 v1 Stage Schema로 명시적 변환
- `productkit define` — Definition/Policy 검증과 Decision Application의 계획·적용·복구·검증
- `productkit validate` / `productkit approve` — 최신 readiness 보고와 hash-bound 사용자 승인
- `productkit export openspec` — 승인된 Definition을 Strict Validation 후 신규 OpenSpec change로 내보냄
- `product/config.yaml`, Prompt, Clarification, Node/NodeGroup의 Zod schema
- `templates/`, `skills/` — Agent 검토 및 산출물 작성 흐름을 패키지에 포함
- `CONSTITUTION.md`와 `docs/` 전체 v0 설계

### 자동화가 보장하지 않는 것

실제 Claude Code Agent의 의미 평가 정확도와 실제 사용자의 확인·승인은 이 저장소의
구조 테스트로 증명되지 않는다. OpenSpec Strict Validation은 산출물 구조만 검증하며,
ProductKit의 semantic review나 구현 준비성을 대신하지 않는다.

## 문서

| 파일 | 내용 |
|---|---|
| `CONSTITUTION.md` | ProductKit이 지키는 11개 원칙 |
| `docs/architecture.md` | v0 전체 설계: 역할 분리, 저장 구조, Gate, 종료 코드 |
| `docs/artifact-contracts.md` | Prompt부터 Review까지 artifact 필드 계약 |
| `docs/roadmap.md` | Change 01~09의 범위와 상태 |

## 개발

```bash
npm run build       # tsc → dist/
npm run typecheck   # 타입 검사만
npm test            # vitest (패키징 테스트 포함)
```

ProductKit 자체의 개발은 OpenSpec(`@fission-ai/openspec` 1.14.0, schema
`spec-driven`)으로 관리한다.

```bash
npx openspec list
npx openspec validate bootstrap-product-discovery-workflow --strict
npx openspec validate prompt-intake-and-clarification --strict
npx openspec validate atomic-node-modeling --strict
```

## 라이선스

MIT
