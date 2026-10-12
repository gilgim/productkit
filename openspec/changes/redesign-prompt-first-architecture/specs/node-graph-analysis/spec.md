# Spec Delta

## Purpose

명료화된 atomic node 사이의 관계를 typed graph로 표현하고, CLI가 그 구조적
무결성만 결정적으로 검증하는 산출물과 규칙을 정의한다.

## ADDED Requirements

### Requirement: Node는 원자적 단위만 담는다

하나의 node는 Clarification의 "분해" 단계를 거친 단일 주장·조건·행위·결과만
담아야 한다(SHALL). 쪼개지지 않은 복합 문장을 하나의 node에 담아서는 안
된다(MUST NOT).

#### Scenario: 단일 주장 node

- **WHEN** 분해 단계를 거친 하나의 진술을 node로 만든다
- **THEN** 해당 node는 주장·조건·행위 중 분해되지 않은 복수 요소를 포함하지 않는다

#### Scenario: 복합 문장 거부

- **WHEN** 아직 분해되지 않은 복합 문장을 node로 만들려는 시도가 있다
- **THEN** 해당 시도는 원자성 위반으로 거부된다

### Requirement: Node는 원본 프롬프트까지 추적 가능하다

`origin: source`인 node는 원본 프롬프트를 가리키는 참조가 비어 있지 않아야
한다(MUST). 참조가 끊어진 node는 유효한 node로 취급하지 않는다(SHALL NOT).

#### Scenario: 참조 보존

- **WHEN** 원문에서 직접 도출한 node를 만든다
- **THEN** 해당 node는 원본 프롬프트 참조를 포함한다

#### Scenario: 끊어진 참조

- **WHEN** node의 원본 프롬프트 참조가 존재하지 않는 ID를 가리킨다
- **THEN** 해당 node는 검증에서 오류로 보고된다

### Requirement: Node 사이의 관계는 타입을 가진다

Graph의 모든 edge는 관계 타입(예: depends_on, causes, conflicts_with,
supersedes)을 명시해야 한다(SHALL). 타입이 없는 edge는 생성할 수 없다(MUST
NOT).

#### Scenario: 타입 있는 관계

- **WHEN** 두 node 사이에 인과 관계를 기록한다
- **THEN** 해당 edge는 관계 타입을 포함한다

#### Scenario: 타입 없는 edge 거부

- **WHEN** 관계 타입 없이 두 node를 연결하려는 시도가 있다
- **THEN** 해당 edge는 생성되지 않고 오류로 보고된다

### Requirement: Graph 작성은 AI가 하고 CLI는 호출하지 않는다

CLI는 Graph를 작성하기 위해 LLM을 호출해서는 안 된다(MUST NOT). CLI는 Graph
산출물이 존재하는지, 필요한 입력이 갖춰졌는지, 출력 위치와 schema 계약이
무엇인지만 안내해야 한다(SHALL).

#### Scenario: CLI의 역할

- **WHEN** 사용자가 Graph Analysis 단계를 실행한다
- **THEN** CLI는 입력 node 목록과 출력 schema 계약을 안내한다
- **AND** CLI 자신은 관계를 추론하지 않는다

### Requirement: CLI는 Graph의 구조적 무결성만 검증한다

CLI는 Graph의 schema 형식, 순환 참조, 고아 참조(존재하지 않는 node를 가리키는
edge)처럼 결정적으로 판정 가능한 것만 검증해야 한다(SHALL). CLI는 관계의 의미적
타당성을 자신이 검증했다고 표시해서는 안 된다(MUST NOT).

#### Scenario: 순환 참조 검출

- **WHEN** Graph에 A→B→A 형태의 순환 관계가 있다
- **THEN** 검증은 순환 참조 오류를 보고한다

#### Scenario: 고아 참조 검출

- **WHEN** edge가 존재하지 않는 node ID를 가리킨다
- **THEN** 검증은 고아 참조 오류를 보고한다

#### Scenario: 의미적 타당성은 별도 영역

- **WHEN** 구조적으로 유효한 Graph에 대해 기계 검증이 통과한다
- **THEN** 그 결과는 관계의 의미가 타당하다는 뜻으로 표시되지 않는다
