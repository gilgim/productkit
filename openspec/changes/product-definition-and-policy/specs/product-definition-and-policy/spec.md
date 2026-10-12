# Spec Delta

## Purpose

This capability applies explicit user Decisions to versioned product artifacts and creates a traceable Product Definition with reviewable policies. It separates application, verification, Finding resolution, and final approval while preserving uncertainty and source lineage.

## ADDED Requirements

### Requirement: Decision Application은 불변 Decision과 실제 대상 변경을 연결한다
각 Application은 고유 ID, 현재 Decision ID/hash, 범위, typed 대상 참조, 기준/결과 hash, 변경 계획, 근거, 관련 Finding, 잔여 위험, 상태 및 append-only 이력을 기록해야 한다(SHALL).

#### Scenario: Decision 기록만으로 적용 처리 금지
- **WHEN** Decision이 존재하지만 적용 대상 파일이 변경되지 않았다
- **THEN** Decision은 `pending_application`으로 유지되고 Application 상태는 applied가 될 수 없다
- **AND** Finding 상태와 Product Definition 승인 상태는 바뀌지 않는다

#### Scenario: 미리보기와 기준 hash 충돌
- **WHEN** 사용자가 적용 계획을 미리 보고 확정했지만 실제 쓰기 전에 대상 hash가 기준 hash와 다르다
- **THEN** 적용은 첫 쓰기 전에 차단되고 충돌 대상과 현재/기준 hash를 보고한다
- **AND** 기존 대상과 Decision은 보존된다

#### Scenario: Decision hash가 stale
- **WHEN** Application이 참조하는 Decision이 없거나 현재 Decision hash와 기록 hash가 다르다
- **THEN** 적용 및 검증을 차단하고 Application 후보를 stale로 표시한다

### Requirement: 여러 Artifact 적용은 저널 기반 복구와 재실행 안전성을 갖는다
여러 대상 적용은 전체 사전 검증, 미리보기, 기준 hash 비교, 단계별 기록, 참조 무결성 검사를 수행해야 하며 단일 파일 rename을 다중 파일 원자성으로 주장해서는 안 된다(SHALL).

#### Scenario: 여러 대상의 정상 적용
- **WHEN** Decision 적용 계획이 여러 Node/Policy/Definition 대상을 포함하고 모든 기준 hash가 일치한다
- **THEN** 모든 변경은 기록된 순서로 수행되고 각 결과 hash와 참조 무결성을 검증한 뒤에만 Application이 applied가 된다
- **AND** before/after 상태와 이력은 보존된다

#### Scenario: 적용 중단 후 재개
- **WHEN** 파일 일부만 게시된 상태에서 프로세스가 중단된다
- **THEN** Application은 `partially_applied` 또는 `recovery_required`로 남고 저널·백업·각 파일 hash를 보고한다
- **AND** 재개는 각 대상이 기록된 before 또는 after hash인 경우에만 계속하며 다른 값은 차단한다

#### Scenario: 쓰기 실패와 보수적 복구
- **WHEN** 임시 쓰기, flush, publish 또는 후속 참조 검증이 실패한다
- **THEN** 실패 전 기존 Decision과 비대상 데이터는 보존되고 부분 상태는 실패로 기록된다
- **AND** 자동 복구는 현재 파일이 해당 트랜잭션의 예상 after hash와 일치할 때만 그 파일을 되돌리며, 불일치 시 덮어쓰지 않고 중단한다

#### Scenario: 동일 적용 요청 재실행
- **WHEN** 동일 Decision hash와 계획 hash의 적용 요청을 다시 실행한다
- **THEN** 동일 Application을 재사용하거나 완료 상태를 보고하고 중복 변경/기록을 만들지 않는다
- **AND** 다른 계획이나 입력 hash는 기존 Application을 덮어쓰지 않고 새 검토 또는 충돌로 처리한다

### Requirement: Decision 적용과 적용 후 검증은 별도 상태다
Application 상태와 의미 검증 상태는 별도로 보존되어야 하며 적용 성공만으로 의미적 해결을 주장해서는 안 된다(SHALL).

