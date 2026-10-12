# ProductKit Roadmap

각 Change는 OpenSpec으로 관리한다. Change 01~04의 구조 구현과 자동 검증은
완료됐다. Change 04의 실제 Agent 의미 평가는 인증이 없어 UNKNOWN이다.

이 로드맵은 `openspec/changes/redesign-prompt-first-architecture`의 결정에 따라
입력을 자연어 프롬프트로 단일화한 구조다. 원래 Change 02였던 "Canvas Ingest"는
폐기됐고, Change 03~09는 새 9단계 파이프라인(Prompt Input → Clarification → Atomic
Node Modeling → Graph & Impact Analysis → Challenge → Proposal & Decision → Product
Definition & Policy → Validation & Approval Gate → OpenSpec Bridge)에 맞춰 범위를
다시 정의하고 번호를 09까지 늘렸다. 구현되지 않은 명령을 README나 CLI에서 완료된
기능처럼 노출하지 않는다.

| Change | 이름 | 범위 | 완료 조건 | 상태 |
|---|---|---|---|---|
| 01 | `bootstrap-product-discovery-workflow` | CLI, init, Constitution, templates | 안전한 초기화와 help | 구현됨 |
| 02 | `prompt-intake-and-clarification` | Prompt 원문 보존, 6단계 명료화, 해석 확인, Finding 후보 | 사용자 명시 확인 없이는 명료화가 완료로 전이되지 않음 | 구현됨 |
| 03 | `atomic-node-modeling` | Node 스키마, 단일 검증 대상·분해 가능성·의미 보존 3기준 원자성 판정, 위험 신호 게이트 | span 커버리지 100%, 원자성 판정 기록, 위험 신호 없을 때만 modeled | 구현됨 |
| 04 | `graph-and-impact-analysis` | 6종 typed Graph, RelationCandidate, 변경 영향 분석, v0→v1 Stage migration | 구조 검증, 확정/잠재 영향 분리, 추적성, 복구 가능 migration | 구현 완료; Agent 의미 평가 UNKNOWN |
| 05 | `requirement-challenge` | Finding 모델, bounded ChallengeRun, CLI와 Agent Skill | 검토 커버리지와 Finding 확인/해결 상태 분리 | 구현 완료 (구조 검증; 실제 Agent 의미 평가 별도) |
| 06 | `proposal-and-decision` | 다중 Finding Proposal, 근거/trade-off, 명시적 사용자 Decision, hash/참조 검증 | 추천과 사용자 선택 분리; Decision은 `pending_application`, Finding resolution 변경 금지 | 구조 구현 완료; Claude Agent 의미 평가 UNKNOWN (로그인 없음) |
| 07 | `product-definition-and-policy` | Decision Application journal, Product Definition, Journey·Policy·AC, bounded consistency analysis | 적용 전후 hash/impact 검증, 추적성, Finding resolution과 분리 | 구현 완료; 구조 검증 통과 |
| 08 | `validation-and-approval-gate` | current-snapshot readiness report, semantic review record, 사용자 승인 hash binding | 구조 PASS와 의미 평가 분리, 입력 변경 시 승인 stale | 구현 완료; 구조 검증 통과; 실제 사용자 승인 미실행 |
| 09 | `openspec-bridge` | 승인된 Definition을 초기 OpenSpec change로 export | strict validation 및 no-overwrite 추적성 | 구현 완료; synthetic CLI E2E 통과 |

이전 번호 체계(Canvas Ingest=02, Discovery=03, Challenge=04, Propose&Decide=05,
Definition=06, Validation=07, OpenSpec Bridge=08)를 기억하는 자료가 있다면 이
표로 대체한다.

---

## Change 01 — Bootstrap (구현됨)

제공:

- `productkit --help`, `productkit --version`
- `productkit init [path]` — `product/` workspace 생성, 재실행 시 기존 파일 보존
- `CONSTITUTION.md`, `docs/`, `templates/`, Zod 기반 `config.yaml` schema
- 공통 종료 코드 규약(0 / 1 / 2)

