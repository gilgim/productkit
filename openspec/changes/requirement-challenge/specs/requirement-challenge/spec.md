# Spec Delta

## Purpose

Challenge records a bounded, evidence-based semantic review of current requirements and preserves potential defects for human review. It separates review coverage, whether a Finding is accepted, and how a Finding is resolved.

## ADDED Requirements

### Requirement: Finding은 근거·출처·평가와 이력을 보존한다
각 Finding은 고유 ID, 유형, 심각도, 설명, 관련 artifact 참조, 근거, 반례, AI 평가, 검토 상태, 사용자 확인, 해결 상태, 질문 및 변경 이력을 보유해야 한다(SHALL). 참조가 존재하지 않거나 허용되지 않은 타입이면 저장을 거부해야 한다(SHALL).

#### Scenario: 정상 요구사항에서 잘못된 Finding을 확정하지 않음
- **WHEN** 정상 흐름을 만족하는 Node에 AI가 근거 없는 Finding 후보를 제출한다
- **THEN** 후보는 AI 제안(`review_status: proposed`)으로만 저장되고 사용자 확인 없이 confirmed로 바뀌지 않는다
- **AND** 근거 또는 관련 출처가 해소되지 않으면 구조 검증이 저장을 차단한다

#### Scenario: Finding 중복 실행과 변경 이력
- **WHEN** 같은 범위·유형·문제 지문을 가진 Finding을 다시 제출한다
- **THEN** 기존 Finding ID를 재사용하고 덮어쓰기 대신 변화 기록을 append한다
- **AND** 내용이 다른 문제는 충돌로 합치지 않고 별도 Finding으로 남긴다

#### Scenario: Finding 참조 검증
- **WHEN** Finding이 없는 Node, Edge, Prompt 또는 ImpactReport를 참조한다
- **THEN** CLI는 구조 오류를 보고하고 기존 Finding 파일을 변경하지 않는다

### Requirement: Finding 확인과 해결은 사람이 구분해 관리한다
새 Finding은 미확인·미해결로 시작해야 한다(SHALL). 사용자 확인/거부에는 현재 Finding hash와 실제 발언 기록이 필요하며, 해결·유예·기각에는 Change 06 Decision 참조가 필요하다(SHALL). AI는 어느 전이도 스스로 수행해서는 안 된다(MUST NOT).

#### Scenario: Finding 사용자 확인
- **WHEN** 사용자가 특정 Finding이 실제 문제임을 명시적으로 확인한다
- **THEN** 확인 기록은 현재 Finding hash·사용자 발언·시각·entry hash에 결합된다
- **AND** 확인은 제품 해결이나 정책 결정으로 간주되지 않는다

#### Scenario: 확인 기록의 검증 한계
- **WHEN** CLI가 구조적으로 유효한 사용자 확인 기록을 검증한다
- **THEN** 현재 Finding hash와 entry hash의 무결성만 PASS로 표시한다
- **AND** 실제 발언자 신원 또는 기록된 발언의 진위를 증명했다고 표시하지 않는다

#### Scenario: Finding 자동 해결·기각 차단
- **WHEN** Agent가 Finding을 resolved, deferred, dismissed 또는 rejected로 직접 제출한다
- **THEN** 유효한 사용자 확인 또는 관련 Change 06 Decision 근거가 없는 상태 전이는 거부된다
- **AND** 기존 Finding과 이력은 그대로 보존된다

#### Scenario: Critical Finding 보존
- **WHEN** Critical Finding이 열려 있거나 해결 Decision이 없다
- **THEN** Finding은 활성 미해결로 계속 조회되고 Challenge 결과에 표시된다
- **AND** 단순 무시·Challenge 재실행·AI 자신감으로 사라지거나 유예/기각되지 않는다

#### Scenario: Critical Finding 범위 제외 결정
- **WHEN** Change 06 Decision이 해당 Critical Finding을 명시적인 scope exclusion으로 결정한다
- **THEN** Finding은 Decision 참조와 함께 deferred로 표시될 수 있다
- **AND** 원래 Finding과 확인 이력은 삭제되지 않는다

