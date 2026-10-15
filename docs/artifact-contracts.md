# ProductKit Artifact Contracts

이 문서는 ProductKit v0/v1 artifact 필드 계약의 요약이다. Change 01~09의 구현된
계약은 Zod schema와 CLI 검증으로 적용된다. 구조 검증은 자연어 의미의 충실성이나
로컬 확인 기록에 적힌 발언의 진위를 증명하지 않는다.

공통 규칙:

- 사람이 편집하는 artifact는 Markdown + YAML frontmatter다.
- 검증에 필요한 ID·상태·참조·구조화 필드는 frontmatter에 둔다.
- 본문에는 설명과 근거를 쓴다.
- 같은 필드를 JSON과 Markdown 양쪽에서 독립적으로 관리하지 않는다.
- ID는 파일명 변경이나 목록 재정렬로 바뀌지 않는다.

---

## config.yaml (Change 01/04 — v0 및 v1 구현)

위치: `product/config.yaml`

```yaml
schema_version: 0
product:
  name: my-app
  created_at: "2026-10-02"
stages:
  ingest: not_started
  discover: not_started
  challenge: not_started
  propose: not_started
  decide: not_started
  define: not_started
  review: not_started
  validate: not_started
  export: not_started
definition:
  status: not_started
```

| 필드 | 값 | 설명 |
|---|---|---|
| `schema_version` | `0` 또는 `1` | 계약 버전. v0의 기존 9개 Stage 키는 유지되고 v1은 `atomic_modeling`, `graph_analysis`를 추가한다 |
| `product.name` | 문자열 | 사람이 읽는 제품 이름 |
| `product.created_at` | `YYYY-MM-DD` | workspace 생성일 |
| `stages.*` | `not_started \| in_progress \| done` | 단계 진행 상태. 사람/AI가 갱신한다 |
| `definition.status` | `not_started \| draft \| confirmed` | Gate 통과 전에는 `confirmed`가 아니다 |

`stages`와 `definition.status`는 진행 메모이지 검증 결과가 아니다. Gate는 이 값이
아니라 현재 문서 내용을 기준으로 판정한다(Constitution 9).

`productkit migrate`만 명시적으로 v0→v1 변환한다. 변환은 백업과 recovery journal을
남기고 재실행 가능하며, rollback은 설정이 migration 산출 상태와 일치할 때만 허용된다.
일반 CLI 명령은 자동 migration하지 않는다. v0용 Change 01~03 동작은 유지한다.

---

## Prompt & Clarification (Change 02)

입력은 Canvas가 아니라 자연어 프롬프트다(`redesign-prompt-first-architecture`).
AI 추론을 사용자 발언으로 표시하지 않는다.

### Prompt

원문은 한 번 저장되면 수정하지 않는다(append-only). 사용자가 같은 세션에서
프롬프트를 고치면 새 `PRM-xxx`를 만들고 이전 것을 지우지 않는다.

```text
id              PRM-001
raw_text        사용자가 입력한 원문, 수정 없이 그대로
received_at     ISO 8601
content_hash    raw_text의 SHA-256
spans           [{id, start, end}]   # 문자 오프셋 구간
```

### Clarification

```text
id            CLR-001
prompt_ref    PRM-001
steps:
  definition      [{term, meaning, origin: user_stated | ai_inferred}]
  decomposition   [{statement, span_refs: [spans의 id, ...]}]
  elaboration     [{statement, actor, object, condition, action, result}]
  relation_check  [{statement_a, statement_b, relation_candidate}]
  relation_check_no_items_reason   relation_check가 비어 있으면 필수(검토했는데 없음을 명시)
  counterexample  [{ambiguity, possible_interpretations: []}]
  counterexample_no_items_reason   counterexample이 비어 있으면 필수
  span_coverage   [{span_ref, disposition: non_requirement, reason}]
                  decomposition·finding_candidates 어디에도 없는 span의 처분. steps 안에
                  있으므로 presented_hash에 포함되어 사용자가 같이 확인한다
  interpretation_check:      # 단일 값이 아니라 이력 목록. 과거 항목은 수정하지 않는다
    - id                     IC-001
      presented_statement    분해 결과를 논리 구조 그대로 재구성해 사용자에게 보여준 문장
      presented_hash         이 항목 생성 시점의 steps 전체를 정규화(키 정렬 JSON)해 해시한 값
      user_response          agreed | disagreed | partially_agreed
      user_statement         실제 사용자 발언(비어 있으면 agreed로 확정 못함)
      checked_at             ISO 8601
      entry_hash             이 항목 나머지 필드 전체의 SHA-256(변조 탐지용)
status             in_progress | awaiting_confirmation | confirmed
finding_candidates  [{statement, type: ambiguity | contradiction | missing_premise,
                      span_refs: [...]}]
```

