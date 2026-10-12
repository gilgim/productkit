# Spec Delta

## Purpose

대상 앱 저장소 안에서 ProductKit이 읽고 쓰는 `product/` workspace의 구조와, 그
workspace를 안전하게 초기화하는 동작을 정의한다. 이후 모든 단계는 이 구조를 전제로
한다.

## ADDED Requirements

### Requirement: init은 product workspace 구조를 만든다

`productkit init [path]`는 대상 경로 아래에 `product/` 디렉터리와 그 하위 구조를
만들어야 한다(SHALL). 하위 구조는 `config.yaml`, `constitution.md`, `overview.md`와
`sources/`, `discovery/`, `findings/`, `proposals/`, `decisions/`, `journeys/`,
`policies/`, `assumptions/`, `reviews/` 디렉터리다.

#### Scenario: 빈 디렉터리 초기화

- **WHEN** 사용자가 빈 디렉터리에서 `productkit init`을 실행한다
- **THEN** `product/config.yaml`, `product/constitution.md`, `product/overview.md`가 생성된다
- **AND** 아홉 개의 artifact 디렉터리가 생성된다
- **AND** 종료 코드는 `0`이다

#### Scenario: 경로 인자 생략

- **WHEN** 사용자가 경로 없이 `productkit init`을 실행한다
- **THEN** 현재 작업 디렉터리를 대상으로 삼는다

#### Scenario: 공백이 포함된 경로

- **WHEN** 사용자가 `productkit init "my app"`처럼 공백이 포함된 경로를 넘긴다
- **THEN** 해당 경로 아래에 workspace가 생성된다
- **AND** 종료 코드는 `0`이다

### Requirement: init은 기존 파일을 덮어쓰지 않는다

`init`을 다시 실행했을 때 이미 존재하는 파일의 내용은 바뀌지 않아야 한다(MUST NOT
overwrite). 없는 파일만 생성한다.

#### Scenario: 사용자가 수정한 파일 보존

- **WHEN** 사용자가 `product/constitution.md`를 수정한 뒤 `productkit init`을 다시 실행한다
- **THEN** 수정된 내용이 그대로 남는다
- **AND** 해당 파일은 건너뜀으로 보고된다

#### Scenario: 일부 파일만 누락된 workspace

- **WHEN** `product/config.yaml`만 있는 상태에서 `productkit init`을 실행한다
- **THEN** 누락된 파일과 디렉터리만 생성된다
- **AND** 기존 `config.yaml`은 변경되지 않는다

### Requirement: init은 생성·건너뜀·충돌을 구분해 보고한다

`init`은 각 경로에 대해 생성했는지, 이미 있어서 건너뛰었는지, 구조가 충돌하는지를
구분해 출력해야 한다(SHALL). 출력에는 각 분류의 개수 요약이 포함된다.

#### Scenario: 혼합 결과 보고

- **WHEN** 일부 파일이 이미 있는 workspace에서 `init`을 실행한다
- **THEN** 생성된 경로와 건너뛴 경로가 각각 구분되어 출력된다
- **AND** 분류별 개수가 요약으로 출력된다

### Requirement: init은 구조 충돌을 수정 전에 진단한다

파일이 있어야 할 경로에 디렉터리가 있거나 디렉터리가 있어야 할 경로에 파일이 있으면,
`init`은 아무것도 쓰지 않고 충돌 경로를 모두 출력한 뒤 종료 코드 `2`로 끝나야
한다(MUST).

#### Scenario: 파일 자리에 디렉터리가 있음

- **WHEN** `product/config.yaml`이 디렉터리인 상태에서 `init`을 실행한다
- **THEN** 충돌 경로와 기대한 종류가 출력된다
- **AND** 다른 파일도 생성되지 않는다
- **AND** 종료 코드는 `2`다

#### Scenario: 디렉터리 자리에 파일이 있음

- **WHEN** `product/sources`가 일반 파일인 상태에서 `init`을 실행한다
- **THEN** 충돌이 보고되고 종료 코드 `2`로 끝난다

#### Scenario: 대상 경로 자체가 파일

- **WHEN** 사용자가 일반 파일 경로를 `init`의 인자로 넘긴다
- **THEN** 오류가 출력되고 종료 코드 `2`로 끝난다

### Requirement: init은 쓰기 실패를 이해할 수 있게 보고한다

파일 쓰기가 실패하면 `init`은 실패한 경로와 원인을 사람이 읽을 수 있는 문장으로
출력하고 종료 코드 `2`로 끝나야 한다(MUST). 스택 트레이스만 출력해서는 안 된다.

#### Scenario: 쓰기 권한 없는 경로

- **WHEN** 쓰기 권한이 없는 디렉터리를 대상으로 `init`을 실행한다
- **THEN** 실패한 경로와 원인이 출력된다
- **AND** 종료 코드는 `2`다

### Requirement: init은 workspace 밖 파일을 변경하지 않는다

`init`은 대상 경로의 `product/` 하위만 생성하거나 수정해야 한다(MUST). 대상 앱의
`openspec/`, `AGENTS.md`, `CLAUDE.md`를 포함한 다른 파일을 변경해서는 안 된다
(MUST NOT).

#### Scenario: 기존 에이전트 설정 보존

- **WHEN** `CLAUDE.md`와 `openspec/`이 있는 저장소에서 `init`을 실행한다
- **THEN** 그 파일과 디렉터리의 내용이 변경되지 않는다

### Requirement: 생성된 config는 미시작 상태로 기록된다

`init`이 만드는 `product/config.yaml`은 `schema_version`을 포함해야 하고(SHALL),
모든 단계 상태를 `not_started`로 기록해야 한다. 어떤 단계도 READY, PASS, 또는 완료로
표시해서는 안 된다(MUST NOT).

#### Scenario: 초기 config 상태

- **WHEN** 새 workspace를 초기화한다
- **THEN** `config.yaml`의 모든 단계 상태가 `not_started`다
- **AND** `definition.status`가 `not_started`다
- **AND** `schema_version`이 기록되어 있다

#### Scenario: config schema 검증

- **WHEN** 생성된 `config.yaml`을 ProductKit의 config schema로 검증한다
- **THEN** 검증을 통과한다

### Requirement: init은 가짜 artifact를 만들지 않는다

`init`은 빈 예시 Decision, Journey, Finding 등 실제 artifact로 집계될 수 있는 파일을
생성해서는 안 된다(MUST NOT). artifact 디렉터리에는 해당 디렉터리의 용도를 설명하는
안내 문서만 둔다.

#### Scenario: 초기 artifact 개수

- **WHEN** 새 workspace를 초기화한다
- **THEN** `decisions/`와 `journeys/`에 artifact 파일이 없다
- **AND** 각 디렉터리에는 용도를 설명하는 안내 문서만 있다
