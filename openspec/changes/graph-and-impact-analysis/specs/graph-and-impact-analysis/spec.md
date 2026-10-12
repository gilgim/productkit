# Spec Delta

## Purpose

원자적 Content Node 사이의 관계 가설·사용자 확인·변경 영향 후보를 분리하여 추적한다. 결정적 구조 검증과 AI 의미 평가의 책임을 구별하고, 관계의 방향과 출처 최신성을 보존해 변경 후 검토 대상을 재현 가능하게 제공한다.

## ADDED Requirements

### Requirement: Content Graph는 채택된 Node 관계만 저장한다

시스템은 Node endpoint와 닫힌 관계 집합 depends_on/precedes/conflicts_with/duplicates/supersedes/exception_of만 허용해야 한다(SHALL). contains/causes와 workflow artifact endpoint는 거부해야 한다(MUST). 허용 kind 조합과 방향은 design D2 계약을 따라야 한다(SHALL).

#### Scenario: T01 정상적인 의존 관계 생성
- **WHEN** 유효한 requirement B가 requirement A를 필요로 한다는 AI 가설을 기록한다
- **THEN** source=B, target=A, type=depends_on, status=proposed 관계가 구조 검증을 통과한다
- **AND** 관계가 실제로 타당하다는 의미 판정은 별도로 남는다

#### Scenario: T02 잘못된 관계 타입 거부
- **WHEN** type=related_to 또는 보류된 contains/causes 관계를 제출한다
- **THEN** Edge 생성은 거부하고 기존 Graph를 바꾸지 않는다
- **AND** 발견된 가설은 아래 RelationCandidate 계약으로 보존한다

#### Scenario: 허용되지 않은 kind 또는 레이어 거부
- **WHEN** fact→policy depends_on 또는 PRM/CLR/NDG를 endpoint로 제출한다
- **THEN** 허용 kind 또는 Content 레이어 오류로 거부한다

### Requirement: 지원하지 않는 관계 가설은 별도 Candidate로 보존한다

시스템은 지원하지 않는 관계 가설을 Graph Edge로 생성하거나 임의의 지원 타입으로 변환해서는 안 된다(MUST NOT). 발견된 가설은 `product/graph/candidates/RLC-<fingerprint>.yaml`의 개별 RelationCandidate로 보존해야 한다(SHALL). 최소 필드는 candidate ID, 원본 관계명, source/target Node ID, AI 제안 의미, 근거 참조, review_status, 생성 시각, 양 endpoint의 Node snapshot hash다. 신규 상태는 pending이며 reviewed/dismissed 상태는 Candidate 검토만 뜻하고 관계 승인·confirmed를 뜻하지 않는다.

Candidate fingerprint는 원본 관계명·양 endpoint ID와 snapshot hash·의미·정렬된 근거 참조를 포함한다. 동일한 가설을 다시 제출하면 동일 파일을 중복 생성하지 않는다. 같은 ID 파일의 내용이 fingerprint와 일치하지 않으면 오류로 중단하고 기존 파일을 보존한다. Node snapshot이 변하면 과거 Candidate는 보존하고 stale로 표시해 근거를 재검토한다. ImpactReport는 미지원 후보의 ID와 `unsupported_relation_type` 제외 이유를 `blocked_inputs`에 참조하고, 후보를 영향 전파에 포함하지 않으며, 하나 이상 존재하면 report completeness를 incomplete로 표시해야 한다(SHALL).

#### Scenario: 지원하지 않는 causes 발견 → Candidate 보존
- **WHEN** Agent가 두 Node 사이의 causes 가설을 발견해 Candidate 입력을 제출한다
- **THEN** 원본 관계명, 의미, 양 Node ID, 근거, 시각, snapshot hash를 가진 Candidate 파일이 생기고 Edge는 생성되지 않는다