규칙:

- `status`가 `confirmed`이려면 최신 `interpretation_check` 항목이 `agreed`이고,
  `user_statement`가 비어 있지 않으며, 그 항목의 `presented_hash`가 **현재**
  `steps`를 다시 정규화해 계산한 해시와 일치해야 한다. 이 비교는 CLI가 매번
  새로 계산한다 — 저장된 `status` 값은 진행 메모일 뿐 그대로 신뢰하지 않는다
  (Constitution 9와 동일 원칙).
- `presented_hash`가 "그 시점 steps"를 가리키므로, 확정 이후 `steps`가 조금이라도
  바뀌면 현재 해시와 어긋나 자동으로 재확인이 필요해진다(확인 무효화).
  `presented_hash`(산출물 변경 탐지)와 `entry_hash`(기록 자체의 변조 탐지)는
  서로 다른 목적이다.
- 과거 `interpretation_check` 항목은 고쳐 쓰지 않는다. 새 라운드는 새 항목을
  추가한다. CLI는 매번 모든 항목의 `entry_hash`를 다시 계산해 저장된 값과
  비교하고, 어긋나면 변조로 보고 `confirmed` 판정을 거부한다.
- **한계**: `entry_hash`는 기록 무결성을 **탐지**하는 용도로만 쓴다. 사용자의
  실제 동의를 **보장**하거나 악의적 변조를 **방지**한다고 표현하지 않는다 —
  파일을 직접 고치는 행위 자체를 막을 방법은 없다(tamper-evident이지
  tamper-proof가 아니다). `user_statement`가 실제 사람의 발언인지는 검증할 수
  없고, 검증했다고 표시하지 않는다(로컬 파일의 confirmation이 신원 인증
  증거가 아니라는 Decision 규칙과 같은 한계다).
- `definition[].origin`이 `ai_inferred`인 항목은 `user_stated`인 항목과 구분해
  표시한다. 사용자가 직접 한 말이 아닌 내용을 사용자 발언으로 표시하지 않는다.
- `finding_candidates`는 추측으로 해소하지 않고 그대로 보관한다. 정식 Finding으로의
  승격 여부는 Change 05(Challenge)가 판단한다 — 이 계약은 보관 형식만 정의한다.
- `relation_check`는 Graph edge가 아니다. 정식 edge 생성과 `proposed`/`confirmed`
  판정은 Change 04의 범위다.
- `presented_statement`에 대한 사용자 동의는 의미 보존을 증명하지 않는다.
  사람이 원문과 직접 대조해 확인했다는 기록일 뿐이다 — 이게 유일한 안전장치다.
- **원문 전수 처리(Constitution 11)**: Prompt의 모든 span은 `decomposition[].span_refs`,
  `finding_candidates[].span_refs`, `steps.span_coverage` 중 한 곳에 있어야 한다. 하나라도
  없으면 CLI는 `uncovered_spans`로 `confirmed`를 거부하고 빠진 span id를 나열한다.
  `span_coverage.reason`이 맞는지는 CLI가 판단하지 않는다 — 빠짐없이 이름을 댔는지만 본다.

---

## Discovery — 폐기됨 (redesign-prompt-first-architecture 이전 설계)

