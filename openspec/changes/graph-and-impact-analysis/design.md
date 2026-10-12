# Design

## Context

OpenSpec 1.14.0 / spec-driven. 현재 메인 spec은 없고 Change 01~03 delta만 있다. 구현은 config v0, Prompt/Clarification/NodeGroup YAML, init/intake/clarify/model까지다. 이 문서는 Change 04 구현 설계이며 현재 구현이라고 주장하지 않는다. 검증 근거와 선행 결함은 verification.md에 있다.

## Goals / Non-Goals

Goals: 서로 다른 NodeGroup 사이의 관계와 변경 영향 후보를 결정적으로 탐색하고, 사용자 확인·출처·최신성을 분리해 보존한다. 지원하지 않는 관계 가설도 별도 RelationCandidate로 남겨 정보 손실 없이 검토 대기시킨다.

Non-Goals: 자연어 의미를 CLI로 판정, 자체 LLM 호출, 기존 Change 결함의 무단 수정, 정책 우선순위 결정, 후속 artifact schema 구현, 범용 migration 엔진, 자동 승인.

## Decisions

### D1. 저장 경계와 CLI

`product/graph/edges.yaml`: 단일 GraphDocument `{schema_version: 1, edges: []}`. `product/graph/candidates/RLC-<fingerprint>.yaml`은 미지원 관계 가설의 개별 RelationCandidate 파일이다. 빈 그래프는 유효하되 관계를 검토하지 않았다는 뜻이지 관계 부재의 증명이 아니다. init은 graph/README.md만 만들며 가짜 Edge·Candidate·보고서를 만들지 않는다. 기존 Node YAML은 수정하지 않는다. NodeGroup도 Content Node가 아니므로 endpoint가 될 수 없다.

- `productkit graph`: 입력 Node/출처 점검, graph skill 경로·계약·출력 위치 안내. AI가 관계를 작성한다.
- `productkit graph validate`: schema/ID/참조/허용 조합/순환/확인 해시와 freshness를 검사한다. 의미 정확성을 판정하지 않는다.
- `productkit graph impact --node NOD-...`: 현재 snapshot으로 확정/잠재 영향 후보와 terminal 검토 후보를 계산한다.
- `productkit graph trace --node NOD-...`: 현재 구현된 provenance를 읽기 전용 조회한다. 후속 artifact 미구현은 UNKNOWN/unsupported로 표시한다.
- `productkit graph candidate add --input <yaml>`: Skill이 만든 미지원 관계 제안 파일을 검사하고 결정적 fingerprint ID로 새 Candidate 파일을 원자적으로 보존한다. 같은 가설 재실행은 동일 파일을 재사용하며 다른 내용으로 덮어쓰지 않는다.
- `productkit graph candidate list`: pending/reviewed/dismissed 후보와 endpoint freshness를 조회한다. Candidate 검토 상태는 Edge 확인/승인이 아니다.
- `--output <path>`는 graph/ 아래 새 impact YAML로만 저장하며 기존 파일이면 실패한다. 기본은 stdout만 출력한다. `--check-report <path>`는 fingerprint를 재계산해 latest/stale을 출력한다.
- 새 graph 명령은 v0이면 명시적 migrate 안내 후 코드 2로 중단한다. v1 입력 구조 오류는 1, 파일 I/O·잘못된 옵션·없는 시작 Node는 2, 완전한 탐색은 0. stale 관계/출처 때문에 탐색이 불완전하면 결과를 출력하되 코드 1이다. 빈 potential/review도 배열과 개수를 출력한다.
- graph validate에서 schema/참조/상태 불일치는 FAIL, stale은 STALE(코드 1), 제안 순환은 WARN이다. 모든 출력에는 “구조적 검증/영향 후보이며 의미적 정확성의 증거가 아님”을 표시한다.