### Requirement: Challenge 실행 기록은 범위와 검토 커버리지를 명시한다
각 Challenge run은 범위, 기대 입력 artifact 및 hash, 검토 항목별 결과, 미검토 범위·이유, Finding 참조, 생성 시각, Skill/rules 버전과 실행 이력을 기록해야 한다(SHALL). 검토 커버리지와 Finding 해결 상태는 독립적으로 판정해야 한다(SHALL).

#### Scenario: 빠진 실패 흐름 발견
- **WHEN** 정상 흐름은 명세됐지만 실패 처리 흐름이 누락된 범위를 검토한다
- **THEN** agent는 관련 Node/Prompt 근거 및 반례와 함께 flow_gap 후보를 남긴다
- **AND** CLI는 해당 판단을 의미적으로 참이라고 확정하지 않는다

#### Scenario: 경계 조건 미정의
- **WHEN** 요구사항에 경계값이나 한계 동작이 정해지지 않았다
- **THEN** agent는 불확실한 경계와 질문을 Finding 후보에 기록한다
- **AND** 임의의 경계값을 제품 결정으로 보충하지 않는다

#### Scenario: Finding 0건이어도 검토 기록 필요
- **WHEN** agent가 문제없다고 보고하지만 검토 실행 또는 범위 기록이 없다
- **THEN** Challenge run은 incomplete이며 완료로 판정하지 않는다
- **AND** Finding이 0건이라는 사실만으로 검토 완료를 추론하지 않는다

#### Scenario: 검토 항목 누락 시 완료 차단
- **WHEN** 필수 검토 항목 중 하나라도 미검토이거나 근거 없는 not_applicable이다
- **THEN** Challenge run은 incomplete이고 누락 항목과 이유를 표시한다

#### Scenario: Finding이 남아도 검토 완료와 해결을 분리
- **WHEN** 모든 범위 항목을 기록했으나 Critical 또는 기타 미해결 Finding이 남아 있다
- **THEN** 검토 절차는 complete일 수 있고 열린 Finding 및 필요한 사용자 결정은 별도 표시된다
- **AND** complete는 문제 없음, Finding 해결, Definition 승인으로 해석되지 않는다

### Requirement: Challenge는 의미적 검토 범위를 다루되 선행 구조 Gate를 중복 구현하지 않는다
Challenge는 누락 요구·예외, 충돌·중복 정책, 정상·실패·경계 흐름, 조건·논리 모순, Graph 관계 가설 위험, 원문-Node 의미 왜곡, 검증 불가능성, 영향 후보 누락을 검토해야 한다(SHALL). Change 02~04 구조 판정을 다시 구현해서는 안 된다(MUST NOT).

#### Scenario: 충돌 정책 발견
- **WHEN** 같은 적용 범위에서 양립하지 않는 두 정책을 발견한다
- **THEN** agent는 두 정책의 근거·범위·충돌 반례를 갖는 policy_conflict 후보를 만든다
- **AND** 제품 우선순위나 승자를 선택하지 않는다

#### Scenario: 단순 제약을 충돌로 오판하지 않음
- **WHEN** 요구사항 A는 일반 대상에 적용되고 정책 B는 그 부분집합인 대상에만 더 엄격한 조건을 둔다
- **THEN** agent는 적용범위가 다른 제약을 근거 없이 충돌로 확정하지 않는다
- **AND** 충돌 여부가 불명확하면 미확정 후보와 필요한 질문으로 남긴다

#### Scenario: 잘못된 Graph 관계를 Finding 후보로 검토
- **WHEN** Graph 관계의 의미·방향이 근거 문장 또는 연결 Node와 맞지 않을 가능성을 발견한다
- **THEN** 해당 Edge/Candidate와 근거를 참조하는 graph_relation_risk 후보를 남긴다
- **AND** Edge 상태를 Finding만으로 변경하거나 삭제하지 않는다

#### Scenario: 원문 의미 왜곡 탐지 후보
- **WHEN** Node가 원문의 조건, AND/OR 범위, 예외 또는 행위 결과를 바꿔 표현할 가능성이 있다
- **THEN** 원문·Clarification·Node 참조, 대조 근거, 반례가 있는 semantic_distortion 후보를 남긴다
- **AND** AI 후보 생성만으로 왜곡을 확정 사실로 표시하지 않는다