#### Scenario: 적용 성공 후 검증 대기
- **WHEN** 모든 대상 변경과 구조 검증이 성공했다
- **THEN** Application은 applied이고 verification은 pending으로 기록될 수 있다
- **AND** 결과를 Finding resolved 또는 Product Definition approved로 표시하지 않는다

#### Scenario: 의미 검증 결과 기록
- **WHEN** 검토자가 현재 입력 snapshot에 대해 적용 결과를 검토한다
- **THEN** 검증 기록은 verified, failed, inconclusive 중 하나와 범위·근거·불확실성·입력 hash를 보존한다
- **AND** CLI 구조 PASS와 AI 의미 평가 결과를 별도로 표시한다

#### Scenario: 변경 뒤 검증 stale
- **WHEN** 검증 후 대상 Node, Graph, Edge, RelationCandidate, Policy, Finding, Decision 또는 검증 규칙이 바뀐다
- **THEN** 과거 검증 기록은 보존하되 current 결과로 재사용하지 않고 stale로 보고한다

### Requirement: Product Definition은 현재 근거에 기반한 버전 있는 산출물이다
Product Definition은 제품 목표/범위, 사용자/이해관계자, 기능·비기능 요구사항, Journey, 정책, Acceptance Criteria, 명시적 제외, 미해결 Finding/Assumption 및 추적성을 포함해야 하며 각 내용의 출처 유형과 current hash를 기록해야 한다(SHALL).

#### Scenario: 확정 근거를 통한 Definition 생성
- **WHEN** 현재 Node와 명시적 사용자 Decision으로 Definition 초안을 생성한다
- **THEN** 각 제품 행동/정책은 typed source refs 및 hash와 함께 source, ai_inference 또는 user_decision으로 구분된다
- **AND** 원문·사용자 발언·AI 추론을 서로 바꾸어 표현하지 않고 Prompt까지의 기존 provenance chain을 유지한다

#### Scenario: 근거 범위를 넘어서는 행동 발견
- **WHEN** Definition 생성 중 Node나 현재 Decision에 없는 제품 행동이 필요해 보인다
- **THEN** 해당 행동을 확정 요구사항으로 추가하지 않고 Finding/Proposal 검토 대상으로 연결한다
- **AND** 미해결 범위는 Definition에 그대로 표시한다

#### Scenario: Decision부터 Prompt까지의 필수 출처 경로
- **WHEN** 제품 행동 또는 규범적 Definition 항목을 생성한다
- **THEN** 현재 Decision과 그 Decision에서 원본 Prompt까지의 해소 가능한 provenance 경로를 참조한다
- **AND** Node/Clarification 근거만 있고 Decision 경로가 없는 항목은 확정 Definition에서 차단한다

#### Scenario: Critical scope exclusion 반영
- **WHEN** 현재 scope_exclusion Decision을 Product Definition에 적용한다
- **THEN** 제외 범위, 영향, 잔여 위험, Decision 참조가 명시적 제외 항목에 기록된다
- **AND** Critical Finding은 위험이 삭제되거나 해결된 것으로 표현되지 않는다

#### Scenario: Definition 생성과 최종 승인 분리
- **WHEN** Definition 구조 검증이 성공한다
- **THEN** 산출물은 draft/generated 상태로 남고 Change 08 승인 상태를 만들거나 변경하지 않는다

### Requirement: Policy는 적용 문맥과 조건, 행동, 예외를 구조화한다
각 Policy는 Context, Actor, Condition, Action, Outcome, Exception, Priority 및 provenance를 기록하고 Natural Language 원문과 구조 조건을 구분해야 한다(SHALL).

#### Scenario: 논리 조건의 의미 보존
- **WHEN** 정책에 AND/OR/NOT, 수량, 시간 범위, 적용 대상 또는 예외가 포함되어 구조화된다
- **THEN** 연산자 괄호, 단위, 시간대/범위, 적용 대상 및 예외 범위가 명시적으로 보존되거나 미확정으로 표시된다
- **AND** 해석되지 않은 자연어를 임의의 실행 조건으로 변환하지 않는다

