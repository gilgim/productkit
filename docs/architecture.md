# ProductKit v0 Architecture

## 1. 제품 목표

자연어 프롬프트로 입력한 아이디어를, 사람과의 대화를 통해 명료화하고 검토해, 결정
근거가 추적되는 Product Definition으로 만든다. 그 정의에서 OpenSpec change 초안을
생성한다.

입력은 자연어 프롬프트로 단일화한다. Obsidian Canvas는 지원하지 않는다. 이 방향
전환과 그 근거는 `openspec/changes/redesign-prompt-first-architecture`에 있다.

```text
Prompt 원문 보존
→ Clarification(정의·분해·구체화·관계검증·반례검증·해석확인)
→ Atomic Node Modeling
→ Graph & Impact Analysis
→ Challenge(허점·가정·모순 검토)
→ Proposal & Decision(대안과 사용자의 명시적 결정)
→ Product Definition & Policy
→ Validation & Approval Gate
→ OpenSpec Bridge
```

### 첫 성공 기준

1. 실제 운동 앱 아이디어를 자연어 프롬프트로 입력한다.
2. AI가 원문과 추론을 구분해 설명한다.
3. 사용자가 질문에 답하고 대안을 선택한다.
4. 현재 v0 범위의 미결정 항목이 0이 된다.
5. 결정과 원본을 추적할 수 있는 Product Definition이 나온다.
6. 검증을 통과한 정의에서 OpenSpec change 초안이 생성된다.

합성 fixture로 개발할 수 있지만, 이를 실제 운동 앱 검증 완료로 보고하지 않는다.

## 2. 범위

### 포함

- TypeScript + Node.js CLI
- Commander 기반 명령
- Zod 기반 artifact 검증
- Markdown + YAML frontmatter 로컬 파일
- 자연어 프롬프트 Clarification(정의·분해·구체화·관계검증·반례검증·해석확인 6단계)
- Claude Code와 Codex가 공유하는 Markdown instructions
- 사람이 결정하는 대화형 워크플로
- deterministic validation
- OpenSpec export

### 제외

웹 UI, 자체 LLM 호출 및 SDK, 에이전트 orchestration, multi-agent, DB 및 Vector DB,
계정·권한·협업 서버, 자동 시장조사, 자동 구현 및 배포, 기존 OpenSpec 전체를
동기화하는 범용 엔진.

## 3. 실행 계약: CLI와 AI의 역할 분리

**CLI는 LLM을 호출하지 않는다.** CLI는 파일·스키마·검증을 담당하고, Claude/Codex는
대화와 추론을 담당한다.

AI가 필요한 단계에서 CLI 명령은 네 가지만 한다.

1. 필요한 입력 artifact가 존재하는지 검사한다.
2. 해당 단계의 instruction과 입력 파일 경로를 제공한다.
3. 출력 위치 및 schema 계약을 안내한다.
4. 현재 상태를 `AI 작업 필요`로 표시한다.

```text
사용자: ProductKit으로 이 아이디어를 분석해줘.

Agent:
  productkit intake "아이디어 프롬프트" 실행
  productkit clarify 실행
  clarify instruction과 입력 읽기
  Clarification artifact 작성(6단계)
  재구성한 해석을 사용자에게 제시하고 동의를 받음(동의 없으면 미완료)
  불명확한 부분을 사용자에게 질문
```

터미널에서 `productkit clarify`만 실행한 경우 AI 분석이 완료됐다고 표시하지 않는다.

| 단계 | 주체 | 설명 |
|---|---|---|
| `init` | CLI | workspace 생성 |
| `intake` | CLI | Prompt 원문 보존, ID·해시·span 기록 |
| `clarify` | AI | 6단계 명료화, 해석 확인 |
| Atomic Node Modeling | AI+CLI | Node 생성, 품질 속성 판정(CLI는 구조 신호만) |
| Graph & Impact Analysis | AI+CLI | 관계 생성, 구조 검증, 영향 분석 |
| `challenge` | AI | Finding 생성 |
| `propose` | AI | 근거·영향·부작용·잔여 위험을 포함한 대안 기록; 추천은 선택이 아님 |
| `decide` | 사람 | 명시적 사용자 발언과 선택을 `pending_application`으로 기록; Change 06은 적용/해결하지 않음 |
| `define` | AI+CLI | Journey·정책·AC 구조화; CLI는 구조/출처/적용 hash 검증 |
| `validate` | CLI | machine checks + Gate + 최종 승인 해시 결합 |
| `export openspec` | CLI | 재검증 후 change 초안 생성 |