#### Scenario: 반례 가설과 입증된 결함 구분
- **WHEN** Agent가 요구사항의 가능한 반례를 구성한다
- **THEN** 반례는 검사 가설 및 조건으로 보존되고 관찰/출처 근거와 구분된다
- **AND** 반례를 상상했다는 이유만으로 제품 결함이 입증됐다고 상태를 올리지 않는다

### Requirement: Challenge run은 입력 변경 후 stale로 판정한다
Challenge run freshness는 지정 범위의 현재 Prompt, Clarification, NodeGroup, Node, Graph Edge/Candidate, ImpactReport, 검토 규칙 및 연결 Finding hash로 재계산해야 한다(SHALL). 어떤 입력이 바뀌거나 사라지면 이전 run을 current 완료로 사용해서는 안 된다(MUST NOT).

#### Scenario: Node 또는 Graph 변경으로 검토 무효화
- **WHEN** Challenge 완료 후 범위 내 Node 또는 Graph 관계가 변경된다
- **THEN** 이전 run은 stale로 표시되고 변경 입력과 영향받는 검토 항목을 제시한다
- **AND** 기존 Finding과 review 기록은 보존한다

#### Scenario: Impact 후보 누락 검토
- **WHEN** 현재 ImpactReport에 차단 입력, 잠재 영향 또는 검토 경로가 있다
- **THEN** agent는 해당 후보를 Challenge 범위에 포함하거나 미검토 이유를 기록한다
- **AND** 범위에서 빠진 영향 후보를 완료 결과에서 조용히 생략하지 않는다

### Requirement: Challenge 중단·재실행·저장 실패는 기존 산출물을 보존한다
동일한 입력과 범위에서 중복 실행은 기존 run/Finding을 덮어쓰지 않아야 한다(SHALL). 중단 후 재개는 저장 checkpoint와 동일한 input fingerprint에서만 허용해야 하며 파일 쓰기 실패는 기존 bytes를 보존해야 한다(SHALL).

#### Scenario: 중단 후 같은 입력으로 재개
- **WHEN** Challenge 실행이 일부 항목 기록 뒤 중단되고 입력 fingerprint가 유지된다
- **THEN** 재개는 이미 완료한 항목과 Finding을 중복 생성하지 않고 남은 항목을 이어간다
- **AND** 입력 hash가 달라졌으면 재개 대신 기존 run을 stale 처리한다

#### Scenario: 중복 실행
- **WHEN** 같은 범위·같은 입력으로 Challenge를 다시 실행한다
- **THEN** 동일 run과 Finding ID를 식별하고 확인/변경 이력을 불필요하게 추가하지 않는다

#### Scenario: 파일 쓰기 실패
- **WHEN** Finding 또는 Challenge run 파일의 임시 쓰기·flush·publish가 실패한다
- **THEN** 기존 artifact는 byte-for-byte 보존되고 부분 파일은 최종 기록으로 노출되지 않는다

### Requirement: CLI와 Agent는 구조 검증과 의미 판단을 구분한다
CLI는 Finding schema·참조·hash·허용 상태 전이·검토 커버리지·freshness를 결정적으로 검증해야 한다(SHALL). Agent는 의미 분석과 반례 제안을 담당하며, CLI PASS나 Finding 0건을 의미적 정확성 증거로 표현해서는 안 된다(MUST NOT).

#### Scenario: 의미 정확성 평가 분리
- **WHEN** 구조 검증이 통과하고 Agent가 Finding 0건을 기록한다
- **THEN** 결과는 구조적으로 완결된 검토 기록으로만 보고된다
- **AND** 의미적 검출 정확성은 별도 평가 결과 또는 UNKNOWN으로 남는다

#### Scenario: 사용자 결정 경계
- **WHEN** Finding이 대안 선택, 정책 우선순위, scope exclusion을 요구한다
- **THEN** Challenge는 질문과 관련 Finding을 제시하고 Change 06 Decision을 기다린다
- **AND** 제품 정책을 대신 선택하거나 Decision artifact를 생성하지 않는다