이 절은 Canvas 기반 설계 시절의 Discovery(`DSC-xxx`, `SRC-001` 참조)를
설명했다. `redesign-prompt-first-architecture`로 입력이 프롬프트로
바뀌면서 그 역할은 **Prompt & Clarification**(Change 02, 위)과 아래
**Node & NodeGroup**(Change 03)이 나눠 맡는다. 번호 충돌을 피하기 위해
남겨 둔다 — 새 설계에서 "Discovery"라는 이름의 별도 artifact는 없다.

---

## Node & NodeGroup (Change 03)

확정된 Clarification의 `steps.decomposition`을 단일 검증 대상·분해
가능성·의미 보존 세 기준으로 평가해 만드는 원자적 단위다. `NDG-xxx`(Node
집합) 하나가 Clarification 하나에 대응하고, 그 안에 `NOD-xxx-N` Node들이
있다.

```text
# Node (NodeGroup.nodes[])
id                  NOD-001-1
kind                fact | inference | requirement | policy
statement           원자적 진술
origin              source | inference
derived_from:
  clarification_ref  CLR-001
  decomposition_index 0            # steps.decomposition 배열의 0-based 인덱스
structural_signal:
  conjunction_count  0             # CLI가 결정적으로 센 후보 신호, 확정 판정 아님
  multiple_predicates false
atomicity:
  single_verifiable_subject: {verdict: yes|no|uncertain, reason}
  decomposability:           {verdict: not_applicable|valid_split|would_orphan_pieces, reason}
  meaning_preservation:      {verdict: preserved|distorted|uncertain, confidence, reason}
  final               atomic | split_required | null   # CLI가 위 세 verdict에서 결정적으로 계산, AI가 직접 적지 않음

# NodeGroup
id                    NDG-001
clarification_ref     CLR-001
source_content_hash   steps 전체의 정규화 해시(Change 02 stepsContentHash와 동일 알고리즘)
nodes                 [Node, ...]
coverage:
  complete             true|false
  uncovered_decomposition_indices []
distortion_checks:
  - decomposition_index 0
    reconstructed_statement "..."
    verdict             preserved|distorted|uncertain
    confidence           low|medium|high
    reason               "..."
finding_candidates:
  - id                  NFC-001
    node_ref            NOD-001-1
    type                addition | condition_change | operator_change | distortion
    statement           "..."
    status              open | resolved | deferred | dismissed
    resolution_ref       optional
status                  in_progress | needs_review | modeled
```

규칙:

- 원자성은 세 기준(`single_verifiable_subject`/`decomposability`/
  `meaning_preservation`) 중 **하나만으로 확정하지 않는다**. `final`은
  CLI가 세 verdict의 고정된 조합 규칙으로 계산하며, AI의 판단 자체를
  CLI가 다시 판단하지 않는다.
- 복합 조건이 하나의 정책을 구성하면(조건 하나만 떼도 성립 안 함)
  `would_orphan_pieces`로 판정되어 분해하지 않는다. 독립적인 여러 행동이면
  행동별로 분해하되 공유 트리거를 각 Node에 보존해야 한다(빠뜨리면
  `meaning_preservation: distorted`).
- `finding_candidates`의 `type`이 `addition`/`condition_change`/
  `operator_change`/`distortion`인 항목이 `status: open`으로 하나라도
  있으면 그 NodeGroup은 `modeled`가 될 수 없다. 이 네 가지가 아닌 일반
  모호성은 애초에 이 schema에 들어오지 않는다(Clarification 쪽
  `finding_candidates`에 남는다).
- Clarification이 confirmed라는 사실은 Node 모델링 결과 전체에 대한
  사용자 승인이 아니다. Node별 재확인은 생략하되, 위 네 가지 위험
  신호만은 별도 해소 전까지 확정을 막는다(해소 절차 자체는 Change 05~06
  범위).
- `source_content_hash`가 현재 Clarification `steps`의 해시와 다르면,
  저장된 `status`가 `modeled`라고 돼 있어도 재모델링이 필요한 것으로
  판정한다(Constitution 9).
- Node는 Clarification까지만 추적하고(`derived_from`), Prompt까지는
  Node→Clarification→Prompt 체인으로 조회한다 — Prompt를 직접 가리키는
  필드를 중복으로 두지 않는다.