`product/config.yaml` schema v0는 기존 9개 Stage 키를 유지한다. v1은 이 키들을
보존하고 `atomic_modeling`과 `graph_analysis`를 추가한다(총 11개). `productkit migrate`
명령만 명시적으로 v0→v1 변환을 수행하며, 일반 CLI 명령은 자동 변환하지 않는다.
변환은 백업·journal·잠금·복구/rollback을 사용한다. v0 워크스페이스에서 Change
01~03 명령은 계속 사용할 수 있고, Graph 명령은 v1을 요구한다.

### Skill 계약

각 skill은 최소한 다음을 명시한다: 목적 / 입력 파일 / 출력 파일 / 필수 필드 /
금지 행동 / 사용자에게 질문해야 하는 조건 / 완료 조건 / 후속 검증 방법.

도구별로 다른 제품 규칙을 복제하지 않는다. `skills/<stage>/SKILL.md`에 공통
instruction을 두고, 도구별 파일은 그 문서를 가리키는 얇은 실행 안내만 담는다.

## 4. 저장 구조

### ProductKit 저장소

```text
productkit/
├── CONSTITUTION.md
├── README.md
├── docs/
│   ├── architecture.md
│   ├── artifact-contracts.md
│   └── roadmap.md
├── src/
│   ├── cli/          # Commander 명령 정의, commands/*.ts
│   ├── clarification/ # Prompt intake, provenance, Graph/impact, migration, 안전한 파일 쓰기
│   ├── schema/       # Zod schema(config/prompt/clarification/node/…)
│   └── workspace/    # init scaffolding, ARTIFACT_DIRS
├── skills/           # clarify / model / graph / challenge / propose / define / validate
├── templates/        # init이 복사하는 파일
├── tests/
└── openspec/         # ProductKit 자체 개발 관리
```

현재 `src/`의 최상위 디렉터리는 `cli`, `clarification`, `schema`, `workspace`다. Graph와 migration은 기존 디렉터리 경계 안에서 구현되어 새 최상위 프레임워크를 도입하지 않는다.

### 적용 대상 앱

입력은 자연어 프롬프트뿐이다 — Canvas 파일을 두지 않는다(1장 참고).

```text
my-app/
└── product/
    ├── config.yaml
    ├── constitution.md
    ├── overview.md
    ├── sources/      # Prompt 원문·hash·span (Change 02)
    ├── discovery/    # Clarification (Change 02)
    ├── nodes/        # Node/NodeGroup (Change 03)
    ├── graph/        # Graph, RelationCandidate, ImpactReport (Change 04)
    ├── findings/
    ├── proposals/
    ├── decisions/
    ├── definition.yaml  # current draft Product Definition
    ├── applications/  # Decision application journals and records
    ├── journeys/      # versioned Journey artifacts
    ├── policies/      # versioned structured Policy artifacts
    ├── assumptions/
    ├── reviews/       # ChallengeRun coverage
    ├── semantic-reviews/ # Change 08 snapshot-bound semantic review records
    ├── validations/   # Change 08 readiness reports
    ├── approvals/    # explicit user approvals bound to exact Definition hashes
    └── exports/      # Change 09 OpenSpec export manifests
```

신규 workspace는 `graph/`를 포함한 디렉터리를 생성한다. 기존 workspace는 init
재실행만으로 파일을 덮어쓰지 않으며, schema 변환은 별도 migrate 명령으로 한다.

### 구조 규칙

