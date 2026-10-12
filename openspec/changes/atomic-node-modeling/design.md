# Design

## Context

Change 02가 구현한 `judgeCompletion()`(Clarification 완료 판정, 저장된
`status`를 신뢰하지 않고 매번 재계산)과 `atomicWriteFile`(원자적 쓰기)은 이미
코드로 존재한다(`src/schema/clarification.ts`, `src/clarification/io.ts`).
이 change는 같은 패턴을 Node 레벨에 재사용한다 — 새 메커니즘을 또 만들지
않는다. 동기는 proposal.md - Why를 참고한다.

이 change가 지켜야 할 제약:

- CLI는 LLM을 호출하지 않는다(architecture.md 3장).
- 기계 검증은 결정적으로 판정 가능한 것만 판정한다(Constitution 8) — 원자성·
  왜곡 여부의 최종 판단은 AI 몫이고 CLI는 후보 신호와 해시 비교만 한다.
- 저장된 상태값은 진행 메모일 뿐 판정 근거가 아니다(Constitution 9).
- Change 01·02의 기존 코드·테스트·종료 코드 규약을 바꾸지 않는다(단,
  `product-workspace`의 디렉터리 집합 확장은 명시적으로 포함한다 — Modified
  Capabilities 참고).

## Goals / Non-Goals

**Goals:**

- 확정된 Clarification을 원자적 Node로 변환하는 데이터 계약
- 단일 검증 대상·분해 가능성·의미 보존 세 기준을 함께 평가하는 원자성 판단과
  CLI/AI 역할 경계
- 누락(커버리지)·추가(어휘 신호)·조건 변경·논리 연산자 변경·왜곡(역-합성
  비교)을 구분한 검증
- Node → Clarification → Prompt 추적 체인(중복 저장 없이)
- 소스 변경 시 자동 무효화(Change 02와 동일 메커니즘 재사용)
- Clarification의 확정이 Node 전체 승인으로 간주되지 않도록 하는 경계, 그리고
  위험 신호(추가/조건변경/연산자변경/왜곡)가 있을 때만 확정을 막는 선택적
  게이트

**Non-Goals:**

- Graph 관계 생성·의미 검증(Change 04)
- 정책 충돌·우선순위 판정(Change 07) — `policy` kind는 schema 자리만 만든다
- Finding의 정식 승격과 해소 절차(Change 05~06) — 이 change는 위험 신호를
  Finding 후보로 기록하고 완료를 막는 것까지만 하고, 그 후보를 정식
  Finding으로 승격하거나 해소하는 UI/명령은 만들지 않는다
- EARS/CACEP 같은 구체화 포맷 강제 — 이전 세션에서 조사·제안된 바 있으나
  어떤 OpenSpec 변경에도 아직 채택되지 않았다. 이번에 새로 끌어들이지 않고
  Node.statement는 자유 문장으로 둔다. 필요해지면 별도 제안으로 다룬다.

## Decisions

### D1. Node는 새 디렉터리 `product/nodes/`에 둔다 — `discovery/`를 더 늘리지 않는다

Change 02의 D2는 "새 디렉터리를 만들지 않는다, Change 03이 재검토한다"고 남겨
뒀다. 지금이 그 재검토 시점이다. `discovery/`는 이미 Clarification(CLR-xxx)을
담고 있고, Node는 그것과는 다른 생애주기(소스가 바뀌면 stale이 되는 파생물)를
가진 별도 개념이다. 같은 디렉터리에 성격이 다른 두 artifact를 계속 쌓으면
"무엇이 원본이고 무엇이 파생물인지"가 디렉터리 구조만으로 안 보이게 된다.
대안(계속 `discovery/`에 욱여넣기)은 기각한다. 이 결정은 `product-workspace`
capability를 수정하므로(Modified Capabilities), 구현 시 `ARTIFACT_DIRS`와
관련 테스트 숫자를 함께 갱신해야 한다(proposal.md Impact 참고).

### D2. 원자성은 단일 검증 대상·분해 가능성·의미 보존 세 기준을 함께 평가한다