#### Scenario: Priority 출처 검증
- **WHEN** 정책 우선순위가 설정된다
- **THEN** 우선순위는 현재 사용자 Decision을 참조해야 하며 AI 추론만으로 새 우선순위를 선택할 수 없다
- **AND** Decision이 없거나 stale이면 priority는 미정으로 남는다

#### Scenario: 지원하지 않는 조건 연산
- **WHEN** 조건 연산자, 타입, 단위 또는 비교 의미가 결정적 지원 범위 밖이다
- **THEN** 구조 분석은 inconclusive/blocked 후보를 표시하고 정책 충돌 없음으로 해석하지 않는다

### Requirement: 정책 일관성 검증은 충돌 후보와 의미 판정을 분리한다
시스템은 실제 상충, 명시적 예외, 대체, 독립 조건, 조건부 제약 및 판정 불가 후보를 구분하며 예외나 조건 교집합만으로 충돌을 확정 또는 해소해서는 안 된다(SHALL).

#### Scenario: 실제 상충 후보
- **WHEN** 동일한 적용 문맥과 호환 조건에서 두 정책이 서로 양립할 수 없는 결과를 요구한다고 AI가 판단한다
- **THEN** 두 Policy, 근거, 반례, 불확실성 및 관련 Finding을 연결한 proposed 충돌 후보를 기록한다
- **AND** CLI는 이를 의미적으로 확정하지 않고 우선순위를 선택하지 않는다

#### Scenario: 단순 조건부 제약
- **WHEN** 한 정책이 일반 규칙의 적용 대상 일부에 추가 제약을 둔다
- **THEN** 조건 교집합만으로 충돌을 확정하지 않고 독립 제약 또는 미확정 후보로 분류한다

#### Scenario: 명시적 예외 후보
- **WHEN** `exception_of` 관계 또는 Policy exception이 발견된다
- **THEN** 예외 적용 범위와 Decision 근거를 별도 평가하고, 단지 예외 관계가 있다는 이유만으로 충돌 후보를 제거하지 않는다

#### Scenario: 대체 또는 중복 후보
- **WHEN** Policy에 `supersedes` 또는 `duplicates` Graph 관계가 있다
- **THEN** 기존 Policy와 교체/중복 후보는 추적 가능하게 보존되고 자동 삭제·승자 선택 없이 검토 대상으로 표시된다

#### Scenario: 판단 불가 후보
- **WHEN** 조건/행동 관계를 결정적으로 비교할 수 없고 AI 평가도 불확실하다
- **THEN** 결과를 inconclusive로 유지하고 관련 Node/Policy/Graph 및 Finding 후보와 연결한다
- **AND** 충돌 없음으로 보고하지 않는다

### Requirement: Change 07 영향 분석은 최신 Graph 결과와 불완전성을 보존한다
Decision 적용 전후 영향 보고서는 현재 입력 fingerprint, 규칙 버전, 확정 영향, 잠재 영향, 검토 후보, 차단 입력 및 미검토 범위를 보존해야 한다(SHALL).

#### Scenario: 적용 전후 영향 비교
- **WHEN** Decision을 적용할 계획 또는 적용 결과가 있다
- **THEN** 계획 시 current before ImpactReport를 검증하고, 실제 적용 완료 직후 after ImpactReport를 재계산해 Application 기록에 append한다
- **AND** 각 보고서 ID, 입력 fingerprint, completeness, 확정/잠재/검토 후보 및 blocked inputs를 Application에 연결한다

#### Scenario: 불완전 분석의 영향 부재 주장 차단
- **WHEN** ImpactReport에 blocked input, potential impact 또는 미검토 범위가 있다
- **THEN** 해당 불확실성은 결과와 Definition 검토에 노출된다
- **AND** 영향 없음 또는 완전한 분석이라고 보고하지 않는다

#### Scenario: 변경 영향이 Challenge/Decision 검토로 회귀
- **WHEN** 적용 후 새로운 Policy 충돌 후보나 Node/Graph 영향이 발견된다
- **THEN** 관련 Challenge/Finding 및 새 사용자 Decision 검토 후보를 생성하거나 참조하고 자동 정책 변경을 하지 않는다