Graph와 Candidate는 모두 로컬 YAML 파일이다. DB나 역참조 인덱스를 추가하지 않는다. Candidate는 요청된 최소 필드(`id`, `original_relation_name`, `source_node_ref`, `target_node_ref`, `proposed_meaning`, `evidence_refs`, `review_status`, `created_at`, `endpoint_snapshot_hashes`)를 가진다. 신규 후보 상태는 `pending`이며 `reviewed`/`dismissed`는 명시적 후속 기록으로만 바뀐다. 어떤 상태도 Edge `confirmed`를 뜻하지 않는다. `candidate_fingerprint`는 원본 관계명, endpoint ID와 snapshot hash, 제안 의미, 정렬된 근거 참조로 계산한다. 같은 내용의 재실행은 동일 fingerprint를 만든다. 동일 ID 파일이 다르면 충돌로 중단하고 덮어쓰지 않는다. Agent도 패키지의 검증/원자적 저장 helper를 사용한다. 직접 편집된 YAML은 다음 CLI 실행 때 다시 검사하며 외부 편집을 막거나 인증했다고 주장하지 않는다.

### D2. 관계 선택과 닫힌 타입 계약

R=requirement, P=policy, F=fact, I=inference. 모든 채택 관계의 self-edge는 금지다. kind 제한은 문법 계약이지 의미적 진위 판정이 아니다.

| 후보 | 의미와 source→target | 허용 kind | 동일 타입 순환 | 변경 영향 규칙 | 채택 근거 |
|---|---|---|---|---|---|
| depends_on | source의 성립이 target을 필요로 함 | R/P→R/P | 금지 | target 변경→source, 전파 | 요구사항 의존·선행 조건의 핵심 |
| precedes | source가 target보다 먼저 수행됨 | R→R | 금지 | source 변경→target, 검토만 | 시간 순서와 필수 의존을 구분 |
| conflicts_with | 같은 적용 맥락에서 함께 만족하기 어려움 | R/P↔R/P | 대칭 삼각형 허용 | 양방향 검토만 | 충돌 후보를 우선순위 결정과 분리 |
| duplicates | 두 진술이 같은 내용을 중복 기술한다는 가설 | F/F, I/I, R/R, P/P | 대칭 삼각형 허용 | 양방향 검토만 | 자동 병합·동일성 전파 금지 |
| supersedes | source가 target의 새 대체안 | 동일 kind끼리 | 금지 | 양방향 검토만 | 구 요구의 변경/대체 추적, 자동 삭제 금지 |
| exception_of | source가 target의 한정된 예외 | P→P | 금지 | target 변경→source 전파; source 변경→target 검토만 | 기본 정책 변경 시 예외 재검토 |
| contains | 전체→부분 의미 포함 | 미채택, 허용 kind 없음 | 적용 안 함 | 전파 없음, 입력 거부 | NodeGroup 소속과 중복하며 atomic Node의 부분 포함 의미가 미정 |
| causes | 원인→결과의 의미적 인과 | 미채택, 허용 kind 없음 | 적용 안 함 | 전파 없음, 입력 거부 | 필요조건/시간 순서와 다른 인과 증거 모델이 현재 없음 |

보류 타입은 alias로 변환하지 않는다. Edge 입력으로 제출하면 `unsupported_relation_type`으로 거부하고 Graph 파일을 보존한다. AI가 관계 가설로 발견하면 RelationCandidate로 보존한다. 특히 `contains`/`causes`는 모두 Candidate이며 자동 Edge·승인·영향 전파 대상이 아니다. Candidate의 source/target Node가 변경되면 기존 파일은 보존하고 현재 snapshot과 비교해 `stale`로 표시하며 재검토한다. ImpactReport의 `blocked_inputs`에는 `{candidate_ref, reason: unsupported_relation_type}`를 기록한다. 해당 후보가 하나라도 포함된 보고서는 `incomplete`이고, 후보는 confirmed/potential impact frontier에 들어가지 않는다. 추후 causes를 도입한다면 피드백 순환과 인과 근거 계약을 별도 change로 설계한다.