제공하지 않음: Prompt 처리, Clarification 이후 모든 단계, skill 본문, 검증 Gate,
export.

## Change 02 — Prompt Intake & Clarification (구현됨)

- `productkit intake <text>` / `--file <path>` — 프롬프트 원문을 `product/sources/`에
  보존, 고유 ID·content hash·문자 span 기록
- `skills/clarify/SKILL.md` — 정의·분해·구체화·관계검증·반례검증·해석확인 6단계
  공통 instruction
- `productkit clarify` — 입력 존재 확인, instruction과 경로 안내, 완료 여부는
  schema 기준으로 CLI가 판정(AI 스스로 선언 불가)
- 해석확인에 대한 사용자 명시적 동의 없이는 `status: confirmed`로 전이하지 않음
- AI 추론과 사용자 발언을 필드로 구분, 반례 검증의 모호성은 추측 대신 Finding
  후보로 보관
- fixture: `tests/fixtures/`에 합성 프롬프트 시나리오

완료 조건: 6단계가 모두 기록되고, 사용자의 명시적 해석 확인 없이는 명료화가 완료로
표시되지 않는다. 상세 계약은 `openspec/changes/prompt-intake-and-clarification/`.

## Change 03 — Atomic Node Modeling (구현됨)

- `productkit model` — confirmed Clarification을 입력받아 Node/NodeGroup
  완료 여부를 판정(CLI는 Node 내용을 생성하지 않는다)
- Node 스키마(`fact`/`inference`/`requirement`/`policy`), `derived_from` 추적
  (Clarification까지만, Prompt는 체인으로 조회)
- 원자성은 단일 검증 대상·분해 가능성·의미 보존 세 기준을 함께 평가
  (`evaluateAtomicityFinal`로 CLI가 결정적으로 조합, AI 판단 자체는 대신하지
  않음). 복합 조건 정책은 분해하지 않고, 독립적 여러 행동은 공유 트리거를
  보존하며 분해
- 누락(커버리지)·추가(어휘 신호)·조건 변경·논리 연산자 변경·왜곡을 구분
- `addition`/`condition_change`/`operator_change`/`distortion` 위험 신호가
  `open`이면 `modeled` 전이를 막음(해소는 Change 05~06 범위)
- 소스 Clarification 변경 시 자동 무효화(Change 02와 동일 해시 패턴 재사용)
- `product/nodes/` 디렉터리 신설(`product-workspace` 확장, 기존 9개 디렉터리
  불변)

완료 조건: span 커버리지 100%, 모든 Node의 원자성 판정 기록, 열린 위험 신호
0건, 소스 해시 일치 — 넷 다 만족해야 `modeled`.

## Change 04 — Graph & Impact Analysis (구조 구현 완료)

- v0 Graph 관계 6종(`depends_on`/`precedes`/`conflicts_with`/`duplicates`/
  `supersedes`/`exception_of`). `contains`와 `causes`는 보류하며 임의 변환하지 않는다.
- 미지원 관계 가설은 파일 기반 `RelationCandidate`로 보존하며 Edge와 분리한다.
- 모든 edge는 `proposed` → `confirmed` 또는 `rejected`로 전이하되, 명시적 확인
  레코드 없이는 자동 승격하지 않음(원문 근거나 Challenge 무이의만으로 승격 금지).
  `rejected`는 삭제되지 않고 분석에서만 제외됨(AI의 잘못된 추론 격리)
- 방향과 전파 규칙을 관계별로 적용하고 confirmed 영향, potential 영향, 검토 후보를
  경로 근거와 함께 분리한다. 미지원 Candidate는 영향으로 전파하지 않고 blocked input으로
  명시한다.
- 명시적 `productkit migrate`만 기존 v0의 9 Stage 키를 보존하면서 v1의
  `atomic_modeling`/`graph_analysis`를 추가한다.

