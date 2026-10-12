# Spec Delta

## Purpose

This capability records evidence-backed alternatives and explicit user decisions for one or more Findings. It keeps decision recording distinct from applying the decision, verifying its meaning, resolving Findings, and approving the complete Product Definition.

## ADDED Requirements

### Requirement: Proposal은 하나 이상의 Finding에 대한 비교 가능한 대안을 보존한다
Proposal은 고유 ID, 하나 이상의 유효한 Finding 참조, 입력 snapshot/hash, 대안별 내용·근거·예상 영향·부작용·변경 대상 후보·잔여 문제, 생성 시각 및 변경 이력을 기록해야 한다(SHALL). 각 대안은 이점·비용·위험·가정도 포함해야 한다(SHALL).

#### Scenario: 하나의 Finding에 여러 대안 제시
- **WHEN** 하나의 Finding에 복수의 의미 있는 대안이 작성된다
- **THEN** 모든 대안이 각각의 근거, 영향, 부작용, 가정, 잔여 문제와 함께 같은 Finding 참조 아래 보존된다
- **AND** 대안 수를 채우기 위해 의미 없는 선택지를 만들지 않는다

#### Scenario: 여러 Finding을 묶는 Proposal
- **WHEN** 하나의 대안 묶음이 여러 Finding을 함께 다루도록 작성된다
- **THEN** Proposal은 대상 Finding 각각을 명시하고 대안별 해결 범위를 각 Finding에 연결한다
- **AND** 일부 Finding의 해결 여부를 전체 대상에 일괄 적용하지 않는다

#### Scenario: 근거 없는 Proposal 참조 거부
- **WHEN** Proposal이 존재하지 않거나 stale인 Finding 또는 입력을 참조한다
- **THEN** 구조 검증은 Proposal 저장 또는 선택을 차단하고 미해결 참조를 보고한다

### Requirement: AI 추천은 사용자 선택과 분리된다
AI는 Proposal의 대안을 추천할 수 있지만 추천은 비구속 상태여야 하며 Decision을 생성하거나 선택 상태로 바꾸지 않아야 한다(MUST NOT).

#### Scenario: AI 추천만 존재
- **WHEN** Proposal에 추천 대안과 추천 이유만 기록된다
- **THEN** Proposal은 pending 상태로 유지되고 Decision은 생성되지 않는다
- **AND** Finding은 기존 resolution_status를 유지한다

#### Scenario: 사용자가 Proposal 외의 대안 선택
- **WHEN** 사용자가 제안 목록에 없는 대안을 명시적으로 선택하거나 직접 결정을 작성한다
- **THEN** Decision은 사용자 직접 결정으로 선택 내용을 그대로 보존할 수 있다
- **AND** 선택 근거와 검토 snapshot을 기록하며 Proposal 대안 선택으로 가장하지 않는다

### Requirement: Decision은 실제 사용자 의사표현과 현재 대상 hash에 결합된다
Decision은 고유 ID, 대상 Proposal/대안 또는 사용자 직접 결정, 명시적 Finding 참조, 결정 유형·범위·실제 사용자 발언·rationale, 결정 대상 hash, 참조 Node/Graph/Policy 버전, 시각 및 append-only 이력을 기록해야 한다(SHALL).

#### Scenario: 사용자의 명시적 대안 선택 기록
- **WHEN** 사용자가 현재 Proposal의 대안을 선택하고 결정 문장과 이유를 제공한다
- **THEN** Decision은 선택한 대안 ID, 사용자 발언, rationale, Finding 대상 및 입력 snapshot에 결합되어 저장된다
- **AND** CLI는 구조와 hash 무결성만 검증하고 발언 진위를 증명했다고 주장하지 않는다

#### Scenario: 결정 근거나 사용자 발언 누락
- **WHEN** Decision 요청에 실제 사용자 발언 또는 rationale이 비어 있다
- **THEN** Decision 저장을 차단하고 필요한 사용자 입력을 요청한다

#### Scenario: 사용자 직접 결정
- **WHEN** 사용자가 Proposal 대안과 다른 결정을 내린다
- **THEN** 선택 원문을 direct_user_decision으로 보존하고 AI recommendation과 구별한다

#### Scenario: Proposal에 없는 option 참조
- **WHEN** Decision이 해당 Proposal에 없거나 그 Finding 범위를 포함하지 않는 option ID를 선택한다
- **THEN** 선택을 거부하고 Proposal/option/Finding 참조 불일치를 보고한다

### Requirement: Decision 생성과 수정은 명시적이고 append-only다
Decision은 실제 사용자의 명시적 응답으로만 생성되어야 한다(SHALL). 기존 결정을 바꿀 때는 새 Decision이 이전 Decision을 참조해 대체하며, 과거 artifact와 근거를 덮어쓰거나 삭제해서는 안 된다(MUST NOT).