대칭 Edge는 source/target을 ID 사전순으로 canonicalize한 뒤 hash한다. 같은 타입·같은 endpoint의 활성(proposed/confirmed) 중복은 거부하고, rejected 이력 이후 새 ID 재제안은 허용하되 이전 기록을 경고한다. 기존 ID는 재사용하지 않는다. 반대 방향의 directed Edge는 별개다.

순환 금지는 fresh confirmed Edge의 **동일 타입** 그래프에서 검사한다. proposed/stale까지 포함한 동일 타입 순환은 경로와 WARN을 남긴다. 확인 직전에는 새 Edge를 포함한 confirmed 그래프를 다시 검증해 순환 생성 확정을 거부한다. mixed-type cycle은 오류가 아니며 impact의 visited 상태로 종료한다. 서로 다른 관계를 하나의 DAG로 합치면 시간 순서와 의존의 방향 차이를 모순으로 오인하므로 합치지 않는다. rejected는 모든 활성 순환/영향 계산에서 제외한다.

### D3. Edge 계약과 확인 이력

```yaml
schema_version: 1
edges:
  - id: EDG-001
    type: depends_on
    source: NOD-001-1
    target: NOD-002-1
    basis: ai_inferred # ai_inferred | explicit_text
    reason: 주문 확정이 결제 확인을 전제로 한다는 관계 가설
    status: proposed # proposed | confirmed | rejected
    confirmations: []
```

reason은 비어 있으면 안 된다. basis=explicit_text도 사용자 관계 승인과 별개다. endpoint 자체가 기존 출처 체인을 제공하므로 Prompt source_refs를 Edge에 다시 저장하지 않는다. reason에 원문을 인용할 때는 trace로 인용 위치를 함께 조회하며 요약을 직접 발언으로 표기하지 않는다.

확인 항목: `{id: ECF-..., edge_ref, edge_claim_hash, endpoint_snapshot_hashes: {source, target}, user_response: agreed|disagreed, user_statement, rationale, checked_at: ISO8601, entry_hash}`. 승인 대상은 edge_ref와 claim hash로 고정하고 실제 발언은 그대로 보존한다. rationale은 사용자가 밝힌 승인/거부 이유이며 AI 추론으로 채우지 않는다. 이유가 없으면 관계 확정 대신 질문한다. confirmation entry_hash는 entry_hash 자신을 뺀 **id 포함 모든 필드**의 canonical JSON SHA-256이다.

claim hash 입력은 `{rules_version, id, type, source, target, basis, reason}`이다. endpoint hash는 Node 전체 계약 필드와 그 Node의 lineage snapshot(NodeGroup의 source_content_hash, 현재 CLR steps hash/확인 이력, PRM id/content_hash/실제 raw hash/spans)을 묶는다. endpoint 내용을 승인 후 바꾸거나 출처가 달라진 경우 같은 Node ID라도 승인이 이전 내용을 대표하지 않는다. 수정 시각·파일 경로·보고서는 hash 입력에서 제외한다. Node에 content_hash 필드를 새로 저장하지 않고 조회 시 계산한다.

전이:

1. 새 관계는 proposed, confirmations=[]이다. 원문·AI 근거·Challenge 침묵·CLR confirmed로 Edge를 승격하지 않는다.
2. 실제 발언을 받은 뒤 새 확인 항목을 추가한다. claim과 양 끝 현재 snapshot, 전체 이력의 entry_hash, 허용 kind/참조/순환을 모두 통과한 최신 agreed만 confirmed가 될 수 있다. 최신 disagreed는 rejected다.
3. approved claim/endpoint 변경 시 저장 상태는 감사용으로 보존하고 `effective_status: proposed`, `freshness: stale`을 계산한다. 옛 확인 기록은 삭제하지 않는다. 새 확인을 받아야 fresh confirmed로 복귀한다.
4. rejected claim 수정도 이전 거부가 새 주장에 적용되지 않으므로 effective proposed/stale이다. 내용이 변하지 않은 rejected는 계속 제외한다. 재제안은 새 Edge ID를 권장하고 이전 거부 이력을 보여준다.
5. 확인 없는 status=confirmed/rejected, 응답과 status 불일치, entry_hash 불일치는 구조 오류다. stale로 인한 저장 confirmed와 effective proposed 차이는 status forgery와 구분한다. 이미 confirmed/rejected인 관계도 반대 응답의 새 항목으로 재결정할 수 있으나 기존 항목 덮어쓰기는 금지다.