#### Scenario: 지원하지 않는 contains 발견 → Candidate 보존
- **WHEN** Agent가 전체/부분 의미의 contains 가설을 발견한다
- **THEN** Candidate 파일에 contains 가설을 보존하고 기존 Node 및 Graph Edge는 바꾸지 않는다

#### Scenario: 지원하지 않는 관계의 자동 Edge 생성 차단
- **WHEN** Candidate가 pending 또는 reviewed 상태다
- **THEN** Graph Edge로 자동 변환되지 않고 confirmed/potential 영향 계산에 참여하지 않는다

#### Scenario: 관계 후보가 ImpactReport에서 누락되지 않음
- **WHEN** 하나 이상의 현재 또는 stale RelationCandidate가 있는 입력으로 impact를 계산한다
- **THEN** 각 후보 ID와 분석 제외 이유가 blocked_inputs에 참조되고 report는 incomplete다

#### Scenario: Node 변경 후 Candidate 근거 무효화
- **WHEN** Candidate 생성 후 source 또는 target Node snapshot이 달라진다
- **THEN** 기존 Candidate 파일은 보존되고 stale로 표시되며 최신 관계 판단에 재사용하지 않는다

#### Scenario: 동일 가설 재실행 중복 기록 방지
- **WHEN** 동일한 관계명·endpoint snapshot·의미·근거로 Candidate를 다시 제출한다
- **THEN** 같은 fingerprint ID를 반환하고 Candidate 파일을 추가하거나 덮어쓰지 않는다

#### Scenario: Candidate 파일 쓰기 실패
- **WHEN** Candidate 임시 쓰기·flush·publish가 실패한다
- **THEN** 기존 Candidate 파일은 byte-for-byte 보존되고 부분 파일이 최종 Candidate로 보이지 않는다

### Requirement: 관계의 사용자 확인은 현재 승인 대상과 결합한다

관계 확정에는 실제 사용자 발언, 이유, 대상 Edge ID, 현재 주장 해시, endpoint 출처 snapshot 해시와 확인 기록 해시가 필요하다(SHALL). AI 추론·원문 근거·Challenge 무이의·Clarification 확인으로 자동 확정해서는 안 된다(MUST NOT). 기록의 진위를 CLI가 증명했다고 표시해서는 안 된다(MUST NOT).

#### Scenario: T03 AI 관계 자동 확정 차단
- **WHEN** explicit_text 근거와 Challenge 무이의만 있고 실제 확인 기록 없이 status=confirmed를 제출한다
- **THEN** 구조 검증은 확인 누락으로 실패한다
- **AND** 원문과 AI 가설만 있는 관계는 proposed로 유지한다

#### Scenario: T04 명시적 사용자 확인 후 확정
- **WHEN** 사용자가 제시된 Edge와 근거를 명시적으로 승인하고 이유를 밝히며 현재 claim/endpoint 해시에 결합된 agreed 항목이 추가된다
- **THEN** 참조·타입·순환·전체 확인 이력 해시가 유효한 경우에만 fresh confirmed로 판정한다
- **AND** 출력은 사용자 발언의 진위나 의미 정확성은 검증하지 못함을 고지한다

#### Scenario: 사용자 거부와 재결정
- **WHEN** 최신 유효 확인이 disagreed이고 실제 발언과 이유가 있다
- **THEN** 관계는 rejected로 판정되고 모든 영향 탐색에서 제외된다
- **AND** 재결정은 새 확인 항목으로 기록하며 이전 항목은 보존한다

#### Scenario: 확인 변조 또는 근거 수정
- **WHEN** 과거 확인 항목의 내용이 entry_hash와 불일치하거나 현재 reason/basis가 승인 당시 claim과 달라진다
- **THEN** 전자는 무결성 FAIL, 후자는 STALE로 구분한다
- **AND** 어느 경우에도 기존 확정 관계로 사용하지 않는다

### Requirement: 관계 순환과 참조 무결성은 타입별로 검사한다

