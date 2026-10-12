# Design

## Context

Change 01만 구현되어 있고 `openspec/specs/`는 비어 있다(Change 01의 spec delta가
아직 archive되지 않음). 즉 Canvas 전제를 걷어내는 데 깨야 할 구현된 코드나 archive된
main spec이 없다 — 바꿔야 할 대상은 계획 문서(`docs/roadmap.md`,
`docs/architecture.md`, `docs/artifact-contracts.md`)와 아직 적용되지 않은 Change
02~08의 설계 방향뿐이다. 동기는 proposal.md - Why를 참고한다.

## Goals / Non-Goals

**Goals:**

- Canvas 전제를 걷어낸 입력 모델(prompt-first)을 기존 Constitution 원칙(1, 2, 4,
  8, 9) 위에서 재구성한다.
- 기존 schema 어휘(Source/Discovery/Finding/Decision)를 재사용하고, 정말 새로
  필요한 개념(typed relation graph)만 새 capability로 분리한다.
- Change 02~08 중 무엇을 폐기·유지·재정의할지 번호 단위로 확정한다.

**Non-Goals:**

- Clarification/Graph Analysis를 구현하는 CLI 명령, schema, instruction 본문
  작성 (proposal.md - What Changes 참고, 후속 change의 몫이다).
- `docs/roadmap.md`·`docs/architecture.md`·`docs/artifact-contracts.md`의 실제
  문구 수정 (tasks.md에서 후속 작업으로 분리).
- Node ID 접두사, CLI 명령 이름 같은 명명 규칙 확정.

## Decisions

### D1. Source 계약은 Canvas 전용 필드만 제거하고 원문 보존 필드는 유지한다

대안은 Source 계약 자체를 새로 설계하는 것이다. 그러나 `raw_text`,
`origin_hash`처럼 "원문을 그대로 보존한다"는 역할은 입력이 Canvas든 프롬프트든
동일하다. `canvas_node_id`/`canvas_edge_id`/좌표 기반 `derived`만 프롬프트 입력에
의미가 없으므로 제거하고, 나머지 필드는 유지한다. Constitution 4(원문부터 최종
정의까지 추적 가능해야 한다)를 그대로 만족시키면서 변경 범위를 줄인다.

### D2. 원자성은 새 artifact 타입이 아니라 기존 Discovery/Finding statement에 거는 제약으로 구현한다

대안은 Discovery와 별도로 "Atomic Node" artifact를 새로 만드는 것이다. 그러나
Discovery(DSC)는 이미 `statement`/`origin`/`source_refs`/`confidence` 필드를
갖고 있어 원자성 제약(하나의 statement = 하나의 명료화된 단위)을 얹기에
충분하다. 별도 artifact를 만들면 같은 개념을 두 곳에서 관리하게 되어
Constitution의 "같은 필드를 양쪽에서 독립적으로 관리하지 않는다" 원칙과
충돌한다. `node-graph-analysis` spec의 "Node"는 원자성 제약이 적용된
Discovery/Finding 항목을 가리키는 것으로 본다.

### D3. Graph Analysis는 AI가 작성하는 새 산출물이며, CLI는 구조적 검증만 한다

대안은 CLI가 관계를 직접 추론하는 것이다. 이는 "CLI는 LLM을 호출하지 않는다"는
핵심 계약(architecture.md 3번, Constitution 8)과 정면으로 충돌하므로 선택하지
않는다. Graph Analysis는 discover/challenge/define과 같은 AI 단계로 분류하고,
CLI는 입력 node 목록과 출력 schema 계약을 안내한 뒤 schema 형식·순환 참조·고아
참조만 결정적으로 검증한다(`node-graph-analysis` spec 참고).

### D4. Human Approval은 새 Gate를 만들지 않고 기존 Decision + Validate Gate로 흡수한다

대안은 "Human Approval"이라는 새 artifact/상태를 만드는 것이다. 그러나 이미
Decision(DEC)이 "사용자의 명시적 선택이 있어야만 생성된다"(Constitution 1)는
계약을 갖고 있고, Change 07 Validate Gate가 `definition.status`를 문서 내용
기준으로 재판정한다(Constitution 9). 새 artifact를 추가하면 "승인"의 의미를
가진 개념이 둘로 쪼개져 어느 쪽이 진짜 승인인지 모호해진다. Graph Analysis
결과로 갱신된 `overview.md`/`policies/`가 `definition.status: confirmed`로
가려면 반드시 관련 Decision을 거치도록 요구하는 쪽을 택한다.

### D5. Change 02는 폐기하고, Change 03~08은 번호를 유지한 채 범위만 재정의한다

대안은 번호를 전부 새로 매기는 것이다. 그러나 Change 02~08은 전부 "계획" 상태이고
구현된 코드나 archive된 spec이 없으므로, 번호를 유지한 채 Change 03(Discovery)을
Clarification + 원자성 제약으로, Change 04(Challenge)를 Finding + Graph
Analysis의 구조적 검증으로 범위를 재정의하는 쪽이 `docs/roadmap.md` 변경 diff를
작게 만든다. Change 02 번호는 비워두고 "폐기됨"으로 표기한다(건너뛴 것으로
혼동되지 않도록 사유를 남긴다).

## Risks / Trade-offs

- [원자성 제약을 기존 Discovery/Finding statement에 거는 방식(D2)은 "원자성
  위반"을 기계적으로 판정하기 어려울 수 있다(복합 문장 여부는 의미 판단에
  가깝다)] → Change 03 재정의 시 판정 가능한 최소 신호(예: 문장 내 접속사·복수
  동사 존재 여부)만 기계 검증으로 걸고, 나머지는 AI Review 영역으로 둔다
  (Constitution 8과 동일한 경계).
- [Change 02를 폐기하면서도 번호를 비워두면(D5) 문서를 처음 보는 사람이
  "02가 어디 갔지"라고 혼동할 수 있다] → `docs/roadmap.md` 표에 "폐기됨 — 이
  change로 대체"처럼 사유와 대체 change를 함께 적는다.
- [Graph Analysis의 "구조적 검증만 한다"는 경계(D3)가 느슨해져 CLI가 점점 의미
  검증까지 떠안을 수 있다] → `node-graph-analysis` spec의 "CLI는 Graph의
  구조적 무결성만 검증한다" 요구사항을 후속 구현 change의 수용 기준으로 그대로
  가져간다.

## Migration Plan

이 change 자체는 코드를 바꾸지 않는다. 확정 후 순서는 tasks.md에 그대로 따른다:
문서(`roadmap.md` → `architecture.md` → `artifact-contracts.md`) 개정이 먼저이고,
그 다음에야 `prompt-clarification`/`node-graph-analysis` 구현 change를 새로
제안한다. 롤백은 이 change를 archive하지 않고 두면 되므로 별도 절차가 필요 없다.

## Open Questions

- Clarification을 `productkit clarify` 같은 별도 명령으로 노출할지, 아니면
  `discover` 내부 절차로 둘지 — 이 change의 spec은 명령 경계를 규정하지 않으므로
  후속 구현 change에서 결정해도 spec·접근법·tasks가 바뀌지 않는다.
- Node ID 접두사를 새로 만들지(`NOD-xxx`), 기존 `DSC-xxx`/`FND-xxx`를 재사용할지
  — 마찬가지로 후속 구현 change의 schema 작업에서 결정한다.
