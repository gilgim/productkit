# Spec Delta

## Purpose

확정된 Clarification을 단일 검증 대상·분해 가능성·의미 보존 세 기준을 함께
평가해 원자적 Node로 변환하고, 원문 의미의 누락·추가·조건/연산자 변경·왜곡을
구조적/의미적으로 구분해 검증하며, 소스가 바뀌면 자동으로 무효화되는 변환
단계를 정의한다.

## ADDED Requirements

### Requirement: Node는 confirmed 상태인 Clarification에서만 생성된다

시스템은 `status`가 `confirmed`로 판정된 Clarification(Change 02의
`judgeCompletion()` 기준)만 Node 변환의 입력으로 받아야 한다(SHALL). 미확정
Clarification으로부터 Node를 생성해서는 안 된다(MUST NOT).

#### Scenario: 확정된 Clarification 입력

- **WHEN** `judgeCompletion()`이 `confirmed: true`를 반환하는 Clarification을
  입력한다
- **THEN** Node 변환이 진행될 수 있다

#### Scenario: 미확정 Clarification 거부

- **WHEN** 아직 confirmed가 아닌 Clarification으로 Node 변환을 시도한다
- **THEN** 변환은 거부되고 어떤 Node도 생성되지 않는다

### Requirement: 원자성은 단일 검증 대상·분해 가능성·의미 보존을 함께 평가해 판단한다

원자성은 독립적 변경 가능성 하나만으로 확정해서는 안 된다(MUST NOT). 시스템은
다음 세 가지를 모두 평가해야 한다(SHALL).

1. **단일 검증 대상**: 이 Node(또는 분해 전 decomposition 항목)가 독립적으로
   관찰·판정 가능한 결과를 하나만 갖는가. 둘 이상의 독립적으로 관찰 가능한
   결과를 하나의 문장에 담고 있으면 분해 대상이다.
2. **분해 가능성**: 분해가 필요하다고 판단된 경우, 쪼갠 조각 각각이 다른
   조각 없이도 의미 있게 성립하는가(= 독립적 변경 가능성). 한 조각만 떼어도
   나머지가 고아가 되지 않아야 유효한 분해다. 조각이 서로의 전제조건이라 하나만
   빼면 나머지가 성립하지 않으면(예: 여러 조건이 결합된 단일 정책) 분해하지
   않고 하나의 Node로 유지해야 한다(MUST).
3. **의미 보존**: 분해하기로 했든 하나로 유지하기로 했든, 그 결과가 원래
   decomposition 항목의 의미(공유된 조건·트리거 포함)를 빠짐없이 그대로
   전달하는가.

세 기준 중 하나라도 불충족하면 그 Node(군)는 원자적으로 확정되지 않는다(MUST
NOT 확정). 단순히 문장 길이를 줄이는 것을 원자화로 취급하지 않는다(MUST NOT).

#### Scenario: [정상] 이미 단일 검증 대상인 경우

- **WHEN** 하나의 decomposition 항목이 독립적으로 관찰 가능한 결과를 하나만
  담고 있다(예: "할 일을 추가할 때 마감일을 설정할 수 있다")
- **THEN** 분해 없이 그대로 하나의 Node가 된다

#### Scenario: [반례 A] 독립적인 여러 행동이 포함된 경우 — 분해한다

- **WHEN** 하나의 decomposition 항목에 공유된 트리거 아래 독립적으로 관찰·
  변경 가능한 여러 행동이 있다(예: "결제가 완료되면 주문을 확정하고, 확인
  이메일을 보내고, 재고를 차감한다" — 세 결과 모두 각각 성공/실패를 따로
  확인할 수 있고 하나만 없애도 나머지는 그대로 유효하다)
- **THEN** 행동별로 별도 Node 3개로 분해된다
- **AND** 각 Node는 공유된 트리거("결제가 완료되면")를 자신의 statement 또는
  구체화 필드에 그대로 보존한다(의미 보존 — 트리거를 누락한 분해는 거부된다)

#### Scenario: [반례 B] 복합 조건이 하나의 정책을 구성하는 경우 — 분해하지 않는다

- **WHEN** 하나의 decomposition 항목이 여러 조건이 결합돼야만 의미가 성립하는
  단일 정책이다(예: "3회 이상 실패했고 최근 1시간 이내면 계정을 잠근다" — 조건
  하나만 떼면 "무엇을 어떻게 하라는 건지" 성립하지 않는다)
- **THEN** 조건들을 별도 Node로 쪼개지 않고 하나의 `policy` kind Node로
  유지한다(분해 가능성 평가에서 "고아 발생"으로 판정되어 원자성 조건 2를
  충족하지 못하므로 유지)