이전 설계는 "독립적 변경 가능성" 하나로 원자성을 확정했다. 사용자 검토에서
기각됐다 — 그 기준 하나만으로는 "독립적인 여러 행동이 공유 트리거 아래 묶인
경우"(예: "결제가 완료되면 주문을 확정하고, 이메일을 보내고, 재고를
차감한다")를 제대로 다루지 못한다. 이 경우 "조각 하나를 빼도 나머지가
유효한가"라는 질문만으로는 **분해해야 한다**는 결론에 도달할 수는 있지만,
분해 자체가 필요한지를 먼저 판단하는 기준(이 문장이 애초에 몇 개의 독립
관찰 가능한 결과를 담고 있는가)과 분해했을 때 공유된 트리거를 잃지 않는지를
확인하는 기준이 따로 없었다. 세 기준으로 나눈다:

1. 단일 검증 대상(분해가 필요한지 먼저 판단) — ISO 29148의 "singular" 개념과
   비슷하지만 그 표준 전체를 끌어오지는 않는다(D2 비고 참고)
2. 분해 가능성(기존 "독립적 변경 가능성" 테스트를 여기로 좁혀서 재사용 —
   고아 조각이 생기는지만 본다)
3. 의미 보존(분해/유지 결과가 공유 조건·트리거를 포함해 원래 의미를 보존하는지)

대안이었던 ISO/IEC/IEEE 29148 14개 속성 전체 채택은 다시 기각한다 — 이번
요청 범위("세 가지를 함께 평가")에 비해 과하고, 어떤 OpenSpec change에도
채택된 적이 없다. 구조 신호(접속사·복수 서술어)는 여전히 CLI가 결정적으로
셀 수 있는 보조 후보 탐지로만 쓴다.

### D3. Node별 재확인은 생략하되, 위험 신호 4종에 한해 확정을 막는다

이전 설계는 "Clarification 확정 시점 동의로 충분하다"며 Node화 전체에 사람
재확인을 생략했다. 사용자 검토에서 정정됨 — Clarification의 동의는
**명료화 내용**에 대한 동의이지, 그걸 어떻게 쪼갤지(Node화)에 대한 동의가
아니다. 다만 매 Node 그룹마다 Change 02와 같은 전체 재확인 라운드를 새로
요구하는 건 기각한다(승인 피로, 이전 세션에서 반복 지적된 위험). 절충안:
일상적인 분해(위험 신호 없음)는 재확인 없이 진행하고, 추가·조건 변경·논리
연산자 변경·왜곡 네 가지 중 하나라도 감지되면 그 Node를 포함한 집합
전체를 `modeled`로 확정하지 못하게 막는다(`status: open`인 위험 신호
Finding 후보가 하나라도 있으면 `needs_review`). 이 네 가지 바깥의 일반
모호성(단순 용어 확인 등)은 확정을 막지 않는다 — 전부 막으면 Change 02에서
생긴 승인 피로 문제가 Node 레벨에서 재발한다.

이 change는 위험 신호 Finding 후보를 **해소하는 절차**(Decision, 범위 결정
등)를 제공하지 않는다 — 그건 Change 05~06의 몫이다. 즉 위험 신호가 있는
Node 집합은 Change 05~06이 구현되기 전까지는 사실상 영구히 `needs_review`에
머무를 수 있다(Risks 참고).

### D4. 소스 변경에 따른 무효화는 Change 02의 해시 패턴을 그대로 재사용한다

새 메커니즘을 발명하지 않는다. Clarification의 `presented_hash` /
`judgeCompletion()`과 완전히 같은 구조(`source_content_hash` 비교, 저장된
`status` 불신)를 Node 집합에 적용한다. 일관성을 위해 함수 이름과 구조도
가능한 한 대칭으로 맞춘다(`nodeSetContentHash()`, `judgeNodeSetCompletion()`
— 구현 시 결정).

### D5. `product-workspace` MODIFIED delta는 Change 01 archive 이후에만 실제로 적용된다

