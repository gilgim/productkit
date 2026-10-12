# Spec Delta

## Purpose

자연어 프롬프트를 원문 그대로 보존하고, 정의·분해·구체화·관계검증·반례검증·해석
확인 6단계로 명료화하며, 사용자의 명시적 확인 없이는 완료로 전이하지 않는 입력
단계를 정의한다.

## ADDED Requirements

### Requirement: 프롬프트 원문은 수정 없이 보존되고 append-only다

시스템은 사용자가 입력한 프롬프트 원문을 요약·수정 없이 그대로 보존해야
한다(SHALL). 같은 세션에서 사용자가 프롬프트를 다시 입력하면 기존 원문을
덮어쓰지 않고 새 레코드를 만들어야 한다(MUST).

#### Scenario: 최초 입력

- **WHEN** 사용자가 `productkit intake`로 프롬프트를 입력한다
- **THEN** 원문이 수정 없이 저장되고 고유 ID·content hash·문자 span이 부여된다

#### Scenario: 같은 세션에서 재입력

- **WHEN** 사용자가 이전 입력을 수정해 다시 `intake`를 실행한다
- **THEN** 새 Prompt 레코드가 생성된다
- **AND** 이전 레코드는 삭제되거나 덮어써지지 않는다

### Requirement: Clarification은 6단계를 모두 거친다

시스템은 프롬프트를 명료화할 때 정의, 분해, 구체화, 관계 검증, 반례 검증, 해석
확인 6단계를 모두 거쳐야 한다(SHALL). 한 단계라도 기록되지 않은 결과를 완료로
표시해서는 안 된다(MUST NOT).

#### Scenario: 6단계 모두 기록

- **WHEN** 하나의 Prompt에 대해 Clarification을 수행한다
- **THEN** 6단계 결과가 모두 `steps`에 기록된다

#### Scenario: 중단 후 재개

- **WHEN** 세션이 3단계(구체화)까지만 기록된 채로 중단된다
- **THEN** `status`는 `in_progress`로 유지된다
- **AND** 재개 시 이미 기록된 1~3단계를 다시 입력받지 않고 이어서 진행한다

### Requirement: 해석 확인은 제시된 내용·실제 발언·현재 산출물 해시가 하나로 묶여야 완료로 전이한다

`interpretation_check`는 단일 값이 아니라 이력 목록이어야 한다(SHALL). 각 항목은
사용자에게 실제로 제시된 재구성 문장(`presented_statement`), **그 시점의 `steps`
전체(정의·분해·구체화·관계검증·반례검증)를 정규화(canonical JSON, 키 정렬)해
해시한 값**(`presented_hash`), 사용자의 실제 발언(`user_statement`), 응답
(`user_response`), 확인 시각(`checked_at`), 그리고 항목 자체의 무결성 해시
(`entry_hash`)를 가져야 한다(SHALL). `status`가 `confirmed`로 전이하려면 가장
최근 항목이 다음을 모두 만족해야 한다(MUST): `user_response`가 `agreed`,
`user_statement`가 비어 있지 않음, 그리고 **그 항목의 `presented_hash`가
현재 `steps`를 다시 정규화해 계산한 해시와 일치**함. 이 비교는 CLI가 매번
새로 계산하며, 저장된 `status` 값을 그대로 신뢰하지 않는다(Constitution 9와
동일 원칙 — 저장된 상태는 진행 메모일 뿐 판정 근거가 아니다). AI나 CLI가 이
조건 없이 스스로 완료를 선언해서는 안 된다(MUST NOT).

#### Scenario: 정상 확정

- **WHEN** 최신 항목이 `agreed`이고 `user_statement`가 비어 있지 않으며, 그
  항목의 `presented_hash`가 현재 `steps`의 정규화 해시와 일치한다
- **THEN** `status`가 `confirmed`로 전이될 수 있다

#### Scenario: 해석 불일치

