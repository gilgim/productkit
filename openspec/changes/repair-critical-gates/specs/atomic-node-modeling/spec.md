# Spec Delta

## ADDED Requirements

### Requirement: modeled 집합의 모든 최종 Node는 atomic이다

시스템은 modeled 전이 시 유효한 모든 분해 항목의 최종 Node coverage와 모든 final=atomic을 검사해야 한다(SHALL). split_required/null 또는 sub-verdict와 불일치하는 atomic은 차단해야 한다(MUST). 단순 final 재표기로 실제 분해를 대체해서는 안 된다(MUST NOT).

#### Scenario: 미분해와 final 위조
- **WHEN** 최종 Node에 split_required가 남아 있거나 동일 sub-verdict에서 final만 atomic으로 변경한다
- **THEN** modeled를 차단하고 split_required 또는 atomicity_final_mismatch로 보고한다

#### Scenario: 불확실성과 커버리지
- **WHEN** null final 또는 어떤 Node도 추적하지 않는 유효 분해 항목이 있다
- **THEN** modeled를 차단한다

### Requirement: 실제 분해는 원본 Node와 새 Node 출처를 보존한다

분해 전 split_required Node는 retired_nodes에 보존하고 새 ID의 Node는 split_from으로 해당 Node를 추적해야 한다(SHALL). 각 retired Node의 두 개 이상 자식, 동일 CLR/index, ID 유일성, 끊김과 순환 부재를 검사해야 한다(SHALL). 이 연결은 Content Graph 기능으로 취급해서는 안 된다(MUST NOT).

#### Scenario: 정상 분해 후 재검증
- **WHEN** 원본 split_required Node를 보존하고 공유 조건을 가진 새 atomic Node 둘 이상과 출처/검토 기록을 제출한다
- **THEN** 다른 모든 Gate 조건이 유효하면 modeled로 판정할 수 있다
- **AND** 원본 final은 split_required 그대로 남는다

#### Scenario: 분해 출처 오류
- **WHEN** 새 ID가 재사용되거나 부모가 없거나 출처 index가 다르거나 한 자식뿐이거나 split_from 순환이 있다
- **THEN** modeled를 차단하며 임의 부모를 추정하지 않는다

### Requirement: modeled 집합은 항목별 의미 보존 검토를 요구한다

모든 분해 항목은 정확히 한 개의 역합성 검토와 조건/논리 연산자/예외 보존 검토를 가져야 한다(SHALL). 검토 누락·placeholder·uncertain/distorted 또는 열린 중요 위험 후보가 있으면 modeled를 차단해야 한다(MUST). 구조 검증을 의미 보존 증명으로 표현해서는 안 된다(MUST NOT).

#### Scenario: 분해 후 검토 누락
- **WHEN** Node가 모두 atomic이어도 항목별 역합성이나 조건/연산자/예외 검토가 빠졌다
- **THEN** modeled를 차단하고 누락 검토를 보고한다

#### Scenario: 실제 의미 판정의 경계
- **WHEN** 기록된 검토 형식·참조·판정값이 모두 유효하다
- **THEN** 구조적 검증 통과만 보고하며 AI 판정이 실제로 옳다는 증거로 사용하지 않는다

### Requirement: modeled 집합은 현재 Prompt부터 Clarification까지 재검증한다

완료 판정에는 실제 Prompt context와 현재 confirmed CLR, 일치하는 CLR 참조와 steps hash 및 전체 CLR 출처/확인 snapshot hash가 필요하다(SHALL). 상위 identity/내용/확인 변경 또는 snapshot 누락 시 재모델링을 요구하고 기존 artifact를 보존해야 한다(SHALL).

#### Scenario: Clarification 변경
- **WHEN** CLR steps가 바뀌고 새 확인을 받았어도 NodeGroup은 이전 snapshot이다
- **THEN** modeled를 차단한다

#### Scenario: steps 불변 출처 또는 확인 변경
- **WHEN** steps는 같지만 Prompt binding이나 확인 이력이 바뀐다
- **THEN** 전체 CLR snapshot 불일치로 기존 modeled를 무효화한다

#### Scenario: 정상 데이터 회귀와 읽기 전용 검사
- **WHEN** 현재 원문·6단계·승인·atomic Nodes·검토·출처 hash가 모두 유효한 집합을 반복 검사한다
- **THEN** 동일 modeled 결과를 반환하고 원문/CLR/Node 파일 바이트를 변경하지 않는다