시스템은 Node/Edge ID 유일성과 모든 endpoint 해소를 검사해야 한다(SHALL). depends_on/precedes/supersedes/exception_of의 동일 타입 fresh confirmed cycle과 모든 self-edge는 거부해야 한다(MUST). 대칭 관계의 삼각형과 mixed-type cycle은 단일 directed cycle 오류로 거부해서는 안 된다(MUST NOT).

#### Scenario: T05 순환 금지와 허용 구분
- **WHEN** A depends_on B, B depends_on A를 확정하려 한다
- **THEN** 순환 경로와 Edge ID를 출력하고 새 확정을 거부한다
- **AND** A conflicts_with B, B conflicts_with C, C conflicts_with A는 허용한다

#### Scenario: 미확정 순환 경고와 탐색 종료
- **WHEN** proposed Edge를 포함할 때만 금지 타입의 순환이 생기거나 mixed-type cycle이 존재한다
- **THEN** proposed cycle은 경고하고 mixed-type cycle은 타입별 계약으로 검사한다
- **AND** 영향 탐색은 visited 상태로 유한하게 종료한다

#### Scenario: T06 존재하지 않는 Node 참조 거부
- **WHEN** endpoint가 존재하지 않거나 두 NodeGroup에 동일 Node ID가 있다
- **THEN** 구조 검증은 참조/중복 오류로 실패하며 임의의 Node로 대체하지 않는다

### Requirement: 영향 후보는 확정과 잠재 경로를 별도로 유지한다

시스템은 fresh confirmed만 거친 영향 경로와 proposed/stale을 하나라도 거친 잠재 경로를 분리해야 한다(SHALL). 잠재 후보를 조용히 누락하거나 같은 Node의 확정 경로 때문에 잠재 경로를 삭제해서는 안 된다(MUST NOT). 각 결과는 직접/간접 구분, 도달 경로, 관계 타입·방향·근거를 포함해야 한다(SHALL).

#### Scenario: T07 confirmed와 proposed 영향 분리
- **WHEN** B depends_on A는 confirmed, C depends_on A는 proposed, D depends_on C는 confirmed다
- **THEN** A 변경의 B는 확정 직접 후보, C는 잠재 직접 후보, D는 잠재 간접 후보다
- **AND** 동일 Node에 확정 경로와 잠재 경로가 모두 있으면 각 분류에 witness를 남긴다

#### Scenario: 경로 재현과 빈 목록
- **WHEN** 영향 보고서를 산출한다
- **THEN** 각 witness에는 Edge ID, type, basis, reason, traversal, effective status, freshness가 있다
- **AND** 동일 입력은 동일 최단 경로를 산출하며 빈 confirmed/potential/review 목록도 명시한다

### Requirement: 전파와 검토 방향은 관계별 계약을 따른다

depends_on은 target→source, exception_of는 기본 target→예외 source로만 전파해야 한다(SHALL). precedes source→target, exception_of source→target 및 conflicts_with/duplicates/supersedes 양방향은 terminal 검토 후보로만 처리해야 한다(SHALL). 검토 도달점에서 추가 전파해서는 안 된다(MUST NOT).

#### Scenario: T08 잘못된 방향의 영향 전파 차단
- **WHEN** B depends_on A에서 B가 변경된다
- **THEN** 그 관계만으로 A를 의존 영향 후보에 추가하지 않는다
- **AND** 기본 A의 예외 B에서 B 변경은 A 검토만, A 변경은 B 의존 영향 후보로 처리한다

#### Scenario: T09 충돌은 검토 후보로 처리
- **WHEN** B depends_on A, D conflicts_with B, E depends_on D이고 A가 변경된다
- **THEN** B는 의존 영향, D는 경로를 갖는 검토 후보가 된다
- **AND** 충돌 경로를 통하여 E까지 전파하지 않는다
- **AND** D의 우선순위 또는 자동 정책 변경을 생성하지 않는다