- `entry_hash`와 마찬가지로, 이 모든 판정은 **탐지**이지 **증명**이 아니다
  — CLI는 구조(schema, 참조, 해시 일치)만 결정적으로 검증한다.

---

## Graph Edge, RelationCandidate, ImpactReport (Change 04)

`product/graph/edges.yaml`은 `schema_version: 1`과 Edge 목록을 저장한다. v0에서
지원하는 관계는 `depends_on`, `precedes`, `conflicts_with`, `duplicates`,
`supersedes`, `exception_of`뿐이다. 관계명과 source/target Node kind 조합은 닫힌
schema와 관계 규칙으로 검증한다. `contains`, `causes` 등은 지원 Edge로 변환하지 않는다.

```yaml
- id: EDG-001
  type: depends_on
  source: NOD-001-2
  target: NOD-001-1
  basis: ai_inferred | explicit_text
  reason: 근거 설명
  status: proposed | confirmed | rejected
  confirmations: []
```

확정 이력은 사용자 응답, 실제 발언을 기록한 텍스트, rationale, 현재 Edge claim hash,
양 endpoint snapshot hash, 시각, entry hash를 보존한다. 확인 이력은 append-only로
저장하며 Node/Edge 변경이나 해시 불일치가 있으면 확인은 유효하지 않다. CLI는 기록의
구조와 무결성만 검증하고 실제 사용자 발언의 진위나 관계 의미를 증명하지 않는다.

지원하지 않는 관계 가설은 `product/graph/candidates/RLC-<fingerprint>.yaml`에
`RelationCandidate`로 별도 저장한다. 원본 관계명, Node endpoint, 제안 의미, 근거 참조,
검토 상태/이력, 생성 시각, endpoint snapshot hash를 포함한다. Candidate는 Edge가 아니며
자동 확정·전파하지 않는다. 동일 가설은 결정적 fingerprint로 중복을 막고, Node 변경은
근거를 stale로 만든다. ImpactReport의 `blocked_inputs`는 Candidate ID와 분석 제외 이유를
참조한다. 미지원 후보가 있거나 관계 검토가 완료되지 않은 결과는 incomplete다.

ImpactReport에는 input fingerprint, 확정/잠재 도달 후보, 별도 검토 후보, 각 경로의 Edge
ID·관계·방향·근거, 차단 입력, completeness와 규칙 버전이 들어간다. 관계별 탐색 방향을
적용하며 모든 Edge를 무차별 역방향 순회하지 않는다. 결과는 영향 후보이지 자동 변경 명령이
아니다.

## Finding (Change 05, Node 전용 Finding 후보는 Change 03 — 위 참고)

Challenge 결과의 공통 모델이다.

```yaml
schema_version: 1
id: FND-<16-hex-fingerprint>
type: flow_gap | policy_conflict | semantic_distortion | ...
severity: critical | major | minor
statement: string
related_refs: [{kind: prompt|clarification|node_group|node|edge|relation_candidate|impact_report|finding, ref: string}]
evidence_refs: [{kind, ref, detail, source_hash?}]
counterexamples: [{condition, expected, observed, status: hypothesis|observed, evidence_refs: []}]
ai_assessment: {is_ai_judgment: true, rationale, confidence, uncertainty: []}
review_status: proposed | confirmed | rejected
resolution_status: unresolved | resolved | deferred | dismissed
confirmation_history: [{finding_hash, user_statement, rationale, response, checked_at, entry_hash}]
questions: []
history: [{event, actor, prior/new state, finding_hash, entry_hash}]
```

`review_status` answers whether the user explicitly accepts or rejects that the issue exists. `resolution_status` is preserved by Change 06; its Decision is a pending application record and does not set resolution. New AI output is always `proposed` and `unresolved`; AI cannot write confirmation or resolution. Confirm/reject records bind to the current immutable Finding content hash and append to history. CLI checks structure and hashes, but cannot prove the speaker's identity or that a recorded statement is authentic. A substantive change creates a linked Finding; it does not overwrite the prior claim. Exact fingerprint reruns return the existing record.