#### Scenario: [경계] 단일 검증 대상 판정이 불확실한 경우

- **WHEN** 하나의 결과만 담은 것처럼 보이지만 관찰 가능한 결과가 하나인지
  여럿인지 AI가 확신할 수 없다
- **THEN** 분해 여부를 임의로 확정하지 않고 `uncertain`으로 신뢰수준과 함께
  기록하며, 아래 "위험 신호" 요구사항에 따라 Finding 후보로 남긴다

#### Scenario: [경계] 분해했지만 의미 보존에는 실패한 경우

- **WHEN** 단일 검증 대상·분해 가능성 기준으로는 분해가 맞았지만, 분해 결과
  중 하나가 공유 트리거나 조건을 누락해 원래 의미를 온전히 전달하지 못한다
- **THEN** 그 분해는 원자적으로 확정되지 않는다(MUST NOT) — 세 기준 모두
  충족해야 확정됨을 재확인한다

### Requirement: 원자성 판정은 구조적 후보 신호와 의미적 판단으로 나뉜다

CLI는 접속사·복수 서술어 개수 같은 결정적으로 셀 수 있는 신호만으로 "분해
검토 후보"를 표시해야 한다(SHALL). 단일 검증 대상·분해 가능성·의미 보존 세
기준의 실제 판정은 모두 AI가 신뢰수준과 함께 내려야 하며(SHALL), CLI가 이
셋 중 어느 하나라도 검증했다고 표시해서는 안 된다(MUST NOT).

#### Scenario: 구조 신호로 후보만 표시

- **WHEN** CLI가 decomposition 항목에서 접속사 2개 이상을 센다
- **THEN** "분해 검토 필요" 후보로만 표시하고, 분해 여부를 CLI가 확정하지
  않는다

#### Scenario: 구조 신호 없이도 의미적으로 분해가 필요한 경우

- **WHEN** 접속사 없이 한 문장에 독립적인 두 요구가 암묵적으로 섞여 있다
- **THEN** 구조 신호는 없더라도 AI가 분해를 판단할 수 있다 — 구조 신호
  부재가 "분해 불필요"를 의미하지 않는다

### Requirement: Node는 derived_from으로 생성 출처를 추적할 수 있다

Node는 자신을 만든 Clarification과 그 안의 특정 decomposition 항목을 가리키는
`derived_from`을 가져야 한다(SHALL). 이 참조가 비어 있으면 안 된다(MUST NOT).
Prompt까지의 추적은 Node → Clarification → Prompt로 체인을 따라가며 확인하고,
Node가 Prompt를 직접 가리키는 별도 필드를 중복으로 두지 않는다(MUST NOT) —
Clarification이 이미 Prompt를 추적하고 있으므로 같은 정보를 두 곳에서
독립적으로 관리하지 않는다.

#### Scenario: 생성 출처 기록

- **WHEN** decomposition 항목 하나로부터 Node를 만든다
- **THEN** 그 Node의 `derived_from`은 해당 Clarification id와 decomposition
  항목을 가리킨다

#### Scenario: Prompt까지의 추적은 체인으로 확인

- **WHEN** 어떤 Node가 원문의 어느 부분에서 왔는지 확인해야 한다
- **THEN** Node.derived_from → Clarification.prompt_ref → Prompt.spans 순서로
  조회하며, Node에 별도의 Prompt 직접 참조 필드는 없다

#### Scenario: 출처 없는 Node 거부

- **WHEN** `derived_from`이 비어 있는 Node를 생성하려는 시도가 있다
- **THEN** 해당 시도는 거부된다

### Requirement: 분해 누락·추가·조건 변경·논리 연산자 변경·왜곡을 구분해 검증한다

시스템은 다음을 구분해 검증해야 한다(SHALL).

1. **누락**: 한 Clarification의 모든 decomposition 항목이 하나 이상의 Node로
   덮여야 한다. 덮이지 않은 항목은 구조적으로(CLI) 탐지한다.
2. **추가**: Node의 `statement`에 그 출처 decomposition 항목에 없던 새 어휘가
   많이 등장하면 "추가 의심" 후보로 구조적으로(CLI) 표시한다. 이는 약한 신호일
   뿐 확정 판정이 아니다(MUST NOT 확정 판정으로 표시).
3. **조건 변경**: 분해 결과의 조건(elaboration의 `condition`)이 원래
   decomposition 항목의 조건과 범위가 달라졌는지(넓어짐/좁아짐/다른 조건으로
   교체) AI가 비교해 기록해야 한다(SHALL).
