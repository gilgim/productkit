# Proposal

## Why

Change 03은 Clarification별 Node 집합만 처리하므로 요구사항 변경이 다른 집합에 미치는 영향을 추적할 수 없다. 관계의 사용자 확인과 방향별 탐색을 명시해야 AI 가설을 확정 사실로 오인하지 않고 후속 정책 검토 후보를 만들 수 있다.

## What Changes

- Content Graph는 Node만 연결한다. v0 Edge는 `depends_on`, `precedes`, `conflicts_with`, `duplicates`, `supersedes`, `exception_of` 6종만 허용한다. `contains`, `causes` 등 지원하지 않는 관계 가설은 별도 파일 기반 RelationCandidate로 보존하며 Edge로 변환하지 않는다.
- 관계는 proposed/confirmed/rejected 및 독립적인 freshness를 갖는다. 승인 대상·실제 발언·근거·현재 주장과 양 끝 출처 해시를 append-only 확인 이력에 결합한다. AI 추천·원문 등장·Challenge 무이의로 확정할 수 없다.
- `productkit graph`, `graph validate`, `graph impact --node <id>`, `graph trace --node <id>`를 추가한다. CLI는 구조 검사와 영향 후보 탐색만 수행한다.
- 타입별 방향·전파/검토 구분, 확정/잠재 경로, 직접/간접 영향, 전체 입력 fingerprint를 제공한다. stale 관계는 잠재 영향과 경고에 남긴다.
- RelationCandidate는 자체 ID·원본 관계명·양 Node·제안 의미·근거·검토 상태·시각·endpoint snapshot을 보유한다. ImpactReport는 후보 ID와 분석 제외 이유만 참조하며 후보를 영향 경로에 포함하지 않는다.
- 기존 provenance 필드를 재사용한다. 후속 Finding/Proposal/Decision/Policy/OpenSpec은 계약과 합성 추적성 테스트로 연결하며 아직 없는 단계의 소스 구현을 앞당기지 않는다.
- **BREAKING (새 config 형식만)**: workspace schema_version 0→1. 기존 키를 유지하고 atomic_modeling/graph_analysis만 추가한다. 명시적 `productkit migrate`로 실행하며 기존 init/intake/clarify/model의 v0 지원을 유지한다. 자동 마이그레이션은 하지 않는다.

## Capabilities

### New Capabilities

- `graph-and-impact-analysis`: Typed Content Graph, 사용자 관계 확인, 결정적 구조 검사, 관계별 영향 후보, provenance 조회와 분석 최신성.

### Modified Capabilities

- `product-workspace`: graph 디렉터리, v0/v1 호환 및 안전한 명시적 stage schema migration.

메인 specs는 현재 비어 있다. `product-workspace`는 Change 01의 ADDED와 Change 03의 MODIFIED 이후에 존재하게 되는 capability다. 이름을 유지하고 01→02→03→04 순서의 archive 전제만 기록한다. 이번에는 archive/sync를 실행하지 않는다.

## Impact

새 외부 의존성이나 LLM 호출은 없다. 수정 예정 파일·데이터 계약·마이그레이션·테스트는 design.md와 tasks.md에 명시한다. 기존 Prompt/Clarification/Node 데이터는 변환하지 않는다.

기존 Change 04 초안의 무방향 BFS, Policy Node와 Policy artifact 동일시, 자동 config 갱신은 이번 설계에서 교체한다. `docs/architecture.md`, `docs/artifact-contracts.md`, `docs/roadmap.md`, README는 구현 계약에 맞춰 정합화했다. 이전 8종 관계 설명은 6종 Edge와 별도 RelationCandidate 계약으로 바뀌었다.

Change 01~03의 Critical Gate 보정은 별도 change에서 구현·검증되었다. 사용자는 이번 승인으로 6종 Edge, 미지원 후보 보존, 명시적 v0→v1 migration을 승인했다. 실제 Claude Agent 의미 평가는 인증 상태에 따라 UNKNOWN일 수 있으며, 이를 구조 검증 PASS로 대체하지 않는다. 제품의 실제 관계 승인은 실제 사용자 응답 없이는 생성하지 않는다.