`npx openspec validate atomic-node-modeling --strict`를 돌리면 다음 INFO가
뜬다: `product-workspace/spec.md: Archive would refuse this delta: ...target
spec does not exist; only ADDED requirements are allowed for new specs.`
`openspec/specs/`가 아직 비어 있어서(Change 01이 archive된 적 없음) 생기는
당연한 결과다. Change 단위 validate는 통과하지만(proposal/specs/design/tasks
형식 자체는 유효), **이 change를 archive하려면 Change 01의
`product-workspace`(ADDED)가 먼저 archive돼 있어야 한다.** 순서: Change 01 →
(Change 02는 `product-workspace`를 건드리지 않으므로 순서 무관) → Change 03.
이 change 자체의 구현 여부와는 별개로, archive 순서 제약이 있다는 사실을
지금 기록해 둔다.

## Risks / Trade-offs

- [D1이 `product-workspace`를 수정하므로 Change 01 이후 처음으로 기존 Change의
  구현 코드를 건드리는 Change가 됨] → 구조를 깨지 않고 디렉터리 하나만
  추가하는 것으로 범위를 한정한다. 기존 9개 디렉터리·파일은 전혀 안 바뀐다.
  영향받는 테스트(생성 개수 단언)는 proposal.md Impact에 명시해 구현 시
  누락되지 않게 한다.
- [D3에서 위험 신호 없는 Node화에는 사람 재확인을 생략하므로, 네 가지 위험
  유형으로 분류되지 않는 미묘한 의미 변화를 놓칠 위험] → 네 가지 유형이
  가장 흔한 실패 모드를 겨냥한 것이지 전체 집합을 보장하지 않는다. 이
  change 자체로는 완전히 해소되지 않는 잔여 위험이다.
- [D3의 위험 신호 Finding 후보를 해소하는 절차가 이 change에는 없고 Change
  05~06이 구현되기 전까지 존재하지도 않음] → 위험 신호가 있는 Node 집합은
  당분간 `needs_review`에 머문다. 사용자가 당장 처리하고 싶다면 Change
  05~06을 먼저 구현하거나, 최소한의 "범위 결정" 기록 방법을 별도로 정해야
  한다 — 이 change의 범위 밖이다.
- [구조 신호(접속사 개수)가 없는 자연어는 분해 필요 여부를 AI 판단에 전적으로
  의존하게 됨] → 이미 알려진 한계(이전 세션부터 반복 확인), 이 change에서
  해결 범위 밖이다.

## Open Questions

없음. Change 02에서 넘어온 두 미해결 항목(narrow 조건 형식의 현실 커버리지,
Challenge 완료 판정 기준)은 각각 Change 07, Change 05 범위이며 이 change의
설계를 막지 않는다.

## Integration Testing Notes (실제 Agent 검증 중 발견)

Claude Code Agent로 실제 아이디어 2개(독립 행동 3개짜리 요구사항, OR+NOT
결합 정책)를 진짜로 Clarification→Node Modeling까지 수행하며(해석 확인은
실제 사용자 동의가 없어 별도로 명시 표시한 모의 데이터만 사용) 발견한 것.

- **`distortion_checks`가 확정을 막지 못하던 버그**: 모든 Node의
  `atomicity.final`이 `atomic`이고 `finding_candidates`가 비어 있어도,
  `distortion_checks`에 `distorted`/`uncertain` 기록이 있으면 여전히
  `modeled`로 잘못 판정됐다 — spec.md의 "왜곡은 `preserved`로 자동 승격되지
  않는다"는 "기록 자체가 그렇게 안 된다"는 뜻이었지 "기록이 확정을 막는다"는
  뜻으로 코드에 반영돼 있지 않았다. `judgeNodeSetCompletion()`에
  `unresolved_distortion_check` 사유를 추가해, `finding_candidates`를
  따로 열지 않아도 `distortion_checks` 자체가 확정을 막도록 고쳤다.
- 두 실제 사례 모두 결과적으로 `needs_review`로 남았다 — 둘 다 원문에 진짜
  모호성(알림 수신자가 누구인지, 가입 1년의 기준 시점)이 있었기 때문이다.
  이건 "AI가 실패했다"가 아니라 "원자성 게이트가 억지로 확정하지 않고 정직하게
  막았다"는 뜻으로 읽어야 한다 — 보고서에 테스트 통과로 과장하지 않는다.