#### Scenario: 시간 순서와 중복 및 대체의 경계
- **WHEN** A precedes B 또는 A duplicates B 또는 A supersedes B에서 A가 변경된다
- **THEN** B는 검토 후보이며 의존 전파 frontier에 들어가지 않는다
- **AND** precedes에서 B 변경을 근거로 A까지 역방향 검토하지 않는다

### Requirement: Node 및 관계와 출처 변경은 기존 확정을 무효화한다

시스템은 승인 claim 또는 endpoint lineage snapshot이 현재 내용과 다르면 저장 confirmed를 그대로 사용해서는 안 된다(MUST NOT). 기록은 보존하고 effective proposed/stale로 계산해 잠재 결과에 남겨야 한다(SHALL). 해소 불가능한 참조는 제외 사유와 불완전 결과를 명시해야 한다(SHALL).

#### Scenario: T10 Node 변경 후 관계 확정 무효화
- **WHEN** confirmed 관계의 Node statement/kind/origin/derived_from 또는 출처 Clarification/Prompt 내용이 바뀐다
- **THEN** 해당 관계의 확정 사용은 무효화되고 새로운 명시적 확인을 요구한다
- **AND** 해소 가능한 stale 관계 경로는 잠재 후보에 경고와 함께 남는다
- **AND** 무관한 endpoint/claim의 관계 승인은 그대로 보존한다

#### Scenario: 원문 무결성과 신규 Prompt
- **WHEN** 기존 PRM raw_text와 저장 hash가 불일치하거나 신규 Prompt를 intake한다
- **THEN** 전자는 출처 오류를 보고하고 후자는 이전 Prompt를 자동 삭제·대체하지 않는다
- **AND** 새 Prompt의 supersedes/conflicts 관계는 AI 제안과 사용자 확인을 별도로 거친다

### Requirement: 분석 보고서는 현재 입력의 fingerprint로 최신성을 검사한다

보고서는 config version, 모든 Prompt/Clarification/Node/Edge와 관계 확인, 규칙 version을 포함하는 fingerprint를 가져야 한다(SHALL). 추가·삭제·수정 후 fingerprint가 다르면 현재 분석으로 재사용해서는 안 된다(MUST NOT). incomplete 입력은 경고와 비성공 종료로 보고해야 한다(SHALL).

#### Scenario: 원문 Node 관계와 승인 변경 후 STALE
- **WHEN** 보고서 생성 후 PRM, Node, Edge의 내용/상태/확인 또는 규칙 version 중 하나가 바뀌거나 새 Edge가 추가된다
- **THEN** 보고서 확인은 STALE을 출력하고 코드 1로 끝난다
- **AND** 보고서 자체 시각이나 파일명만 바뀐 경우 입력 fingerprint는 변하지 않는다

#### Scenario: 깨진 입력을 숨기지 않는 분석
- **WHEN** 일부 endpoint 또는 출처를 해소할 수 없다
- **THEN** 영향 결과에 blocked_inputs와 completeness=incomplete를 포함하고 코드 1로 끝난다
- **AND** 남은 부분 결과를 전체 확정 분석으로 표현하지 않는다

#### Scenario: 빈 Graph는 관계 부재의 증거가 아님
- **WHEN** 시작 Node가 존재하지만 Edge와 active RelationCandidate가 없는 상태에서 impact를 요청한다
- **THEN** 빈 결과를 구조적으로 계산할 수 있어도 completeness=incomplete와 관계 검토 미수행 경고를 출력한다

### Requirement: provenance는 기존 참조를 이용하며 Content Graph와 분리한다

Node→Clarification→Prompt는 기존 derived_from/prompt_ref/span_refs로 추적해야 한다(SHALL). 후속 출처는 기존 source_refs/finding_refs/proposal_ref/decision_refs 등 소유 artifact의 단방향 참조를 재사용해야 한다(SHALL). Content Edge로 provenance를 대체하거나 동일 Prompt 링크를 Node에 중복 저장해서는 안 된다(MUST NOT).