ChallengeRun files in `product/reviews/` capture the explicit NodeGroup scope, input hashes, eight review areas, exclusions/unavailable inputs, Finding references, rules/Skill version, checkpoints, and review hash. Review coverage can be complete while Findings remain open, including Critical Findings. This is not semantic correctness or Product Definition approval. Change 06 Decisions do not change Finding resolution state; Critical exclusions remain visible and unresolved pending Change 07 application and later verification.

---

## Proposal (Change 06)

```yaml
finding_refs:
  - finding_ref: FND-1111111111111111
    claim_hash: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    review_status: confirmed
input_snapshot: [{kind: node, ref: NOD-001-1, content_hash: cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc}]
options:
  - id: OPT-A
    description: Define a timeout response
    evidence_refs: [{kind: node, ref: NOD-001-1, content_hash: cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc}]
    benefits: [Predictable recovery]
    costs: [Implementation effort]
    risks: [Duplicate payment attempt]
    assumptions: [Provider timeout is detectable]
    expected_impacts: [A timeout state is shown]
    side_effects: [Recovery takes an extra step]
    target_candidates: [{kind: node, ref: NOD-001-1, content_hash: cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc}]
    finding_coverage: [{finding_ref: FND-1111111111111111, approach: Define retry behavior, residual_issues: [Provider limits need review]}]
  - id: OPT-B
    description: Keep current behavior and surface a warning
    evidence_refs: [{kind: node, ref: NOD-001-1, content_hash: cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc}]
    benefits: [Small product change]
    costs: [User must recover manually]
    risks: [Unclear transaction result]
    assumptions: [Warning is sufficient for the first release]
    expected_impacts: [User sees a recovery warning]
    side_effects: [Support contacts may increase]
    target_candidates: [{kind: node, ref: NOD-001-1, content_hash: cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc}]
    finding_coverage: [{finding_ref: FND-1111111111111111, approach: Explain manual recovery, residual_issues: [Outcome remains uncertain]}]
ai_recommendation: {is_ai_recommendation: true, option_ref: OPT-A, rationale: Reduces user uncertainty, confidence: medium, uncertainty: [Provider behavior must be confirmed]}
```

This is a valid Proposal **input** fixture; the CLI adds the deterministic ID, claim hash,
creation time and history when it stores the record.

한 Finding에 여러 Proposal이 연결될 수 있고 하나의 Proposal이 여러 Finding을 다룰 수 있다. 각 대안은 대상 Finding 모두에 대한 처리 방식과 잔여 이슈를 기록한다. AI recommendation은 비구속이며 선택 상태를 만들지 않는다. 입력 변경은 스냅샷을 stale로 만들며 수정은 새 ID와 `supersedes_proposal_ref`로 보존한다.

---

## Decision (Change 06)

사용자의 명시적인 선택이나 확정 발언이 있을 때만 생성한다.

```text
id                    DEC-<16 hex>
decision_type         content_decision | scope_exclusion
selection             proposal_option | direct_user_decision
finding_refs          [{finding_ref, claim_hash}]
user_statement        실제 사용자 발언
rationale             결정 근거
scope                 적용 대상 범위
input_snapshot        typed artifact refs and hashes
application_status    pending_application
supersedes_decision_ref optional DEC-<16 hex>
history               append-only
```

CLI 입력 형태는 아래와 같다. `--user-statement`, `--rationale`, `--scope`는
`productkit decide record`의 명시적 옵션으로 전달한다.

```yaml
decision_type: content_decision
proposal_ref: PROP-2222222222222222
option_ref: OPT-A
finding_refs: [{finding_ref: FND-1111111111111111, claim_hash: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}]
selection: {kind: proposal_option, proposal_ref: PROP-2222222222222222, option_ref: OPT-A}
user_statement: "I choose option A."
rationale: It handles the timeout explicitly.
scope: Provider timeout handling.
input_snapshot:
  - {kind: proposal, ref: PROP-2222222222222222, content_hash: dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd}
  - {kind: finding, ref: FND-1111111111111111, content_hash: eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee}
```

Proposal 외의 대안을 직접 선택하는 입력은 Proposal 참조를 포함하지 않는다.