#### Scenario: AI의 자동 Decision 확정 차단
- **WHEN** Agent가 사용자 발언 없이 Proposal 추천을 선택된 Decision으로 제출한다
- **THEN** Decision 생성은 거부되고 Proposal은 pending으로 남는다

#### Scenario: Decision 수정 이력 보존
- **WHEN** 사용자가 기존 Decision을 변경한다
- **THEN** 새 Decision은 이전 Decision ID를 supersedes로 기록하고 기존 Decision 파일은 보존된다
- **AND** 기존 Decision으로 연결된 Finding resolution 판정은 새 결정에 대해 재검증되기 전까지 stale 또는 무효로 보고된다

#### Scenario: 중복·상충 Decision 처리
- **WHEN** 동일 Finding과 동일 대상 snapshot에 상충하는 active Decision이 제출된다
- **THEN** 시스템은 충돌을 차단하거나 명시적 supersedes 관계를 요구하며 어느 선택도 조용히 승자로 취급하지 않는다

### Requirement: Change 06 Decision은 적용 대기 상태로만 기록된다
Change 06은 사용자 Decision을 `pending_application`으로 기록해야 하며, 실제 정책/Definition 적용 상태를 만들거나 변경해서는 안 된다(MUST NOT). 적용 여부는 Change 07 소유다.

#### Scenario: 미적용 Decision
- **WHEN** 사용자 결정은 기록됐지만 선택 대안이 Node/Policy/Product Definition에 적용되지 않았다
- **THEN** Decision은 pending_application으로 유지된다
- **AND** 대상 Finding은 resolved로 전이하지 않는다

#### Scenario: Change 06에서 적용 완료 전이 차단
- **WHEN** Change 06 경로가 Decision을 applied, partially_applied 또는 blocked로 전이하려 한다
- **THEN** 전이를 거부하고 `pending_application`으로 유지한다

#### Scenario: Change 07 적용 경계
- **WHEN** Decision이 Product Definition 또는 Policy 변경을 요구한다
- **THEN** Change 06은 선택과 요구 적용 대상을 기록하고 실제 Definition/Policy 생성은 Change 07에 남긴다
- **AND** Decision은 실제 적용 결과를 주장하지 않고 `pending_application`으로 남는다

### Requirement: Change 06은 Finding resolution 상태를 변경하지 않는다
Decision 기록만으로 Finding을 `resolved`, `deferred`, `dismissed`로 바꾸어서는 안 된다(MUST NOT). Change 06은 Finding resolution_status를 그대로 보존하며 적용·사후 의미 평가·resolution 판정은 후속 Change 책임이다.

#### Scenario: 무관한 Decision으로 해결 우회 차단
- **WHEN** Decision이 해당 Finding을 명시적으로 대상으로 하지 않거나 Finding hash가 다르다
- **THEN** Finding을 resolved로 전이하지 않고 참조 오류 또는 stale 상태를 보고한다

#### Scenario: Decision만으로 해결 처리 차단
- **WHEN** Decision이 생성됐지만 대상 대안의 적용 및 사후 검증은 수행되지 않았다
- **THEN** Finding의 resolution_status를 바꾸는 전이를 거부하고 원래 상태를 보존한다

#### Scenario: Finding 거부와 해결 상태 분리
- **WHEN** 사용자가 Finding의 존재를 거부한다
- **THEN** review_status는 rejected 확인 이력으로 기록되지만 resolution_status는 자동 변경되지 않는다
- **AND** 비Critical Finding의 dismissed 전이도 명시적 Decision과 rationale 없이는 허용하지 않는다

#### Scenario: Critical Finding 자동 해결 차단
- **WHEN** AI가 Critical Finding을 해결 또는 기각했다고 제출한다
- **THEN** Decision, 적용 증거, 최신 assessment가 없으면 전이를 거부하고 Finding을 활성 상태로 보존한다

#### Scenario: Finding 상태와 확인 이력 보존
- **WHEN** Decision이 저장된다
- **THEN** Change 05의 review_status, resolution_status, 확인 및 변경 이력은 변경되지 않는다
- **AND** 후속 Change가 적용·의미 검증·resolution을 수행하기 전까지 해결 완료를 표시하지 않는다

### Requirement: Critical Finding은 해결·기각·범위 제외 보호를 받는다
Critical Finding은 AI 단독 resolved/rejected/deferred/dismissed 전이를 허용하지 않아야 한다(MUST NOT). scope_exclusion은 해결과 별도 결정 유형이며 사용자 발언, 제외 범위, 위험·영향, rationale 및 Product Definition 반영 추적을 요구해야 한다(SHALL).

#### Scenario: Critical Finding 자동 유예·기각 차단
- **WHEN** Critical Finding을 명시적 사용자 Decision과 근거 없이 deferred 또는 dismissed로 바꾸려 한다
- **THEN** 전이를 거부하고 기존 Finding과 이력을 보존한다