CLI는 사용자 발언의 진위를 증명하지 못한다. 해시도 악의적 수정 후 재계산을 막지 못한다. 로컬 기록의 내부 일관성 검사를 신원 인증·동의 증명·변조 방지로 표현하지 않는다.

### D4. 입력 유효성과 provenance 검사

Graph가 읽는 Node는 기존 `judgeCompletion`/`judgeNodeSetCompletion` 검사에 더해 Node ID 전역 유일성, 실제 PRM 존재/raw hash/spans 범위, CLR.prompt_ref 해소, decomposition.span_refs 해소, Node의 derived_from CLR 일치/index 범위, origin=source의 비어 있지 않은 span 참조를 검사한다. 그래프 입력에는 비어 있지 않은 NodeGroup과 final=atomic Node만 허용한다. split_required/null은 아직 모델링 입력이다. 기존 판정 함수를 바꾸는 대신 Graph 경계에서 검사하며 기존 명령 자체의 결함 수정은 별도 승인 대상이다.

Prompt 재입력은 새 ID이므로 과거 Prompt/Node를 자동 대체하거나 삭제하지 않는다. 새 Prompt가 이전 요구의 수정인지 추가인지 AI가 후보로 분석해 supersedes/conflicts_with를 **제안**한다. 기존 Prompt 파일의 raw text만 수정되어 저장 hash와 다르면 오류다. raw/hash 모두 수동 교체한 과거 이력은 기존 v0 데이터만으로 복원할 수 없어 UNKNOWN이며 Graph 확인 snapshot 생성 이후의 변경만 탐지 가능하다. 기존 명세가 이를 이미 지원한다고 주장하지 않는다.

부적격 출처·없는 endpoint·중복 ID는 명시적 blocked_inputs에 남긴다. 확정 탐색에 넣지 않는다. 해소 가능한 stale Edge는 potential에서 탐색하지만 결과 전체를 incomplete로 표시한다. 해소 불가능한 참조는 traversable하지 않으며 진단과 제외 사유를 반드시 출력한다.

### D5. 영향 탐색 알고리즘

D2의 고정 방향표로 dependency arcs와 terminal review arcs를 생성한다. CLI가 표를 적용하는 것은 설계된 규칙의 결정적 실행이다. 표 밖 방향을 AI가 실행 시 추가할 수 없다.

상태는 `(node_id, certainty)`이며 certainty=confirmed|potential이다. 시작 Node는 confirmed 상태에서 출발한다. fresh confirmed arcs만 지나면 confirmed, proposed 또는 stale arc를 한 번이라도 지나면 이후 전체 경로는 potential이다. rejected/invalid arc는 제외하고 제외 사유를 기록한다. confirmed+proposed 결과의 단순 Node 차집합을 쓰지 않는다: 같은 Node에 확정 경로와 잠재 경로가 모두 있으면 **양쪽 경로를 모두 보존**한다.

depends_on의 역방향, exception_of의 기본→예외만 다음 frontier로 전파한다. review arc로 도달한 Node는 review_candidates에 넣고 frontier에 넣지 않는다. 따라서 충돌/중복을 거쳐 무관한 의존까지 영향으로 확대하지 않는다. precedence는 시간 순서 재검토일 뿐 dependency의 증거가 아니다. 단순 무방향/역방향 전체 BFS 대안은 과도한 영향과 잘못된 방향 때문에 기각한다.