- Prompt 원문과 span 정보는 `sources/`에 둔다.
- 사람이 편집하는 artifact는 Markdown + YAML frontmatter를 기본으로 한다.
- 검증에 필요한 ID·상태·참조·구조화 필드는 frontmatter에 둔다.
- 본문에는 설명과 근거를 작성한다.
- 같은 필드를 JSON과 Markdown 양쪽에서 독립적으로 관리하지 않는다.
- `overview.md`는 사람이 읽는 요약이며 결정 기록을 대체하지 않는다.
- 초기 템플릿이나 예시는 실제 결정·Journey로 집계하지 않는다.
- ID는 파일명 변경이나 목록 재정렬로 바뀌지 않는다.
- `config.yaml`은 schema version을 기록한다. v0→v1 전환은 이 migration 한 건에
  한정된 명시적 명령으로 실행하며 범용 migration 프레임워크를 도입하지 않는다.

## 5. artifact 계약

전체 필드 정의는 `docs/artifact-contracts.md`에 있다. 요약하면 다음 체인이다.

```text
Prompt → Clarification → Node/NodeGroup → Graph Edge → Finding → Proposal → Decision
  → Definition → Review → Gate → Export
                                    ↘ Assumption ↗
```

- **Prompt**: 원본 프롬프트 텍스트 보존. hash와 span 보존(Change 02).
- **Clarification**: 정의·분해·구체화·관계검증·반례검증·해석확인 6단계 결과.
  사용자의 명시적 해석 확인 없이는 `confirmed`로 전이하지 않는다(Change 02).
- **Node/NodeGroup**: Clarification을 단일 검증 대상·분해 가능성·의미 보존 세
  기준으로 평가해 만든 원자적 단위. `fact`/`inference`/`requirement`/`policy`
  kind를 가진다(Change 03).
- **Graph Edge**: `depends_on`, `precedes`, `conflicts_with`, `duplicates`, `supersedes`, `exception_of` 6종만 지원한다. `proposed` Edge는 현재 Edge와 endpoint hash에 묶인 명시적 확인 기록이 있어야 확정된다. `contains`/`causes` 등은 RelationCandidate로 따로 보존하며 Edge로 승인되거나 영향 전파되지 않는다. 영향 보고서는 확정 영향, 잠재 영향, 검토 후보, 차단 입력을 경로 근거와 함께 구분한다. 구조 검증은 의미적 정확성이나 발언 진위를 증명하지 않는다.
- **Finding**: Challenge 의미 검토 후보. typed evidence와 반례, AI 근거/불확실성,
  `review_status`와 `resolution_status`를 분리하고 hash 결합 확인 및 append-only 이력을
  기록한다. 새 후보는 항상 proposed/unresolved다. Change 06은 Decision을 기록하지만
  Finding resolution을 변경하지 않는다. Change 07은 Decision 적용과 적용 결과 검증 기록을
  남기지만 Finding resolution은 변경하지 않는다. 최종 해결 판정과 제품 승인은 Change 08 Gate다.
- **Proposal/Decision**: Proposal은 다중 Finding 대안, 근거, trade-off, 입력 hash를
  기록한다. AI 추천과 사용자 선택은 별도다. Decision은 명시적 사용자 발언, 대상 Finding,
  범위와 현재 hash를 기록하며 `pending_application`에서 멈춘다. CLI는 구조/hash만
  검증하고 발언자 신원이나 의미적 해결을 증명하지 않는다.
- **Proposal**: 다중 Finding 대안과 trade-off, 입력 hash 및 비구속 AI 추천. 현재 상태는 `pending`; 사용자가 고른 항목은 별도 Decision으로 기록한다.
- **Decision**: 사용자의 명시적 선택. rationale과 confirmation 필수.
- **Assumption**: Finding에서 파생된 가정의 검증 상태 관리.
- **Definition/Policy**: `product/definition.yaml`은 근거 hash와 typed provenance가 있는
  draft projection이다. Journey/Policy는 별도 artifact다. 모든 규범적 항목은 current
  Decision→Prompt 경로를 가져야 한다. Decision 적용은 별도 Application journal에 기록한다.
  구조 검증은 의미적 충돌 부재나 최종 승인을 뜻하지 않는다.

## 6. Prompt Intake & Clarification 규칙 (Change 02)

자연어 프롬프트 하나를 입력받아 명료화하는 규칙이다. 세부 데이터 계약은
`docs/artifact-contracts.md`의 Prompt & Clarification 절과
`openspec/changes/prompt-intake-and-clarification/`에 있다.