```yaml
decision_type: content_decision
finding_refs: [{finding_ref: FND-1111111111111111, claim_hash: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}]
selection: {kind: direct_user_decision, text: Keep the existing behavior and add a timeout warning.}
user_statement: "I choose to keep the existing behavior and add a timeout warning."
rationale: The warning communicates uncertainty.
scope: Provider timeout handling.
input_snapshot: [{kind: finding, ref: FND-1111111111111111, content_hash: eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee}]
```

규칙:

- 추천을 제시한 상태는 Decision이 아니다.
- 사용자가 기존 대안 외의 선택을 해도 기록할 수 있다.
- rationale이 없으면 질문한다.
- confirmation에는 실제 사용자 발언을 보존한다.
- 로컬 파일의 confirmation은 대화 기록이며 신원 인증 증거가 아니다.
- 결정 변경 시 기존 기록을 삭제하지 않고 새 결정이 `supersedes`로 대체한다.
- CLI는 필수 필드와 hash 무결성만 검증한다. 발언자의 실제 신원·발언 진위·대안의 의미적 적합성을 증명하지 않는다.
- Decision 기록만으로 Finding을 resolved/deferred/dismissed로 전이하지 않는다. Decision은 `pending_application`으로 남고 적용은 Change 07, 해결 판정과 최종 승인은 후속 Gate의 책임이다.
- Critical scope exclusion에는 명시적 제외 범위·영향·rationale·잔여 위험이 필요하며, 이는 해결이 아니다.

---

## Assumption (Change 06~07)

Finding의 `assumption`은 의심되는 가정을 발견한 기록이고, Assumption artifact는 이후
검증 상태를 관리한다.

```text
schema_version  1
id              ASM-<16 hex>
finding_ref     FND-<16 hex>
finding_hash    <sha256 of current Finding claim>
statement       assumption text
risk            critical | noncritical
evidence_refs   typed refs with content hashes
status          unverified | verified | disproven | accepted_risk
decision_ref    required for every transition out of unverified
rationale       required for a status transition
history         append-only, hash-checked status events
```

미검증 가정을 사용자가 받아들였다고 해서 `verified`로 바꾸지 않는다. 그 경우는
`accepted_risk`이며 Finding을 명시적으로 대상으로 한 현재 Decision과 rationale이
필요하다. `accepted_risk`는 확인된 사실이나 Finding 해결을 뜻하지 않는다.

---

## Definition (Change 07)

포함 항목: Journey, State, Branch, Business Rule, UX Policy, AI Policy(AI 기능이 있는
경우), Error Policy, Edge Case, Acceptance Criteria.

Journey 최소 구조:

```text
id                    JRN-001
actor
goal
entry_state
states                []
transitions           [{from, to, trigger, decision_refs}]
terminal_states       []
decision_refs         [DEC-001, ...]
acceptance_criteria   []
```

각 규범 항목은 typed hash reference로 관련 Decision부터 원본 Prompt까지 추적 가능해야 한다.
`product/definition.yaml`은 `schema_version: 1`, 결정적 `id`/`content_hash`, `status: draft`,
제품 목표·범위·사용자/이해관계자·기능/비기능 요구·Journey/Policy 참조·AC·명시적 제외·열린
Finding/Assumption 및 input snapshot을 포함한다. 항목의 provenance는 `source`,
`ai_inference`, `user_decision`을 구분한다. Node/Prompt 근거만 있고 current Decision에서 Prompt까지
이어지는 경로가 없으면 확정 행동으로 넣을 수 없다. `create`는 기존 Definition을 덮어쓰지 않으며,
변경 버전은 Application을 통해 반영한다.

Policy는 `context`, `actor`, `condition_text`, bounded boolean `condition` AST, `action`,
`outcome`, `exceptions`, optional Decision-backed `priority`, provenance와 content hash를 둔다.
CLI는 typed equality/inequality와 numeric ordering을 호환 타입/단위에서만 비교한다. NOT,
불지원 연산, incompatible units와 자연어 의미는 inconclusive/AI review다. 조건 교집합이나
`exception_of` 하나만으로 충돌을 확정/제외하지 않는다.

### Decision Application