각 결과: `{node_ref, certainty, effect: dependency_candidate|review_candidate, depth, direct: depth==1, path:[{edge_ref, type, from, to, traversal: forward|reverse, basis, reason, effective_status, freshness}], warnings}`. 결과는 confirmed_impacts/potential_impacts/review_candidates.confirmed/review_candidates.potential로 나눈다. 확정 영향도 “확정 관계에 의한 후보”이지 실제 행동이 반드시 변한다는 뜻이 아니다.

경로 폭발을 피하기 위해 `(node, certainty, effect)`별 최단 witness 하나를 보존하고 동률은 Edge ID 사전순으로 선택한다. 결과 coverage는 모든 도달 가능한 Node/분류이며 모든 가능한 경로를 열거했다고 주장하지 않는다. visited로 순환을 종료한다. seed로 돌아온 경로는 진단만 남기고 영향 목록의 자기 자신은 제외한다. direct 경로와 indirect 경로가 둘 다 있으면 최단 depth를 표시한다.

예: `B depends_on A`, `C depends_on B`, `D conflicts_with B`에서 A 변경은 B 직접, C 간접, D는 B까지의 경로+충돌 Edge를 갖는 terminal 간접 검토다. B 변경에서 A는 의존 영향이 아니다. A 변경에서 B가 proposed라면 C의 후속 confirmed Edge도 potential 경로다. D와 의존하는 E는 D를 통과해 도달하지 않는다.

### D6. 분석 데이터와 최신성

ImpactReport: `{schema_version:1, analysis_id, seed_node_ref, rules_version, input_fingerprint, completeness: complete|incomplete, confirmed_impacts, potential_impacts, review_candidates, blocked_inputs, warnings}`. 미지원 관계 가설은 별도 RelationCandidate 파일에 보존하고, 보고서 blocked_inputs에서 후보 ID와 제외 이유를 참조한다. 후보는 영향 계산에 참여하지 않으며 존재 시 completeness=incomplete다. fingerprint는 Candidate 추가·변경·삭제와 현재 endpoint snapshot을 포함한다. 생성 시각은 메타데이터일 뿐 freshness 판정에 사용하지 않는다.

fingerprint는 현재 config schema version, 전체 PRM(raw/hash/spans), CLR(steps/확인 이력/참조), NodeGroup/Node 전체, GraphDocument(거부 이력 포함), rules_version의 canonical snapshot을 ID순으로 정렬해 SHA-256한다. 배열의 의미 순서는 유지한다. 보고서 자체·mtime·README·파일 경로는 제외한다. 새 Node/Edge/Prompt 추가, 삭제, status/근거/확인 변경도 fingerprint를 바꾼다. edge 단위 승인은 endpoint/claim 변화에만 stale이지만 분석 보고서는 입력 전체 변화에 stale이다. 관련 없는 변경의 과도한 재분석은 작은 로컬 v0의 의도적 trade-off다.

저장 보고서 사용 전 snapshot 재계산, fingerprint 불일치/없는 입력이면 stale과 원인을 보고하고 현재 결과처럼 재사용하지 않는다. 원자적 저장 및 no-overwrite 규칙을 적용한다.

### D7. Content와 provenance는 다른 그래프다

참조는 현재 원본 소유 artifact에 단방향으로 저장하고 역방향은 질의로 계산한다.