### Requirement: Change 07은 Finding resolution과 Change 08 승인을 변경하지 않는다
Change 07은 기존 Finding `review_status` 및 `resolution_status`를 변경해서는 안 되며 Definition 생성·적용 검증·최종 승인 가능성을 서로 분리해야 한다(MUST).

#### Scenario: 검증된 적용 뒤에도 Finding 보존
- **WHEN** Application 검증이 verified로 기록되지만 대상 Finding이 있다
- **THEN** Finding의 상태와 확인 이력은 byte-for-byte 또는 의미적으로 불변하게 보존된다
- **AND** Change 08이 소비할 해결 근거와 현재 hash를 제공할 뿐 Finding resolved 상태를 선점하지 않는다

#### Scenario: Critical 위험 보존
- **WHEN** Critical Finding이 unresolved이거나 scope exclusion Decision이 적용됐다
- **THEN** Definition과 readiness evidence에는 Finding 및 잔여 위험이 계속 표시된다
- **AND** scope exclusion은 resolved 또는 risk-free로 바뀌지 않는다

#### Scenario: 사용자 발언의 인증 한계
- **WHEN** CLI가 Decision 또는 Application의 사용자 확인 기록을 검증한다
- **THEN** 구조, 참조, hash 일치만 판정하고 실제 발언자 신원·발언 진위를 증명한다고 표시하지 않는다

### Requirement: Definition, Policy, Application 증거 참조는 typed 및 hash-bound다
Definition, Policy, Application, Finding, Decision, Node, Graph 및 Prompt 사이의 참조는 허용된 타입과 현재 hash로 검증되어야 하며 의미적 관계와 provenance 관계를 혼합해서는 안 된다(SHALL).

#### Scenario: 추적성 chain 검증
- **WHEN** Definition 항목이 Node/Decision을 통해 Prompt에 연결된다
- **THEN** CLI는 각 참조가 존재하고 허용된 타입이며 hash와 lineage가 현재인지 결정적으로 검증한다
- **AND** 모든 산출물이 하나의 고정 경로를 거친다고 강제하지 않고 서로 다른 유효 경로를 보존한다

#### Scenario: Policy 대상 Finding 연결
- **WHEN** Policy 또는 Definition 관련 충돌/왜곡 후보를 Finding으로 기록한다
- **THEN** Finding의 typed refs/evidence는 Policy, Definition 또는 Application을 명시할 수 있고 현재 hash를 포함한다
- **AND** 참조 누락 또는 타입 불일치는 차단된다

#### Scenario: provenance를 Graph Edge로 대체하지 않음
- **WHEN** artifact가 생성 근거와 Node 사이의 의미 관계를 함께 갖는다
- **THEN** 생성 근거는 typed provenance refs에 기록하고 Content Graph Edge는 의미적 Node 관계에만 사용한다

#### Scenario: 변경 이후 추적성 stale
- **WHEN** 관련 Prompt, Node, Decision, Policy, Definition 또는 규칙이 바뀐다
- **THEN** 과거 Definition/Application/검증은 보존되지만 현재 결과로 쓰지 않고 stale로 표시한다

### Requirement: CLI 구조 검증과 AI 정책 의미 평가는 분리된다
CLI는 schema, 타입/참조, hash, 지원 연산자, 대상 비교, 순환 및 저널 상태처럼 결정 가능한 검증만 수행해야 하며 AI는 의미적 충돌, 범위, 반례 및 누락을 평가해야 한다(SHALL).

#### Scenario: 구조 검증 PASS의 범위
- **WHEN** Definition, Policy, Application 구조 검증이 통과한다
- **THEN** CLI는 구조 유효성으로만 결과를 표시하고 정책의 의미적 정확성, 충돌 부재, Finding 해결 또는 사용자 진위를 증명했다고 표현하지 않는다

#### Scenario: AI가 찾은 의미 후보
- **WHEN** AI가 충돌/중복/예외 범위 또는 원문 왜곡을 지적한다
- **THEN** 그 결과는 근거·반례·불확실성을 가진 제안으로 기록되고 사용자 확인 또는 Decision 전까지 확정/적용되지 않는다