- **WHEN** 사용자가 재구성 문장이 의도와 다르다고 답한다(`disagreed` 또는
  `partially_agreed`)
- **THEN** `status`는 `confirmed`로 전이되지 않는다
- **AND** 관련 단계를 다시 수행할 수 있도록 `awaiting_confirmation` 또는
  `in_progress`로 유지된다

#### Scenario: 확인 이력 자체가 없는 상태에서 완료 선언 시도

- **WHEN** `interpretation_check` 목록이 비어 있는 상태에서 `status`를
  `confirmed`로 설정하려는 시도가 있다
- **THEN** 해당 시도는 거부된다

#### Scenario: 확인 이후 산출물이 바뀜(확인 무효화)

- **WHEN** 최신 항목이 `agreed`로 기록된 뒤, `steps`의 내용(예: `decomposition`)이
  수정된다
- **THEN** 현재 `steps`의 정규화 해시가 그 항목의 `presented_hash`와 달라지고
- **AND** `status`는 `confirmed`로 판정되지 않는다 — 저장된 `status` 필드가
  `confirmed`라고 적혀 있어도 CLI는 다시 계산해 무효로 처리한다
- **AND** 새로운 `interpretation_check` 항목을 추가해 재확인해야 한다

#### Scenario: 발언 누락

- **WHEN** `user_response`가 `agreed`인데 `user_statement`가 비어 있다
- **THEN** `confirmed`로 전이하지 않는다

### Requirement: 과거 interpretation_check 항목은 덮어쓰지 않는다

새로운 해석 확인 라운드가 필요하면 새 항목을 추가해야 하며(SHALL), 기존 항목의
`presented_statement`·`user_response`·`user_statement`를 고쳐 쓰거나 지워서는
안 된다(MUST NOT). CLI는 완료 판정 전에 모든 항목의 `entry_hash`를 그 항목의
나머지 필드로부터 다시 계산해 저장된 값과 비교해야 한다(SHALL).

#### Scenario: 재작업은 새 항목 추가

- **WHEN** 사용자가 재구성 문장에 동의하지 않아 다시 명료화한다
- **THEN** 새 `interpretation_check` 항목이 추가된다
- **AND** 이전 항목은 그대로 남는다

#### Scenario: 과거 항목 변조 탐지

- **WHEN** 과거 항목 하나의 내용이 저장 당시의 `entry_hash`와 더 이상 일치하지
  않는다
- **THEN** CLI는 기록 무결성 위반을 보고한다
- **AND** 전체 Clarification을 `confirmed`로 판정하지 않는다

### Requirement: entry_hash는 기록 무결성 확인 용도로만 쓰이며, 발언의 진위나 변조 방지를 보장하지 않는다

CLI는 `interpretation_check` 항목의 해시 일치와 필수 필드 존재만 검증할 수
있다(SHALL). `user_statement`가 실제 사람의 발언인지 AI가 대신 작성한 것인지는
CLI가 검증할 수 없으며, 검증했다고 표시해서는 안 된다(MUST NOT). `entry_hash`는
저장된 내용이 저장 당시와 달라졌는지 **탐지**하는 용도로만 쓰이며(SHALL), 이를
사용자의 실제 동의를 **보장**하거나 악의적 변조를 **방지**한다고 코드 출력·
문서·주석 어디에도 표현해서는 안 된다(MUST NOT). 파일을 직접 고치는 행위 자체를
막을 방법은 없다 — tamper-evident(들키지 않고 고칠 수 없음)이지
tamper-proof(고칠 수 없음)가 아니다.

#### Scenario: 한계 고지

- **WHEN** CLI가 `confirmed` 판정 결과를 출력한다
- **THEN** 그 출력이나 관련 문서는 "기록이 내부적으로 무결하다(변경되면
  탐지된다)"는 뜻이지 "사람이 실제로 그렇게 말했음을 증명한다" 또는 "변조를
  막는다"는 뜻이 아니라는 점을 명시한다