| 현재/후속 소유자 | 출처 필드 | 역할/범위 |
|---|---|---|
| Clarification | prompt_ref, decomposition.span_refs | 현재 구현; Prompt와 원문 범위 |
| Node | derived_from.clarification_ref/decomposition_index | 현재 구현; NodeGroup.clarification_ref는 집합 경계 검사이며 별도 Prompt 링크 추가 안 함 |
| Finding | source_refs | 후속 계약; PRM/NOD 등 근거, 기존 필드 그대로 |
| Proposal | finding_refs | 후속 계약; Finding 없는 직접 제안 경로는 해당 change에서 명시적으로 정의해야 함 |
| Decision | proposal_ref(optional), finding_refs, source_refs | 후속 계약; Proposal을 거치지 않은 직접 사용자 결정도 가능 |
| Policy/Definition | decision_refs 또는 기존 derived_from 계약에 맞는 참조 | 후속 설계 소유; 최소 active Decision→출처 Prompt 경로 필요 |
| OpenSpec export | 기존 항목의 provenance 참조를 export metadata로 보존 | Change 09 소유; spec 본문 의미 Edge와 혼합하지 않음 |

Prompt→Clarification→Node→Finding→Proposal→Decision→Policy→OpenSpec은 가능한 생성 순서이지 모든 artifact의 필수 단일 사슬이 아니다. 예: Decision.source_refs→Prompt 직접 경로도 가능하다. Policy kind Node는 명료화의 정책 진술이고 policies/의 승인된 Policy artifact와 동일하지 않다. 최종 Definition은 Constitution 4에 따라 Decision 경유 경로를 요구하지만 모든 중간 artifact가 Decision을 가진다는 뜻은 아니다.

provenance derivation projection(Node→CLR→PRM, FND.source_refs, PROP.finding_refs, DEC의 근거 refs, Policy의 decision refs, export의 출처 refs)은 cycle-free다. dangling refs는 오류, 독립 Node는 합법이며 출처 없는 source Node는 오류다. Finding.resolution_refs처럼 이후 결정을 가리키는 검토·해소 참조는 derivation cycle 검사에 섞지 않는다. 참조 유형별 registry로 구분한다. 모르는 future 타입은 UNKNOWN/unsupported로 보고하며 유효하다고 표시하지 않는다.

후속 full trace는 현재 생산 코드로 지원한다고 하지 않는다. 이번에는 PRM→CLR→Node trace를 구현하고 위 계약에 맞는 합성 후속 artifact adapter fixture로 DAG/고아/우회 경로 보존을 검사한다. Change 05~09에서 실제 reader/schema가 생길 때 연결을 검증한다. 새로운 provenance 중앙 파일이나 Node.source_refs를 만들지 않는다. 변경/대체는 stable ID와 기존 기록 보존, 새 artifact/명시적 대체 참조로 추적한다. 사라진 ID를 가까운 새 Node로 자동 치환하지 않는다.

### D8. 검증 책임과 Skill

CLI: schema, unique IDs, refs, type/kind, cycle, approval fields/hash, effective state, fingerprint, graph traversal. AI: 관계 추론·근거의 타당성, 조건 교집합·모순 가능성, 잘못된 가설 반례, 누락 관계, exception 부분집합. 사용자는 관계 승인·거부와 근거를 결정한다. exception_of confirmed만으로 정책 충돌 해소나 우선순위 결정을 생략하지 않는다(Change 07 소유).

Graph Skill에는 목적/입력/출력/필수 필드/금지 행동/질문 조건/완료 조건/CLI 검증 명령을 포함한다. AI가 삼각형 충돌을 기계 cycle 오류로 혼동하거나, “먼저”를 depends_on으로 바꾸거나, 원문 explicit_text를 confirmed로 자동 승격하는 경우를 의미 평가에서 별도로 측정한다. 실제 발언이 없으면 proposed와 미완료를 유지한다.

### D9. 9-Phase와 stage 키의 차이

v0의 9개 키가 곧 새 9-Phase가 아니다. v1은 기존 저장 키를 유지하고 **2개만 추가**한다.