구조 PASS는 관계의 의미적 정확성이나 확인 발언의 진위를 뜻하지 않는다. 구현/구조
테스트와 실제 Agent 의미 평가를 별도로 보고한다.

## Change 05 — Requirement Challenge

- `skills/challenge/SKILL.md`, `productkit challenge` review checkpoint/validate 명령
- Typed Finding evidence, AI rationale/uncertainty, counterexample, append-only history
- `review_status`와 `resolution_status` 분리; Change 05는 Finding을 해결하지 않음
- 8개 검토 영역과 input hash를 갖는 ChallengeRun; 입력 변경 시 stale 처리

완료 조건: 구조·회귀 검증과 review coverage 기록이 통과한다. 실제 Agent 의미 검출 정확도는
별도 평가이며 구조 검증 PASS로 대체하지 않는다. Finding 검토는 Change 05, Decision은 Change 06,
적용/적용 검증 기록은 Change 07, 최종 Finding 해결 판정과 제품 승인은 Change 08 책임이다.

## Change 06 — Proposal & Decision

- `skills/propose/SKILL.md`
- Proposal schema(options / benefits / costs / risks / assumptions)
- `productkit propose add` / `productkit decide record` — 대안과 사용자 발언을 보존하는 Decision 기록
- Decision에 `decision_type`(`scope_exclusion` / `content_decision`) 추가 —
  critical Finding이 범위결정 없이 deferred/dismissed로 Gate를 우회하지 못하게 함
- Change 06은 적용이나 Finding 해결 상태를 기록하지 않는다. Change 07이 Decision을 실제 정의에 반영하고, 후속 Gate가 의미 검증과 해결/승인을 담당한다.
- CLI는 데이터 구조와 hash만 확인하며 실제 발언자 신원이나 의미적 해결을 증명하지 않는다.

완료 조건: 추천이 자동으로 Decision이 되지 않고, critical Finding은
`scope_exclusion` Decision 없이 deferred/dismissed될 수 없다.

## Change 07 — Product Definition & Policy

- `skills/define/SKILL.md`, `productkit define` 구조 명령
- Journey / State / Branch / 정책(Context+Actor+Condition+Action+Outcome+
  Exception+Priority) / Edge Case / Acceptance Criteria schema
- 정책 충돌 분석(적용조건·범위·예외·우선순위). `exception_of`는 범위 부분집합
  검증과 우선순위 Decision이 모두 있을 때만 충돌 판정을 생략
- Definition 항목에서 Decision·Prompt로의 `derived_from` 추적

완료 조건: Decision 적용 기록이 실 대상 hash와 일치하고, Definition이 Decision→Prompt로
추적되며, 정책 조건 비교와 AI 의미 후보가 구분된다. 조건 교집합만으로 충돌을 확정하지 않는다.

## Change 08 — Validation & Approval Gate

- `productkit validate` — machine checks 전체
- 상태 그래프 검사(진입·종료 상태, 깨진 transition, 종료 도달 가능성)
- Review stale 검사, hash 계산(내용 + 규칙 버전, canonical 정규화)
- 최종 승인은 Product Definition 전체 콘텐츠 해시와 결합 — 입력 중 하나라도
  바뀌면 승인이 결정적으로 무효화되고 재승인을 요구함
- `PRODUCT READINESS` 보고와 종료 코드 1 차단

완료 조건: 잘못된 정의가 확실히 차단되고, WARN만 있을 때는 통과하며, 승인은
특정 해시에 결정적으로 결합된다.

## Change 09 — OpenSpec Bridge

- `productkit export openspec --change <name>`
- export 직전 재검증, 같은 이름 change가 있으면 실패
- `proposal.md`와 `specs/<capability>/spec.md` 생성
- Decision·Policy의 `derived_from` 체인을 추적 정보로 포함

완료 조건: 검증을 통과한 정의에서만 추적 가능한 OpenSpec 초안이 생성된다.
`design.md`와 `tasks.md`는 생성하지 않는다.