#### Scenario: 과잉 표현 금지

- **WHEN** 코드 주석, CLI 출력, 문서 중 어느 하나가 entry_hash의 역할을
  설명한다
- **THEN** "탐지"·"확인" 같은 표현만 쓰고 "보장"·"방지"·"증명" 같은 표현은
  쓰지 않는다

### Requirement: 사용자 발언과 AI 추론을 구분해 표시한다

용어 정의(`definition`)의 각 항목은 `origin: user_stated | ai_inferred`를
명시해야 한다(SHALL). AI가 추측한 정의를 사용자가 직접 말한 것처럼 표시해서는
안 된다(MUST NOT).

#### Scenario: 사용자가 직접 정의한 용어

- **WHEN** 사용자가 프롬프트에서 용어의 의미를 직접 밝혔다
- **THEN** 해당 정의는 `origin: user_stated`로 기록된다

#### Scenario: AI가 추론한 정의

- **WHEN** 원문에 명시되지 않은 용어의 의미를 AI가 추론한다
- **THEN** 해당 정의는 `origin: ai_inferred`로 기록된다
- **AND** 사용자 발언인 것처럼 표시되지 않는다

### Requirement: 모호성은 추측으로 메우지 않고 Finding 후보로 남긴다

반례 검증에서 다르게 해석될 수 있는 표현이나 모순을 발견하면, 시스템은 임의의
해석 하나를 확정하지 않고 `finding_candidates`에 기록해야 한다(SHALL). 정식
Finding으로의 승격 여부 판단은 이 change의 범위가 아니다(MUST NOT, 이 change가
직접 승격하지 않는다).

#### Scenario: 모호성 발견

- **WHEN** 반례 검증 중 둘 이상으로 해석 가능한 표현을 발견한다
- **THEN** 해당 모호성이 `finding_candidates`에 기록된다
- **AND** 임의의 해석 하나가 확정된 statement로 기록되지 않는다

### Requirement: 관계 검증 결과는 Graph edge가 아니다

관계 검증(`relation_check`) 단계의 산출물은 참고 메모이며, 확정되거나
구조 검증을 거친 Graph edge로 취급해서는 안 된다(MUST NOT).

#### Scenario: 관계 후보 기록

- **WHEN** 두 statement 사이에 관계가 있어 보인다고 AI가 판단한다
- **THEN** `relation_candidate`로 기록된다
- **AND** 이 change의 산출물만으로는 확정된 edge로 노출되지 않는다

### Requirement: CLI는 Clarification 내용을 추론하지 않는다

CLI는 6단계의 내용을 생성하거나 수정해서는 안 된다(MUST NOT). CLI는 입력
존재 확인, instruction과 입력 경로 안내, 출력 schema 계약 안내, 그리고
schema 기준의 완료 여부 판정만 수행해야 한다(SHALL).

#### Scenario: CLI의 역할

- **WHEN** 사용자가 `productkit clarify`를 실행한다
- **THEN** CLI는 Prompt 경로와 instruction을 안내하고 종료한다
- **AND** CLI 자신은 6단계 내용을 작성하지 않는다

#### Scenario: 완료 여부의 결정권

- **WHEN** AI가 Clarification artifact 작성을 마쳤다고 보고한다
- **THEN** CLI는 최신 `interpretation_check` 항목의 `user_response`, 해시 일치,
  `user_statement` 존재 여부를 직접 확인한 뒤에만 완료로 판정한다

### Requirement: 진입 경로는 Agent의 명시적 CLI 호출이며 네이티브 Skill 자동선택에 의존하지 않는다