4. **논리 연산자 변경**: 원래 항목의 AND/OR/NOT 결합이 분해 결과에서 그대로
   유지되는지 AI가 비교해 기록해야 한다(SHALL) — 예를 들어 "A이고 B이면"을
   분해하면서 "A이거나 B이면"처럼 바뀌면 안 된다.
5. **왜곡**: 한 decomposition 항목에서 나온 모든 Node를 논리적으로 재합성한
   문장을 원래 항목과 비교해, `preserved`/`distorted`/`uncertain` 중 하나를
   신뢰수준과 함께 기록해야 한다(SHALL). 이 비교는 의미 보존을 증명하지
   않는다(MUST NOT 증명으로 표시) — Change 02의 해석확인과 같은 한계를
   공유한다.

#### Scenario: 누락 탐지

- **WHEN** decomposition 항목 중 하나가 어떤 Node의 `derived_from`에도
  등장하지 않는다
- **THEN** 커버리지 검증이 실패로 보고된다

#### Scenario: 추가 의심 플래그

- **WHEN** Node의 statement가 출처 decomposition 항목과 겹치는 어휘가 적다
- **THEN** "추가 의심" 후보로 표시되고, 확정된 오류로 보고되지 않는다

#### Scenario: 조건 범위 변경 탐지

- **WHEN** 원래 "마감일이 지나면"(날짜 전체)이던 조건이 분해 결과에서 "마감일
  당일 자정이 지나면"처럼 더 좁은 조건으로 바뀐다
- **THEN** 조건 변경 후보로 기록된다

#### Scenario: 논리 연산자 변경 탐지

- **WHEN** 원래 "A이고 B이면"(AND)이던 결합이 분해 결과에서 "A이거나
  B이면"(OR)처럼 바뀐다
- **THEN** 논리 연산자 변경 후보로 기록된다

#### Scenario: 왜곡 가능성 기록

- **WHEN** 역-합성 문장이 원래 decomposition 항목과 의미가 달라 보인다
- **THEN** `distorted` 또는 `uncertain`으로 신뢰수준과 함께 기록된다
- **AND** `preserved`로 자동 승격되지 않는다

#### Scenario: 왜곡 기록 자체가 확정을 막는다(Finding 후보 생성 여부와 무관)

- **WHEN** `distortion_checks` 항목 중 하나가 `preserved`가 아니다
- **THEN** 그 사실만으로 NodeGroup은 `modeled`가 될 수 없다
- **AND** 이를 가리키는 `finding_candidates` 항목이 따로 없어도 판정은 막힌다
  (실제 Agent 통합 검증에서 발견: 매칭되는 Finding 후보를 깜빡하면 왜곡
  기록이 있어도 조용히 통과하던 문제를 고친 것이다)

### Requirement: Clarification의 해석 확인은 Node 모델링 결과 전체에 대한 사용자 승인이 아니다

Clarification이 `confirmed`라는 사실은 그로부터 파생된 Node 모델링 결과
전체가 사용자에게 승인됐다는 뜻으로 간주해서는 안 된다(MUST NOT). Node별
재확인은 기본적으로 생략하되(원문 그대로 보존되는 일상적인 분해에는 추가
확인을 요구하지 않는다), 추가·조건 변경·논리 연산자 변경·왜곡 가능성 중
하나라도 감지되면 그 Node(군)는 별도 확인 전까지 "모델링 완료"로 확정할 수
없다(MUST NOT).

#### Scenario: 일상적인 분해는 재확인 없이 진행

- **WHEN** 위험 신호(추가/조건변경/연산자변경/왜곡) 없이 커버리지와 원자성
  기준을 모두 만족한다
- **THEN** 추가 사용자 확인 없이 해당 Node(군)는 모델링 완료로 판정될 수 있다

#### Scenario: 위험 신호가 있으면 전체 확정을 막는다

- **WHEN** 한 Node에서 추가 의심·조건 변경·논리 연산자 변경·왜곡 중 하나가
  감지된다
- **THEN** 그 Node를 포함한 Node 집합 전체는 `modeled` 상태가 될 수 없다
- **AND** 해당 위험은 Node 전용 Finding 후보로 기록된다(아래 요구사항)

### Requirement: 위험 신호가 있는 Node는 Finding 후보로 기록되고 해소 전까지 확정을 막는다