#### Scenario: 명시적 Critical scope exclusion Decision
- **WHEN** 사용자가 Critical Finding을 범위에서 제외한다고 명시하고 제외 이유·영향·잔여 위험·적용 범위를 기록한다
- **THEN** 시스템은 scope_exclusion Decision을 기록하되 위험이 사라졌다고 표현하지 않는다
- **AND** Change 07에서 실제 Product Definition의 범위 변경이 확인되기 전까지 Finding은 unresolved로 남는다

#### Scenario: 범위 제외의 Definition 추적
- **WHEN** Change 07이 제외 결정을 Product Definition에 반영한다
- **THEN** Change 07은 적용 근거를 Decision에 연결하고 Change 08은 제외된 Critical 위험과 승인 근거를 별도로 검토할 수 있다

### Requirement: 참조 무결성, stale 상태와 안전한 재실행을 보장한다
Proposal, Decision, Finding, 적용 artifact 및 Review 참조는 typed ID와 현재 hash로 검증되어야 한다(SHALL). 입력 변경은 의존 Proposal/Decision/resolution 검토를 stale로 만들고, 재실행이나 저장 실패는 기존 기록을 덮어쓰지 않아야 한다(SHALL).

#### Scenario: Finding 변경으로 Proposal과 Decision stale
- **WHEN** Proposal 또는 Decision 이후 대상 Finding 내용이나 버전이 바뀐다
- **THEN** 이전 Proposal/Decision은 기록 보존 상태로 stale 판정되고 새 hash에 대한 재검토를 요구한다

#### Scenario: Graph/Node/Policy 변경 영향 후보
- **WHEN** Decision이 참조한 Node, Graph 또는 Policy가 변경된다
- **THEN** 연결된 Decision과 Finding resolution을 재검증 대상으로 표시하고 영향을 받은 경로와 hash를 보고한다

#### Scenario: 중단 후 재개와 중복 실행
- **WHEN** 같은 입력으로 Proposal/Decision 작업이 중단 후 재개되거나 재실행된다
- **THEN** 동일 ID와 checkpoint를 재사용하고 중복 Decision을 만들지 않는다
- **AND** 변경 입력에서는 기존 기록을 stale로 보존하고 새 revision 흐름을 시작한다

#### Scenario: 원자적 저장 실패
- **WHEN** Proposal, Decision 또는 resolution history의 임시 쓰기·flush·publish가 실패한다
- **THEN** 기존 파일은 byte-for-byte 보존되고 부분 파일은 완료된 artifact로 노출되지 않는다

### Requirement: Change 06은 Change 07 적용과 Change 08 최종 승인을 대체하지 않는다
Change 06 Decision은 선택·범위·근거를 확정하는 기록이며 Product Definition/Policy 적용이나 전체 Definition 승인이 아니다(SHALL). 미해결·미적용 또는 의미적으로 불확실한 Finding은 해결 완료로 표시해서는 안 된다(MUST NOT).

#### Scenario: 결정 기록은 있지만 최종 승인은 아직 불가
- **WHEN** Proposal이 결정됐지만 적용이 pending이거나 unresolved Critical Finding이 남아 있다
- **THEN** Change 06은 결정 기록을 보존하되 Product Definition readiness 또는 Change 08 approval을 PASS로 표시하지 않는다

#### Scenario: 구조 검증과 의미 검토 결과 분리
- **WHEN** CLI가 Decision 및 resolution schema/hash 검증을 통과한다
- **THEN** 결과는 구조 검증 PASS로만 표시되고 대안의 의미적 적합성·실제 발언 진위·문제 해결 사실의 증거로 표시되지 않는다

### Requirement: 사용자 결정으로 Assumption 수용 위험을 검증 완료처럼 표시하지 않는다
Finding에서 파생된 Assumption은 근거와 현재 상태를 보존해야 하며, 사용자가 미검증 위험을 수용한 경우 `accepted_risk`와 해당 Decision 참조로 기록해야 한다(SHALL).

#### Scenario: 미검증 위험의 명시적 수용
- **WHEN** 사용자가 검증되지 않은 Assumption을 위험으로 수용하기로 명시적으로 결정한다
- **THEN** Assumption은 `accepted_risk`로 기록되고 rationale과 Decision 참조를 가진다
- **AND** Assumption은 `verified`로 표시되지 않는다

#### Scenario: Decision 없는 Assumption 상태 승격 차단
- **WHEN** AI 또는 CLI가 Decision 참조 없이 Assumption을 verified 또는 accepted_risk로 바꾸려 한다
- **THEN** 근거 조건을 만족하지 않는 전이는 거부되고 기존 상태와 이력을 보존한다