`productkit intake`/`productkit clarify`는 설치 환경과 무관하게 항상 동작해야
한다(SHALL). 이 경로는 특정 Agent 도구의 네이티브 Skill 자동선택 기능이 있어야만
동작해서는 안 된다(MUST NOT). `productkit init`은 `product/` 밖에 아무것도
쓰지 않으므로(Change 01 원칙 유지) Claude Code의 `.claude/skills/` 자동 연결을
대신해 주지 않는다(MUST NOT) — 그런 연결은 사용자가 선택적으로 직접 한다.

#### Scenario: 명시적 호출(모든 환경에서 보장)

- **WHEN** Agent가 사용자와의 대화만으로 ProductKit 사용을 판단해 `intake`/
  `clarify`를 직접 실행한다
- **THEN** Claude Code의 네이티브 Skill 기능 유무와 무관하게 동일하게 동작한다

#### Scenario: CLI를 찾을 수 없음

- **WHEN** `productkit` 실행 파일을 찾을 수 없는 환경에서 Agent가 이를 호출하려
  한다
- **THEN** Agent나 사용자가 설치 방법을 알 수 있는 안내가 문서(skill instruction
  또는 README)에 있다

#### Scenario: workspace 미초기화 상태에서 clarify 시도

- **WHEN** `product/`가 없는 상태에서 `clarify`를 실행한다
- **THEN** `productkit init`을 먼저 실행하라는 안내와 함께 종료 코드 `2`로
  끝난다

#### Scenario: Prompt 없이 clarify 시도

- **WHEN** 저장된 Prompt가 하나도 없는 상태에서 `clarify`를 실행한다
- **THEN** `productkit intake`를 먼저 실행하라는 안내와 함께 종료 코드 `2`로
  끝난다

### Requirement: 이 change는 지정된 두 개의 stage 키만 갱신한다

CLI는 `product/config.yaml`의 `stages.ingest`, `stages.discover` 두 키만 갱신해야
한다(SHALL). 그 밖의 stage 키(`challenge`/`propose`/`decide`/`define`/`review`/
`validate`/`export`)를 읽거나 쓰지 않아야 하며(MUST NOT), `schema_version`을
바꾸지 않아야 한다(MUST NOT).

#### Scenario: intake 완료 기록

- **WHEN** `productkit intake`가 Prompt 저장에 성공한다
- **THEN** `stages.ingest`만 갱신된다

#### Scenario: 다른 stage 키는 불변

- **WHEN** `intake` 또는 `clarify`가 실행된다
- **THEN** 이 change 밖의 stage 키 값은 바뀌지 않는다

### Requirement: 파일 쓰기는 임시 파일과 교체로 처리하고, 실패해도 기존 데이터를 손상시키지 않는다

Prompt와 Clarification artifact를 쓰거나 갱신할 때, 시스템은 같은 디렉터리의
임시 파일에 먼저 쓰고 성공한 뒤에만 최종 경로로 교체(rename)해야 한다(SHALL).
쓰기 도중 오류가 발생하면 기존 파일(갱신의 경우) 또는 대상 경로(최초 생성의
경우)는 그대로여야 하며(MUST), 부분적으로 쓰다 만 손상된 파일을 최종 경로에
남겨서는 안 된다(MUST NOT). 실패 시 어떤 경로에서 무엇이 실패했는지 보고하고
종료 코드 `2`로 끝나야 한다(SHALL).

#### Scenario: 최초 생성 중 쓰기 실패

- **WHEN** `product/sources/`에 새 Prompt를 쓰는 중 파일시스템 오류가 발생한다
- **THEN** 오류 메시지와 경로가 표준 오류로 출력된다
- **AND** 종료 코드는 `2`다
- **AND** 최종 경로에 손상된 파일이 남지 않는다

#### Scenario: 갱신 중 쓰기 실패로 기존 내용 보존

- **WHEN** 이미 존재하는 Clarification artifact를 갱신하는 중 임시 파일 쓰기나
  교체가 실패한다
- **THEN** 기존 Clarification artifact 파일의 내용은 실패 이전 상태 그대로
  남는다
- **AND** 종료 코드는 `2`다