추가·조건 변경·논리 연산자 변경·왜곡 중 하나가 감지된 Node는 `type:
addition | condition_change | operator_change | distortion` 중 하나를 가진
Finding 후보로 기록돼야 한다(SHALL). 이 Finding 후보는 `status: open |
resolved | deferred | dismissed`를 가지며(SHALL), `open`인 동안 해당 Node를
포함한 Node 집합은 `modeled`로 판정될 수 없다(MUST NOT). 이 change는 Finding
후보를 정식 Finding으로 승격하거나 해소 절차를 제공하지 않는다(MUST NOT) —
해소는 Change 05~06의 범위다.

#### Scenario: 위험 신호 Finding 기록

- **WHEN** Node 하나에서 조건 변경이 감지된다
- **THEN** `type: condition_change`, `status: open`인 Finding 후보가 생성된다

#### Scenario: 열린 위험 신호가 있으면 Node 집합이 완료되지 않는다

- **WHEN** Node 집합에 `status: open`인 위험 신호 Finding 후보가 하나 이상
  있다
- **THEN** `judgeNodeSetCompletion()`은 `needs_review`를 반환하고 `modeled`를
  반환하지 않는다

#### Scenario: 위험 신호가 아닌 일반 모호성은 완료를 막지 않는다

- **WHEN** Node 집합에 위 네 가지 유형에 속하지 않는 일반 모호성(예: 단순
  용어 확인 요청)만 있다
- **THEN** 그 일반 모호성은 `judgeNodeSetCompletion()`의 판정을 막지 않는다
  (네 가지 위험 유형만 확정을 막는다)

### Requirement: 소스 Clarification이 바뀌면 Node 집합은 자동으로 무효화된다

Node 집합은 생성 시점의 소스 `steps`를 정규화한 해시(`source_content_hash`)에
묶여야 한다(SHALL). 이후 그 Clarification의 `steps`가 바뀌면, 현재 해시와
비교해 불일치가 나와야 하며(SHALL), 저장된 `status` 값과 무관하게 재모델링이
필요한 것으로 판정해야 한다(MUST) — Change 02의 `judgeCompletion()`과 같은
원칙(Constitution 9: 저장된 상태는 진행 메모일 뿐 판정 근거가 아니다)을
따른다.

#### Scenario: 소스 불변 시 유효

- **WHEN** Node 집합 생성 이후 소스 Clarification의 `steps`가 바뀌지 않았다
- **THEN** 해시가 일치하고 Node 집합은 그대로 유효하다

#### Scenario: 소스 변경 시 무효화

- **WHEN** Node 집합 생성 이후 소스 Clarification의 `steps`가 수정된다
- **THEN** 현재 해시가 `source_content_hash`와 달라져 Node 집합이 stale로
  판정된다
- **AND** 파일에 적힌 Node 집합의 `status`가 여전히 `modeled`라고 돼 있어도
  CLI는 그대로 믿지 않는다

### Requirement: CLI는 Node 내용을 생성하지 않는다

CLI는 Node의 statement나 원자성 판단을 생성하거나 수정해서는 안
된다(MUST NOT). CLI는 입력(확정 Clarification) 존재 확인, instruction과 경로
안내, 커버리지·해시 일치 여부의 결정적 판정만 수행해야 한다(SHALL).

#### Scenario: CLI의 역할

- **WHEN** 사용자가 Node 모델링 명령을 실행한다
- **THEN** CLI는 입력 경로와 instruction을 안내하고 종료한다
- **AND** CLI 자신은 Node statement를 작성하지 않는다

### Requirement: 중단된 Node 모델링은 이어서 진행할 수 있다

일부 decomposition 항목만 Node로 변환된 상태에서 중단되면, 시스템은 이미
변환된 항목을 다시 요구하지 않고 커버리지가 비어 있는 항목부터 이어서
진행할 수 있어야 한다(SHALL).

#### Scenario: 부분 모델링 후 재개

- **WHEN** decomposition 항목 3개 중 1개만 Node로 변환된 채 중단된다
- **THEN** 재개 시 나머지 2개만 변환 대상으로 안내된다

### Requirement: 쓰기는 원자적으로 처리하고 실패해도 기존 Node를 손상시키지 않는다

Node 집합을 쓰거나 갱신할 때 시스템은 임시 파일과 교체(rename) 방식을 써야
하며(SHALL), 쓰기 실패 시 기존 파일은 그대로 보존돼야 한다(MUST) — Change 02의
`atomicWriteFile` 패턴을 재사용한다(MUST, 새로 구현하지 않는다).

#### Scenario: 갱신 중 쓰기 실패

- **WHEN** Node 집합 파일을 갱신하는 중 쓰기가 실패한다
- **THEN** 기존 파일 내용은 실패 이전 상태 그대로 남는다