#### Scenario: T15 Prompt부터 후속 artifact까지 추적
- **WHEN** 합성 fixture에 PRM→CLR→NOD→FND→PROP→DEC→Policy→OpenSpec 경로와 DEC→PRM 직접 경로가 있다
- **THEN** 두 경로 모두 추적되며 모든 artifact에 동일한 중간 단계 경유를 강제하지 않는다
- **AND** 실제 CLI는 현재 지원 PRM/CLR/Node 범위만 구현 완료로 표시하고 future artifact reader는 UNKNOWN으로 구분한다
- **AND** 후속 change의 실제 schema/reader 연결은 별도 E2E 완료를 요구한다

#### Scenario: 고아와 derivation 순환
- **WHEN** derivation 참조가 없는 ID를 가리키거나 생성 출처 projection에 순환이 있다
- **THEN** 참조 오류 또는 출처 순환을 보고한다
- **AND** 독립적 Content Node를 고아 오류로 취급하지 않고 resolution_refs의 검토 연결을 생성 출처 순환에 섞지 않는다

### Requirement: CLI 구조 판정과 AI 의미 평가는 별도로 보고한다

CLI는 schema/참조/타입/순환/확인 해시/탐색/상태만 결정적으로 검증해야 한다(SHALL). AI는 관계 추론·의존 타당성·충돌 가능성·반례·누락을 평가해야 한다(SHALL). 구조 PASS를 의미적 정확성 또는 실제 사용자 동의 증거로 표현해서는 안 된다(MUST NOT).

#### Scenario: AI-S01 독립 행동과 공유 트리거
- **WHEN** 실제 Agent가 결제 완료 후 주문 확정/이메일/재고 차감 사례를 Skill로 분석한다
- **THEN** 행동별 독립성과 공유 트리거 보존을 별도 의미 평가로 기록한다
- **AND** 원문 순서만으로 depends_on/causes를 확정하지 않는다

#### Scenario: AI-S02 AND OR와 예외
- **WHEN** 실제 Agent가 로그인 실패 조건과 관리자 요청 OR 및 서비스 계정 예외를 분석한다
- **THEN** 괄호 결합/예외 범위가 불명확하면 Finding 후보와 질문으로 남긴다
- **AND** exception_of만으로 우선순위나 충돌 해소를 확정하지 않는다

#### Scenario: AI-S03 변경 또는 충돌 신규 요구
- **WHEN** 실제 Agent가 기존 7일 환불과 디지털 상품 30일 환불을 비교한다
- **THEN** 예외/충돌/대체의 가설과 근거·반례를 구분해 proposed로 제시한다
- **AND** 실제 사용자 승인 없는 Clarification/Edge/후속 Node 검증은 미완료로 보고한다

### Requirement: Graph 쓰기와 중복 실행은 기존 데이터를 보존한다

Graph/보고서는 임시 파일과 원자적 publish를 사용하고 실패 시 기존 파일을 보존해야 한다(SHALL). 기존 보고서 경로를 덮어써서는 안 된다(MUST NOT). 검증·탐색 재실행은 동일 snapshot에서 동일 결과를 내고 확인 이력을 추가하지 않아야 한다(SHALL).

#### Scenario: T13 중복 실행
- **WHEN** 같은 입력으로 graph validate/impact를 두 번 실행한다
- **THEN** 동일 후보와 상태가 출력되고 Edge/확인 이력은 변경되지 않는다
- **AND** 같은 보고서 출력 경로의 두 번째 쓰기는 코드 2로 거부한다

#### Scenario: T14 Graph 파일 쓰기 실패
- **WHEN** temp write/flush/publish 또는 동시 변경 검사가 실패한다
- **THEN** 실패 경로와 이유를 보고하고 기존 Graph/보고서 바이트를 보존한다
- **AND** 부분 파일을 최종 artifact로 사용하지 않는다
