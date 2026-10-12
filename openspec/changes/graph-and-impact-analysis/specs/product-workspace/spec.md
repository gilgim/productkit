# Spec Delta

## MODIFIED Requirements

### Requirement: init은 product workspace 구조를 만든다

`productkit init [path]`는 대상 경로 아래에 `product/` 디렉터리와 그 하위 구조를
만들어야 한다(SHALL). 하위 구조는 `config.yaml`, `constitution.md`, `overview.md`와
`sources/`, `discovery/`, `findings/`, `proposals/`, `decisions/`, `journeys/`,
`policies/`, `assumptions/`, `reviews/`, `nodes/`, `graph/` 디렉터리다.

#### Scenario: 빈 디렉터리 초기화

- **WHEN** 사용자가 빈 디렉터리에서 `productkit init`을 실행한다
- **THEN** `product/config.yaml`, `product/constitution.md`, `product/overview.md`가 생성된다
- **AND** 열한 개의 artifact 디렉터리가 생성된다
- **AND** 종료 코드는 `0`이다

#### Scenario: 경로 인자 생략

- **WHEN** 사용자가 경로 없이 `productkit init`을 실행한다
- **THEN** 현재 작업 디렉터리를 대상으로 삼는다

#### Scenario: 공백이 포함된 경로

- **WHEN** 사용자가 `productkit init "my app"`처럼 공백이 포함된 경로를 넘긴다
- **THEN** 해당 경로 아래에 workspace가 생성된다
- **AND** 종료 코드는 `0`이다

## ADDED Requirements

### Requirement: v0와 v1 workspace는 기존 명령으로 사용할 수 있다

시스템은 schema_version 0/1 workspace를 init/intake/clarify/model로 처리해야 한다(SHALL). 기존 config는 init 재실행이나 기존 명령 실행으로 자동 migration해서는 안 된다(MUST NOT). 새 workspace는 v1을 생성하고 기존 config는 보존하며 알 수 없는 version은 변경 없이 거부해야 한다(SHALL).

#### Scenario: 기존 명령의 v0 회귀 방지
- **WHEN** v0 workspace에서 init/intake/clarify/model을 실행한다
- **THEN** 기존 동작을 유지하며 schema_version과 기존 관련 없는 stage 값이 바뀌지 않는다
- **AND** init은 없는 graph 경로만 추가하고 기존 config를 그대로 보존한다

#### Scenario: 새로운 workspace와 v1 진행 기록
- **WHEN** 빈 디렉터리에서 init 후 intake/clarify/model/graph 단계를 실행한다
- **THEN** 최초 config는 v1이며 모든 stage가 not_started다
- **AND** 이후 각 명령은 해당 stage만 갱신하며 stage 값만으로 완료를 판정하지 않는다

#### Scenario: 알 수 없는 버전과 Graph 진입
- **WHEN** schema_version 7에서 기존 명령을 실행하거나 v0에서 graph 명령을 실행한다
- **THEN** 쓰기 없이 코드 2로 거부한다
- **AND** v0 graph에는 명시적 migrate 안내를 제공한다

### Requirement: Stage migration은 기존 데이터를 보존한다

명시적 productkit migrate만 v0→v1을 변환해야 한다(SHALL). 기존 9개 stage와 review, 사용자 확장 값·주석·artifact는 보존하고 atomic_modeling/graph_analysis만 not_started로 추가해야 한다(SHALL). 9-Phase와 저장 키를 동일시해 기존 키를 삭제·병합·rename해서는 안 된다(MUST NOT).

#### Scenario: T11 기존 workspace 마이그레이션
- **WHEN** 일부 stage=done, review=in_progress, 사용자 확장 필드와 주석이 있는 v0 config를 migrate한다
- **THEN** schema_version=1 및 새 두 stage=not_started가 되고 기존 값·주석은 보존된다
- **AND** 원본 바이트와 일치하는 backup이 남고 모든 기존 Prompt/Clarification/Node 바이트는 불변이다

#### Scenario: Dry run과 충돌
- **WHEN** migrate --dry-run 또는 새 stage와 충돌하는 v0 사용자 확장 키가 있다
- **THEN** dry-run은 계획만 출력하고 lock/backup/journal도 만들지 않는다
- **AND** 충돌 입력은 기존 값을 덮어쓰지 않고 코드 2로 거부한다

### Requirement: Migration 중단과 복구는 원본을 손상시키지 않는다

시스템은 config commit 전 검증된 원본 backup과 transaction 상태를 보존해야 한다(SHALL). 중단 뒤 --resume은 source/target hash와 journal을 대조하고 --rollback은 검증된 backup을 안전하게 복원해야 한다(SHALL). 외부 수정이나 다른 backup을 조용히 덮어써서는 안 된다(MUST NOT).

#### Scenario: T12 Migration 중단과 재개
- **WHEN** backup/temp/journal 쓰기 전후 또는 config rename 직전/직후 또는 committed 기록 전에 프로세스를 중단한다
- **THEN** 최종 config는 온전한 v0 또는 검증된 v1이고 손상된 부분 파일이 아니다
- **AND** --resume은 실제 hash와 journal로 해당 단계부터 안전하게 완료하며 기존 artifact를 보존한다

#### Scenario: T13 Migration 중복 실행
- **WHEN** 정상 v1에 migrate를 다시 실행하거나 rollback 완료 v0에 rollback을 다시 실행한다
- **THEN** 각각 no-op이며 기존 backup·artifact 바이트를 바꾸지 않는다
- **AND** 두 migration 동시 실행은 lock으로 직렬화하거나 두 번째를 안전하게 거부한다

#### Scenario: Rollback과 외부 변경
- **WHEN** migration 후 config가 transaction target과 동일하거나 사용자가 추가 수정했다
- **THEN** 동일한 경우에만 --rollback이 원본 backup을 복원한다
- **AND** 추가 수정한 경우 코드 2로 중단하며 사용자 파일과 backup을 그대로 보존한다

#### Scenario: 다른 backup 또는 남은 lock
- **WHEN** 현재 source와 다른 backup이 있거나 이전 migration lock이 남았다
- **THEN** backup을 덮어쓰지 않고 일관성 오류/복구 방법을 보고한다
- **AND** lock은 명시적 --resume의 process/journal 검사 없이 자동 제거하지 않는다

### Requirement: Migration 쓰기 실패는 데이터 보존과 오류를 보고한다

backup/temp/journal/rename/flush 실패 시 시스템은 실패 경로·원인·복구 상태와 코드 2를 보고해야 한다(SHALL). commit 전 원본 config는 바이트 그대로, commit 후에는 검증된 전체 v1과 원본 backup을 보존해야 한다(SHALL). 기존 사용자 artifact를 삭제해서는 안 된다(MUST NOT).

#### Scenario: T14 파일 쓰기 실패와 보존
- **WHEN** backup create/write/flush/publish, journal 또는 target temp 쓰기, config rename에 I/O 오류를 주입한다
- **THEN** commit 전에는 원본 바이트가 보존되고 commit 후에는 온전한 target과 검증 가능한 원본 backup이 보존된다
- **AND** 코드 2 및 resume/rollback 가능 상태를 보고하며 기존 데이터는 삭제하지 않는다

#### Scenario: Stage writer의 사용자 확장 보존
- **WHEN** v0/v1 intake/clarify 또는 v1 model/graph가 stage를 갱신한다
- **THEN** 대상 stage 외 기존 값·unknown field·주석을 보존한다
- **AND** migration lock 또는 저장 직전 외부 변경이 있으면 안전하게 거부한다
