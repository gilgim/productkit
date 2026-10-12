# Proposal

## Why

`docs/roadmap.md`의 Change 02~08과 `docs/architecture.md`의 파이프라인은 입력
source를 Obsidian Canvas(JSON Canvas 1.0 파일)로 전제한다. 그러나 목표 아키텍처는
입력을 자연어 프롬프트로 단일화하고, Node와 Graph를 사용자가 그리는 입력 형식이
아니라 ProductKit이 내부적으로 생성·관리하는 산출물로 바꾼다. Change 01만 구현된
지금이 이 방향 전환을 반영할 마지막 시점이다 — Change 02(Canvas Ingest)부터 설계를
시작하면 Canvas 전제가 Source 계약과 이후 모든 Change에 고정된다.

## What Changes

- **BREAKING**: Change 02 "Canvas Ingest"를 목표 아키텍처에서 제거한다. JSON Canvas
  1.0 파싱, 좌표·크기 보존, `canvas_node_id`/`canvas_edge_id`, 좌표 기반 group
  포함관계(`derived`) 같은 Canvas 전용 개념을 더 이상 만들지 않는다.
- Source 계약(`docs/artifact-contracts.md`)의 입력 origin을 "Canvas 원본"에서
  "사용자가 입력한 프롬프트 원문"으로 바꾼다. `raw_text`·`origin_hash`처럼 원문을
  그대로 보존하는 필드는 유지하고, Canvas 전용 필드만 제거한다.
- 새 단계 **Clarification**을 공식 절차로 추가한다: 정의 → 분해 → 구체화 → 관계
  검증 → 반례 검증 → 해석 확인의 6단계로 모호한 프롬프트를 명료화한다. 기존 Change
  03 Discovery가 하던 "원문과 추론 분리"(`origin: source | inference`) 역할을
  흡수하되, 모호성 해소 자체를 명시적 단계로 승격한다.
- Discovery(DSC) 산출물에 **원자성(atomicity)** 제약을 추가한다: 하나의
  `statement`에는 Clarification의 "분해" 단계를 거친 단일 주장·조건·행위만
  담는다. 복합 문장을 쪼개지 않고 넣는 것은 금지한다(MUST NOT).
- 새 capability **Graph Analysis**를 추가한다: 기존 schema의 flat
  `source_refs`/`finding_refs` 배열로는 표현할 수 없는 typed relation(인과·의존·
  충돌·대체 등)을 Node 사이에 명시한다. 이 relation은 AI가 추론해 작성하는
  산출물이고, CLI는 schema 형식·순환 참조·고아 참조처럼 결정적으로 판정 가능한
  것만 검증한다(Constitution 8 유지).
- Change 04 Challenge(Finding)는 유지하되 발견 시점이 당겨진다: 모호성·반례
  자체가 Clarification의 "반례 검증"·"해석 확인" 단계 중 Finding 후보로 먼저
  드러난다.
- **Human Approval** 경계는 새 artifact를 만들지 않고 기존 메커니즘으로 흡수한다:
  Graph Analysis 결과로 갱신된 `overview.md`/`policies/`는 Decision(DEC) 없이는
  `definition.status: confirmed`가 될 수 없고(Constitution 1), export는 여전히
  Change 07 Validate Gate의 재검증을 통과해야 한다(Constitution 9).
- `docs/architecture.md`의 파이프라인 다이어그램, `docs/roadmap.md`의 Change 02
  항목, `product-workspace`의 `sources/` 설명(Canvas 전용 문구)을 개정해야 한다 —
  실행은 이 proposal이 확정된 뒤 별도 change에서 한다(`tasks.md` 참고).
- 이 change는 설계 방향만 확정한다. Clarification/Graph Analysis를 구현하는 CLI
  명령, schema, instruction은 포함하지 않는다.

## Capabilities

### New Capabilities

- `prompt-clarification`: 자연어 프롬프트를 입력받아 6단계 방법론으로 명료화하고,
  원문과 추론을 분리해 Source/Discovery 산출물을 만드는 입력 단계. Canvas
  Ingest가 맡았던 "원본 보존" 역할을 대체한다.
- `node-graph-analysis`: 명료화된 atomic node 사이의 관계를 typed graph로
  표현하고, 그 graph의 schema·순환·참조 무결성을 결정적으로 검증하는 산출물과
  규칙.

### Modified Capabilities

없음. Change 01의 `cli-foundation`/`product-workspace` 스펙은 아직
`openspec/specs/`로 archive되지 않았다(`openspec list --specs`가 빈 목록을
반환함). 이 change는 그 상태를 바꾸지 않는다. `product-workspace`의 `sources/`
설명 문구 개정은 이 proposal이 확정된 뒤 별도 change에서 다룬다(Impact 참고).

## Impact

- `docs/roadmap.md`: Change 02 항목 폐기 표시, Change 03/04 범위를 Clarification/
  Atomic Node Modeling/Graph Analysis 기준으로 재정의.
- `docs/architecture.md`: 파이프라인 다이어그램과 "포함/제외" 범위 설명 개정.
- `docs/artifact-contracts.md`: Source 계약에서 Canvas 전용 필드 제거.
- `tests/fixtures/`: Change 02 전제였던 synthetic Canvas fixture 전략을 prompt
  기반 fixture로 교체해야 한다.
- 의존성 변경 없음 — Canvas 파서는 아직 구현되지 않았으므로 제거할 코드가 없다.
- 이후 Change 02(폐기) 자리를 대체할 `prompt-clarification` 구현 change와,
  `node-graph-analysis` 구현 change를 각각 새로 제안해야 한다.