| Phase | v1 저장 키 | 처리 |
|---|---|---|
| 1 Prompt Input | ingest | 그대로; 새 intake 이름의 중복 키 없음 |
| 2 Clarification | discover | 그대로 |
| 3 Atomic Node Modeling | atomic_modeling | 새 키, 초기 not_started |
| 4 Graph & Impact Analysis | graph_analysis | 새 키, 초기 not_started |
| 5 Challenge | challenge | 그대로 |
| 6 Proposal & Decision | propose + decide | 두 상태를 분리 보존, phase 완료는 둘 다 done |
| 7 Product Definition & Policy | define | 그대로 |
| 8 Validation & Approval Gate | validate | 그대로; review는 deprecated 메모로 보존 |
| 9 OpenSpec Bridge | export | 그대로 |

따라서 v1은 11개 stage 키다. 정확히 9개로 rename/merge하는 대안은 기존 API·재직렬화·정보 손실 때문에 기각한다. stage는 진행 메모이며 Graph status/최신성은 실제 artifact에서 계산한다. v0 model은 기존처럼 stage를 쓰지 않는다. v1 model은 재계산 결과에 따라 atomic_modeling만, graph 명령은 graph_analysis만 갱신한다. stale/incomplete이면 done 금지다. 기존 intake/clarify의 ingest/discover 동작과 나머지 값 불변을 회귀 검사한다.

### D10. 변경할 파일 (구현 승인 이후)

| 구분 | 파일 |
|---|---|
| 신규 | src/schema/graph.ts (Edge/Candidate), src/schema/impact.ts, src/clarification/graph.ts, src/clarification/provenance.ts, src/clarification/migration.ts, src/cli/commands/graph.ts, src/cli/commands/migrate.ts |
| 수정 | src/schema/config.ts(v0/v1), src/clarification/workspace.ts(YAML 보존 stage writer), src/cli/program.ts, src/cli/commands/model.ts(v1 stage만), src/index.ts, src/workspace/plan.ts, templates/product/config.yaml |
| 신규 안내 | skills/graph/SKILL.md, templates/product/graph/README.md |
| 신규 테스트 | tests/graph.test.ts, tests/impact.test.ts, tests/provenance.test.ts, tests/migration.test.ts |
| 회귀 테스트 수정 | tests/config-schema.test.ts, tests/init.test.ts, tests/packaging.test.ts, tests/intake.test.ts, tests/clarify.test.ts, tests/model.test.ts, tests/cli.test.ts |
| 별도 문서 승인 후 | docs/architecture.md, docs/roadmap.md, docs/artifact-contracts.md, README.md; CONSTITUTION.md 원칙 자체 변경 불필요 |

기존 Node/CLR schema와 source 파일은 이 change에서 수정하지 않는다. 발견된 Change 02~03 결함 수정 파일은 verification.md의 별도 승인 범위다. package version은 0.1.0을 유지하는 설계이며 배포 version 정책은 별도 릴리스 결정이다. workspace/Graph/Impact 계약 version만 1, rules_version은 graph-impact/1이다.

### D11. 명시적 v0→v1 migration

자동 ensureWorkspace migration은 Constitution 10 및 Change 01의 init 보존, Change 02의 schema_version 불변과 충돌하므로 채택하지 않는다. `productkit migrate [--dry-run | --resume | --rollback]`만 config를 변환한다. 기존 명령은 v0/v1을 각각 파싱하며 알 수 없는 버전은 쓰기 없이 코드 2로 거부한다. 새 init은 v1, 기존 init 재실행은 config를 수정하지 않고 없는 디렉터리만 추가한다.

YAML Document 편집으로 schema_version과 두 새 stage만 바꾼다. unknown 필드·사용자 stage 확장·comments·product 정보·definition·review 포함 모든 기존 값은 보존한다. unknown 값을 제거하는 Zod parse→stringify를 쓰지 않는다. migration 외 기존 stage writer도 이 보존 규칙을 지켜야 한다. 기존 알려진 필드의 schema 오류, 중복 YAML key, 두 새 stage와 충돌하는 v0 확장 값은 사전 오류로 거부한다. v0의 임의 새 stage 값을 덮어쓰지 않는다.

