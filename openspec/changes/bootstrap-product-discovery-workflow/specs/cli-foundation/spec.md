# Spec Delta

## Purpose

`productkit` 실행 파일이 사용자와 AI 에이전트에게 노출하는 공통 표면을 정의한다.
도움말, 버전, 종료 코드 규약, 그리고 아직 구현되지 않은 단계를 구현된 것처럼
보이지 않게 하는 규칙을 담당한다.

## ADDED Requirements

### Requirement: CLI는 도움말을 출력한다

CLI는 `--help`로 실행했을 때 제품 이름, 현재 사용 가능한 명령 목록, 각 명령의 한 줄
설명을 출력하고 종료 코드 `0`으로 끝나야 한다(SHALL).

#### Scenario: 최상위 도움말

- **WHEN** 사용자가 `productkit --help`를 실행한다
- **THEN** 사용 가능한 명령 목록이 출력된다
- **AND** 종료 코드는 `0`이다

#### Scenario: 하위 명령 도움말

- **WHEN** 사용자가 `productkit init --help`를 실행한다
- **THEN** `init`의 인자와 옵션 설명이 출력된다
- **AND** 종료 코드는 `0`이다

### Requirement: CLI는 설치된 버전을 출력한다

CLI는 `--version`으로 실행했을 때 패키지에 기록된 버전 문자열을 출력하고 종료 코드
`0`으로 끝나야 한다(SHALL). 출력 버전은 패키지 메타데이터의 버전과 일치해야 한다(MUST).

#### Scenario: 버전 출력

- **WHEN** 사용자가 `productkit --version`을 실행한다
- **THEN** 설치된 패키지의 버전 문자열이 출력된다
- **AND** 종료 코드는 `0`이다

### Requirement: CLI는 공통 종료 코드 규약을 따른다

모든 명령은 다음 종료 코드만 사용해야 한다(MUST): `0`은 정상 완료 또는 Gate 통과,
`1`은 검증 실패 또는 Gate 차단, `2`는 잘못된 명령·입력·파일 처리 오류.

#### Scenario: 알 수 없는 명령

- **WHEN** 사용자가 존재하지 않는 명령을 실행한다
- **THEN** 오류 메시지가 표준 오류로 출력된다
- **AND** 종료 코드는 `2`다

#### Scenario: 알 수 없는 옵션

- **WHEN** 사용자가 `init`에 정의되지 않은 옵션을 넘긴다
- **THEN** 오류 메시지가 표준 오류로 출력된다
- **AND** 종료 코드는 `2`다

### Requirement: CLI는 구현되지 않은 단계를 노출하지 않는다

CLI는 현재 change에서 구현된 명령만 도움말에 표시해야 한다(MUST). 입력을 받고 아무
동작 없이 성공을 반환하는 placeholder 명령을 제공해서는 안 된다(MUST NOT).

#### Scenario: 미구현 워크플로 명령

- **WHEN** 사용자가 `productkit --help`를 실행한다
- **THEN** `ingest`, `discover`, `validate`, `export` 같은 미구현 명령이 목록에 없다

#### Scenario: 미구현 명령 직접 실행

- **WHEN** 사용자가 `productkit discover`를 실행한다
- **THEN** 알 수 없는 명령으로 처리되어 종료 코드 `2`가 반환된다
- **AND** 성공으로 보고하지 않는다

### Requirement: CLI는 LLM을 호출하지 않는다

CLI는 어떤 명령에서도 외부 LLM API를 호출해서는 안 된다(MUST NOT). 추론과 대화는
Claude Code나 Codex 같은 에이전트가 수행하고, CLI는 파일·스키마·검증만 담당한다.

#### Scenario: 네트워크 없이 실행

- **WHEN** 네트워크가 차단된 환경에서 `productkit init`을 실행한다
- **THEN** 명령이 정상적으로 완료된다
