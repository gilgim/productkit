# Spec Delta

## ADDED Requirements

### Requirement: 완료 명료화는 모든 단계의 유효한 산출물을 요구한다

명료화 완료는 정의·분해·구체화의 비어 있지 않은 산출물과 관계·반례 검토 결과 및 현재 해석 확인을 모두 검사해야 한다(SHALL). 공백/고정 placeholder/근거 없는 빈 배열을 완료로 판정해서는 안 된다(MUST NOT). Draft 파싱은 미완료 데이터를 읽을 수 있어야 한다(SHALL).

#### Scenario: 빈 단계와 확인 기록
- **WHEN** 빈 steps에 agreed와 일치하는 presented_hash/entry_hash가 있다
- **THEN** confirmed 판정을 차단하고 incomplete_steps로 보고한다

#### Scenario: 정상 6단계와 명시적인 검토 결과 없음
- **WHEN** 정의·분해·구체화가 유효하고 관계/반례 후보 또는 후보가 없다는 명시적 검토 이유가 있으며 현재 source/steps에 대한 확인 기록이 유효하다
- **THEN** confirmed를 판정할 수 있다
- **AND** 검토 이유의 의미 충실성을 증명했다고 표시하지 않는다

#### Scenario: 빈 문자열 및 placeholder
- **WHEN** 산출물 필수 텍스트가 공백, TBD, unknown, 미정 또는 점/물음표/대시만 있는 placeholder다
- **THEN** hash가 일치해도 완료를 차단한다

### Requirement: 완료 명료화의 단계 참조는 실제 산출물에서 해소된다

구체화는 모든 분해 statement를 정확히 참조해야 한다(SHALL). 관계 후보는 서로 다른 두 분해 statement를 참조하고 반례에는 ambiguity와 두 개 이상 해석을 기록해야 한다(SHALL). 원문 span 참조는 현재 Prompt에서 해소되어야 한다(SHALL).

#### Scenario: 단계 또는 원문 참조 오류
- **WHEN** 구체화/관계의 statement 또는 분해/Finding의 span_ref가 존재하지 않는 대상을 가리킨다
- **THEN** confirmed 판정을 차단하고 참조 오류를 보고한다

### Requirement: 완료 명료화의 사용자 확인은 현재 Prompt와 결합된다

시스템은 실제 존재하는 Prompt의 ID/raw hash/span 무결성, CLR의 prompt_content_hash 및 최신 확인의 prompt_ref/prompt_content_hash와 현재 steps hash를 함께 검사해야 한다(SHALL). 누락된 과거 근거를 자동 생성하거나 실제 사용자 발언을 대신 작성해서는 안 된다(MUST NOT).

#### Scenario: 존재하지 않는 Prompt
- **WHEN** 확인 기록이 있어도 참조 대상 Prompt가 존재하지 않는다
- **THEN** Clarification 완료와 그 하위 Node 모델링을 차단한다

#### Scenario: Prompt 변경과 재해시
- **WHEN** Prompt raw가 바뀌거나 raw/hash/spans를 모두 다시 계산했지만 기존 CLR/확인 snapshot은 이전 원문을 가리킨다
- **THEN** 기존 Clarification/NodeGroup의 완료를 무효화한다
- **AND** 원본과 하위 artifact를 자동 삭제·덮어쓰기하지 않는다

#### Scenario: legacy 확인 근거 누락
- **WHEN** 기존 artifact에 새 Prompt snapshot이 없다
- **THEN** 읽기는 허용하되 완료는 차단하고 새 원문 검토/확인 라운드를 요구한다
- **AND** 과거 확인에 필드를 덧입히지 않는다