`product/applications/APP-<16 hex>.yaml`은 Decision 원본과 분리된 적용 계획/저널이다.
Decision ID/hash, target path/ref, before/after bytes/hash, scope, rationale, Finding,
잔여 위험, before/after ImpactReport ID, target별 상태와 append-only 이력을 보존한다.
다중 파일 publish는 단일 원자적 트랜잭션이 아니다. 모든 target을 먼저 검증하고, 각 파일을
CAS 및 같은 디렉터리 atomic publish로 적용한다. 저널은 부분 적용을 표시하며 resume은 target이
기록된 before 또는 after hash일 때만 허용한다. Rollback은 현재 값이 해당 적용의 after hash와
일치할 때만 원본을 복구한다. Decision은 적용 후에도 불변이며 `pending_application`으로 남는다.
Application `applied`는 target 구조/hash 검증 완료만 의미하며 post-application verification,
Finding 해결 또는 최종 승인을 의미하지 않는다.

Node 배치(Constitution 11): 현재 workspace의 모든 Node는 Definition 항목·Policy·Journey의
`source_refs`, 그 Node를 `input_snapshot`에 담은 `scope_exclusion` Decision(+ 대응 `exclusion`
항목), 또는 `related_refs`로 그 Node를 가리키는 unresolved Finding 중 한 곳에 있어야 한다.
어디에도 없는 Node는 `definition.node_coverage` FAIL이다. `exclusion` 항목은
`exclusion.decision_ref`가 현재의 `scope_exclusion` Decision으로 풀려야 하고 `excluded_scope`·
`impact`·`residual_risk`를 그 Decision과 글자 그대로 같게 적어야 하며, 그 Decision을
`provenance.decision_refs`에도 둔다. Definition에는 `functional_requirement`·
`nonfunctional_requirement`·`acceptance_criterion` 중 하나 이상이 있어야 한다
(`definition.normative`).

AI가 구조화 과정에서 새로운 제품 행동을 발견하면 몰래 추가하지 않고 다시
Finding/Proposal로 되돌린다. 사용자에게 항목별 수십 번의 승인을 요구하기보다, 명확히
나열한 항목 묶음을 한 번에 확정할 수 있게 한다.

---

## Review (Change 08)

```text
id                REV-001
reviewed_hash     평가 대상 내용의 hash
rules_version     검증 규칙 버전
created_at
finding_refs      [FND-010, ...]
summary
```

`reviewed_hash`가 현재 내용 hash와 다르면 Review는 stale이다. hash는 내용과
schema/검증 규칙 버전을 기준으로 계산하고, 수정 시각과 report 자체는 입력에서
제외한다.

### ValidationReport and Approval (Change 08)

`product/validations/VAL-<16 hex>.yaml` binds the current Definition hash, a canonical
snapshot of current upstream artifacts, the rules version, individual check results,
structural status, semantic-review status, and readiness. Structural PASS never implies
semantic correctness. Semantic review records live separately under
`product/semantic-reviews/SEM-<16 hex>.yaml`, cover eight required areas, and disclose
uncertainty and unreviewed scope. An area marked `reviewed` must cite at least one product
artifact in `evidence_refs`; an empty list, or a `skill`/`workspace` ref, makes the review
hollow and the gate fails it whether it came through `validate review` or was written by
hand. The same holds for ChallengeRun areas. The CLI checks that evidence exists and resolves,
not that it is the right evidence for the area. Readiness also requires `source.coverage`
(every Prompt clarified and modeled), `definition.node_coverage` (every Node placed) and
`definition.normative` (at least one requirement or acceptance criterion); a Finding that is
`resolved`/`dismissed`/`deferred` must be targeted by its cited Decision's `finding_refs`. In-scope unresolved Critical Findings block readiness;
an applied and verified scope exclusion can only preserve a warning with its residual
risk, not mark the Finding resolved or risk-free.

`product/approvals/APR-<16 hex>.yaml` is an append-only user statement bound to one
current ready ValidationReport, Definition hash, and input fingerprint. `productkit
approve record` validates the record and hashes only; it cannot authenticate the speaker
or statement. Input or rule changes make current approval stale while retaining history.
