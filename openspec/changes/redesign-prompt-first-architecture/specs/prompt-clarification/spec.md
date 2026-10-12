# Spec Delta

## Purpose

사용자가 입력한 자연어 프롬프트를 원문 그대로 보존하면서, 정의·분해·구체화·관계
검증·반례 검증·해석 확인의 6단계 방법론으로 명료화해 원문과 추론이 분리된 산출물을
만드는 입력 단계를 정의한다.

## ADDED Requirements

### Requirement: 프롬프트 원문은 수정 없이 보존된다

시스템은 사용자가 입력한 프롬프트 원문을 요약하거나 고치지 않고 그대로
보존해야 한다(SHALL). 이후 모든 Clarification 산출물은 이 원문을 참조로 가리켜야
한다(MUST).

#### Scenario: 원문 그대로 저장

- **WHEN** 사용자가 자연어 프롬프트를 입력한다
- **THEN** 입력된 문자열이 수정 없이 원문으로 저장된다
- **AND** 저장된 원문에는 고유 참조 ID가 부여된다

### Requirement: Clarification은 6단계를 모두 거친다

시스템은 프롬프트를 명료화할 때 정의, 분해, 구체화, 관계 검증, 반례 검증, 해석
확인의 6단계를 모두 거쳐야 한다(SHALL). 한 단계라도 건너뛴 결과는 완료된
Clarification으로 표시해서는 안 된다(MUST NOT).

#### Scenario: 6단계 모두 수행

- **WHEN** 하나의 프롬프트에 대해 Clarification을 수행한다
- **THEN** 정의·분해·구체화·관계 검증·반례 검증·해석 확인 6단계의 결과가 모두
  기록된다

#### Scenario: 일부 단계 누락

- **WHEN** 6단계 중 하나 이상이 기록되지 않은 채로 저장을 시도한다
- **THEN** 해당 Clarification은 미완료 상태로 표시된다
- **AND** 완료된 산출물로 노출되지 않는다

### Requirement: 원문과 추론은 분리해 표시한다

Clarification 산출물의 각 statement는 `origin: source | inference`를 명시해야
한다(SHALL). `source`로 표시된 statement는 원문 참조(`source_refs`)가 비어 있지
않아야 한다(MUST).

#### Scenario: 원문 기반 statement

- **WHEN** 프롬프트 원문에 직접 등장한 내용을 statement로 기록한다
- **THEN** `origin`은 `source`로 표시된다
- **AND** 해당 원문을 가리키는 `source_refs`가 포함된다

#### Scenario: 추론 기반 statement 표시

- **WHEN** 원문에 명시되지 않은 내용을 추론해 statement로 기록한다
- **THEN** `origin`은 `inference`로 표시된다
- **AND** 원문 그대로인 것처럼 표시되지 않는다

### Requirement: 해석 확인 결과는 사용자에게 재확인한다

시스템은 해석 확인 단계의 결과를 사용자에게 제시하고 확인을 받아야 한다(SHALL).
사용자가 이해한 내용과 명료화 결과가 다르면, 그 차이를 반영해 명료화를 다시
수행해야 한다(MUST).

#### Scenario: 해석 일치

- **WHEN** 사용자가 제시된 해석 확인 결과에 동의한다
- **THEN** 해당 Clarification은 완료로 표시된다

#### Scenario: 해석 불일치

- **WHEN** 사용자가 제시된 해석이 자신의 의도와 다르다고 답한다
- **THEN** 해당 차이를 반영해 관련 단계를 다시 수행한다
- **AND** 이전 해석 결과를 조용히 덮어쓰지 않고 변경 이력을 남긴다

### Requirement: 모호성과 반례는 추측으로 메우지 않는다

반례 검증 단계에서 다르게 해석될 수 있는 상황이나 예외를 발견하면, 시스템은
그럴듯한 값으로 추측해 채우지 않고 Finding 후보로 남겨야 한다(SHALL). 사용자에게
질문하지 않고 임의로 해소한 모호성을 명료화 결과에 포함해서는 안 된다(MUST NOT).

#### Scenario: 반례 발견

- **WHEN** 반례 검증 중 둘 이상으로 해석 가능한 표현을 발견한다
- **THEN** 해당 모호성은 Finding 후보로 기록된다
- **AND** 임의의 해석 하나를 확정된 statement로 기록하지 않는다