로컬 단일 workspace transaction:

1. read-only preflight로 config/YAML/graph 경로 충돌/기존 backup·journal 일관성을 확인하고 source byte hash와 plan을 표시한다. dry-run은 lock/backup/journal도 쓰지 않는다.
2. product/.migration-v0-v1.lock을 exclusive 생성한다. 동시에 기존 CLI가 config를 쓰면 lock을 확인해 거부한다. stale lock은 PID 존재와 journal 상태를 확인한 `--resume`만 회수하며 자동 삭제하지 않는다.
3. 원본 바이트를 config.yaml.v0.bak에 exclusive 임시 쓰기→flush→no-replace publish한다. 이미 있는 backup을 조용히 신뢰/덮어쓰지 않는다. journal에 같은 source hash가 있을 때만 재사용한다. backup만 있고 journal이 없으면 원본과 byte hash가 일치할 때 새 journal로 adopt하며 다르면 중단한다.
4. `.migration-v0-v1.json` journal에 migration id/source hash/target hash/backup hash/state=prepared를 원자적으로 기록한다. target temp에 v1을 쓰고 schema와 보존 diff를 검사한다. current config source hash를 다시 비교한다.
5. 같은 디렉터리 rename으로 config를 commit하고 flush한다. 그 뒤 journal=committed를 기록한다. graph/ 없는 부분은 이후 init이 추가할 수 있어 transaction에는 config/backup/journal만 포함한다.
6. config target hash와 v1 schema 재확인 후 lock 해제. backup과 journal은 유지한다. 재실행은 정상 v1이면 no-op이며 backup을 새로 만들지 않는다. prepared journal+target config이면 commit 후 중단으로 인식해 committed만 마무리한다.

실패/복구: backup/temp/journal 쓰기 실패와 config rename 전 중단은 원본 config 바이트 보존. rename 후 중단은 유효한 v1 또는 v0 중 하나만 남고 prepared/실제 hash 조합으로 --resume한다. source/target 어느 hash도 아니면 외부 수정으로 중단하고 사용자가 파일을 검토하게 한다. --rollback은 backup hash 검증 및 현재 config=transaction target hash일 때만 backup을 임시→rename으로 복원한다. 이미 v0/source hash이면 no-op, rollback 뒤 재실행도 안전하다. migration 후 사용자가 변경한 config에는 rollback을 자동 덮어쓰지 않고 보존한다. graph/Nodes/후속 artifact는 rollback으로 삭제하지 않는다. 전원 손실 내구성은 filesystem의 flush/rename 보장 범위이며 보장 불가능 환경은 사전 오류/지원 한계로 보고한다.

## Risks / Trade-offs

- 로컬 확인 기록은 위조 가능 → 실제 대화 근거를 별도로 검토; 해시를 인증이라고 하지 않음.
- 전체 snapshot은 무관한 입력에도 report stale → 재분석 비용을 수용하며 edge 확인은 개별 endpoint에 한정.
- 선행 단계 완료 판정 공백 → Graph 경계 검증으로 유입 차단, 기존 명령 결함은 별도 수정 승인 전 NO-GO.
- 미지원 Candidate는 손실 없이 저장하지만 영향 보고서는 incomplete다. Candidate는 승인된 관계가 아니며 의미적 진실을 보장하지 않는다.
- 후속 trace reader 미구현 → 합성 fixture는 미래 계약 검증이며 실제 Policy/OpenSpec E2E와 구분.

## Migration Plan

D11의 단일 버전 migration만 구현한다. 현재 사용자 workspace에서 실행하지 않는다. 출시 전 v0/v1 명령 회귀, 모든 transaction 경계 중단·재개·rollback·중복 실행·쓰기 실패와 byte 보존을 테스트한다. 선행 spec archive 의존성은 verification.md 참조; 실제 archive는 별도 승인 후 수행한다.
