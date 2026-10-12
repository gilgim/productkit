# Spec Delta

## MODIFIED Requirements

### Requirement: init은 product workspace 구조를 만든다

`productkit init [path]`는 대상 경로 아래에 `product/` 디렉터리와 그 하위 구조를
만들어야 한다(SHALL). 하위 구조는 `config.yaml`, `constitution.md`, `overview.md`와
`sources/`, `discovery/`, `findings/`, `proposals/`, `decisions/`, `journeys/`,
`policies/`, `assumptions/`, `reviews/`, `nodes/` 디렉터리다.

#### Scenario: 빈 디렉터리 초기화

- **WHEN** 사용자가 빈 디렉터리에서 `productkit init`을 실행한다
- **THEN** `product/config.yaml`, `product/constitution.md`, `product/overview.md`가 생성된다
- **AND** 열 개의 artifact 디렉터리가 생성된다
- **AND** 종료 코드는 `0`이다

#### Scenario: 경로 인자 생략

- **WHEN** 사용자가 경로 없이 `productkit init`을 실행한다
- **THEN** 현재 작업 디렉터리를 대상으로 삼는다

#### Scenario: 공백이 포함된 경로

- **WHEN** 사용자가 `productkit init "my app"`처럼 공백이 포함된 경로를 넘긴다
- **THEN** 해당 경로 아래에 workspace가 생성된다
- **AND** 종료 코드는 `0`이다