- 프롬프트 원문은 수정 없이 그대로 보존한다. 고유 ID·hash·문자 span을 부여한다.
- 명료화는 정의·분해·구체화·관계검증·반례검증·해석확인 6단계를 모두 거친다. 한
  단계라도 기록이 없으면 완료로 표시하지 않는다.
- 해석확인 단계는 AI가 분해 결과를 논리적으로 재구성한 문장을 원문과 나란히
  제시하고, 사용자의 명시적 동의가 있어야 `confirmed` 상태로 전이한다. 동의 없이
  CLI나 AI가 스스로 완료를 선언할 수 없다.
- AI가 추측한 용어 정의나 해석은 사용자가 직접 말한 내용과 구분해 표시한다.
- 반례 검증에서 발견한 모호성·모순은 추측으로 메우지 않고 Finding 후보로 남긴다.
  정식 Finding으로의 승격은 Change 05(Challenge)의 범위다.
- Clarification의 관계검증 메모는 자동으로 Graph Edge가 되지 않는다. Agent는
  명시적으로 후보/Edge 입력을 만들고, CLI는 구조 검증과 확인 기록만 관리한다.
- CLI는 6단계의 내용을 추론하지 않는다(architecture.md 3장의 "CLI는 LLM을 호출하지
  않는다" 원칙 그대로). CLI는 입력 존재 확인, instruction과 경로 안내, 출력 계약
  안내, 완료 여부의 schema 기준 판정만 한다.

## 7. Challenge와 대화 규칙 (Change 05)

Challenge는 누락·예외, 충돌·중복, 정상/실패/경계 흐름, 조건·연산자 모순, Graph
관계 위험, Prompt-to-Node 의미 왜곡, 검증 불가능성, 영향 후보 누락을 검토한다. Agent는
반례 가설과 관찰 근거를 구분해 Finding 후보를 기록하며, 의미 판단과 대안 추천을 CLI에
위임하지 않는다. 대안과 최종 사용자 결정은 Change 06의 책임이다.

ChallengeRun은 명시적 범위, 8개 검토 영역, 입력 해시, 미검토 범위, Skill/rules 버전과
체크포인트를 보존한다. 모든 검토 영역이 기록된 경우 열린 Finding이 있어도 검토 커버리지는
완료될 수 있다. 이는 Finding 해결, 의미적 완전성, Product Definition 승인과 별도다.
입력이 달라지면 과거 검토는 stale이며 보존된 채 새 검토가 필요하다.

## 8. 검증 Gate (Change 08)

Definition은 초안을 작성할 수 있지만, Gate 통과 전에는 확정된 Source of Truth로
표시하지 않는다.

### Machine Check

| 항목 | 판정 |
|---|---|
| schema 오류, 중복 ID, 깨진 참조 | FAIL |
| 현재 범위의 unresolved Critical Finding | FAIL |
| 현재 범위의 미결정 Proposal | FAIL |
| Decision rationale 또는 사용자 확인 기록 누락 | FAIL |
| 정의에서 active Decision까지 근거 추적 불가 | FAIL |
| Journey의 진입·종료 상태 누락 | FAIL |
| 존재하지 않는 상태로 향하는 transition | FAIL |
| 도달 가능한 상태에서 종료 상태까지 경로가 없음 | FAIL |
| 핵심 Journey의 Acceptance Criteria 누락 | FAIL |
| critical assumption 미검증 또는 반증됨 | FAIL |
| noncritical assumption 미검증 | WARN |
| 현재 내용에 대한 AI Review 없음 또는 stale | FAIL |
| 필수 제품 정의 자체가 비어 있음 | FAIL |
| 요구사항·Acceptance Criteria 항목이 하나도 없음 | FAIL |
| intake된 Prompt 중 confirmed Clarification·modeled NodeGroup에 못 미친 것 | FAIL |
| Clarification이 Prompt span을 빠뜨림(분해·finding 후보·span_coverage 어디에도 없음) | FAIL (clarify 단계) |
| Definition·제외 Decision·unresolved Finding 어디에도 없는 Node | FAIL |
| exclusion 항목의 Decision이 없거나 current가 아니거나 내용이 다름 | FAIL |
| reviewed로 표시했는데 evidence_refs가 비었거나 skill 파일만 인용(semantic review·ChallengeRun) | FAIL |
| resolved/dismissed/deferred Finding을 가리키는 Decision이 그 Finding을 대상으로 하지 않음 | FAIL |

상태 그래프 검사는 종료 가능성을 확인할 뿐, 현실의 UX가 타당하다는 것을 증명하지
않는다.

### AI Review

UX 모순 / 이상한 사용자 흐름 / 빠진 상태 / 불필요한 복잡도 / 정책 간 충돌 /
Acceptance Criteria의 모호함을 검토한다. Review는 평가 대상 내용의 hash와 Finding
참조를 남긴다.

### 보고 형식

```text
PRODUCT READINESS

References          PASS
Critical Findings   PASS
Pending Decisions   FAIL — PROP-002
Journey Structure   PASS
Decision Evidence   PASS
Assumptions         WARN — ASM-003
AI Review           STALE

Definition          DRAFT
OpenSpec Export     BLOCKED
```

### 운영 규칙

- 하나라도 FAIL 또는 STALE이면 확정과 export를 막는다.
- WARN만 있으면 export할 수 있지만 경고를 함께 전달한다.
- export는 저장된 PASS 문구를 신뢰하지 않고 검증을 다시 수행한다.
- hash는 내용과 schema/검증 규칙 버전을 기준으로 계산한다. 수정 시각과 report
  자체는 입력에서 제외한다.
- v0에서는 세밀한 의존성 엔진 대신 관련 입력 전체의 hash를 사용해도 된다.

실제 구현은 `product/validations/`, `product/semantic-reviews/`, `product/approvals/`에
분리된 기록을 둔다. CLI의 readiness는 현재 스냅샷을 재계산하며 Challenge coverage,
Finding/Decision/Application, Journey, Policy, Assumption, Graph/Impact 및 Prompt lineage를
검사한다. 의미 검토는 별도 snapshot-bound 기록이고, 최종 승인은 사용자의 명시적 문장으로만
생성된다. 로컬 CLI는 발언자의 신원이나 진위를 인증하지 않는다.

## 9. CLI 종료 코드

모든 명령이 공유하는 규약이다. Change 01부터 적용한다.

```text
0: 정상 완료 또는 Gate 통과
1: 검증 실패 또는 Gate 차단
2: 잘못된 명령, 입력, 파일 처리 오류
```

## 10. OpenSpec Bridge (Change 09)

```bash
productkit export openspec --change define-workout-mvp
```

v0에서는 **새 capability의 초기 change 생성**만 지원한다. 기존 capability를 비교해
MODIFIED/REMOVED를 자동 산출하는 기능은 후속 범위다.

export는 다음을 수행한다.

1. 현재 Product Definition을 재검증한다.
2. unresolved 항목이 있으면 이유와 ID를 출력하고 중단한다.
3. 검증된 범위·Journey·규칙·Acceptance Criteria를 변환한다.
4. 원본 Definition ID와 결정 근거를 추적할 수 있게 남긴다.
5. 같은 이름의 change가 있으면 덮어쓰지 않고 실패한다.

생성 대상:

```text
openspec/changes/<change-name>/
├── proposal.md
└── specs/
    └── <capability>/
        └── spec.md
```

이것은 **제품 요구사항을 전달하는 OpenSpec 초안**이다. 실행 가능한 구현 계획이 모두
준비됐다고 표시하지 않는다. `design.md`와 `tasks.md`는 이후 OpenSpec 작업에서 실제
대상 코드베이스를 확인하고 작성한다. ProductKit이 데이터베이스·API·컴포넌트 설계를
지어내서 채우지 않는다.

## 11. ProductKit 자체 개발

ProductKit의 개발은 OpenSpec으로 관리한다. 설치된 OpenSpec 버전은
`@fission-ai/openspec` 1.14.0이고 schema는 `spec-driven`이다. 각 Change는
`openspec/changes/<name>/`에 proposal / specs / design / tasks를 작성하고
`npx openspec validate <name> --strict`로 검증한다.
