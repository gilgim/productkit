# Tasks

## 1. 로드맵 문서 개정

- [ ] 1.1 `docs/roadmap.md`의 Change 02 "Canvas Ingest" 항목을 "폐기됨 — 이
      change(`redesign-prompt-first-architecture`)로 대체"로 표시하고 사유를
      한 줄로 남긴다. `git diff docs/roadmap.md`로 Change 02 행에 폐기 사유가
      보이는지 확인한다.
- [ ] 1.2 Change 03(Discovery) 항목을 "Clarification(6단계) + Discovery/Finding
      원자성 제약"으로 재정의하고, 완료 조건 문구를
      `specs/prompt-clarification/spec.md`의 요구사항과 일치시킨다. `git diff`로
      수정 전후 완료 조건 문구가 spec 요구사항과 어긋나지 않는지 대조해 확인한다.
- [ ] 1.3 Change 04(Challenge) 항목에 "Graph Analysis의 구조적 검증(schema·순환·
      고아 참조)" 범위를 추가하고, `specs/node-graph-analysis/spec.md`의 요구사항과
      문구를 맞춘다. 같은 방식으로 `git diff`로 확인한다.

## 2. 아키텍처·계약 문서 개정

- [ ] 2.1 `docs/architecture.md`의 파이프라인 다이어그램을 `Prompt Input →
      Clarification → Atomic Node Modeling → Graph Analysis → Product
      Definition → Human Approval → OpenSpec → Development`로 교체한다.
      `docs/architecture.md`를 다시 읽어 Canvas 단어가 다이어그램에 남아 있지
      않은지 확인한다.
- [ ] 2.2 `docs/architecture.md`의 "포함/제외" 범위 설명에서 "JSON Canvas 1.0
      파싱"을 제외 항목으로, "자연어 프롬프트 Clarification"을 포함 항목으로
      옮긴다. 수정 후 포함/제외 목록에 모순(같은 항목이 양쪽에 있음)이 없는지
      확인한다.
- [ ] 2.3 `docs/artifact-contracts.md`의 Source 계약에서 `canvas_node_id`,
      `canvas_edge_id`, 좌표 기반 `derived` 필드를 제거하고 `raw_text`,
      `origin_hash` 등 원문 보존 필드는 유지한다. `grep -n "canvas" docs/
      artifact-contracts.md`를 실행해 Canvas 전용 필드가 더는 나오지 않는지
      확인한다.
- [ ] 2.4 `docs/artifact-contracts.md`의 Discovery(DSC) 계약 설명에 원자성 제약
      한 줄(복합 문장을 하나의 statement에 담지 않는다)을 추가한다.
      `specs/node-graph-analysis/spec.md`의 "Node는 원자적 단위만 담는다"
      요구사항과 문구가 모순되지 않는지 대조해 확인한다.

## 3. 후속 Change 준비

- [ ] 3.1 `prompt-clarification` capability를 구현하는 새 OpenSpec change를
      제안할 수 있도록, 1~2단계에서 개정한 문서를 근거로 그 change의 범위
      초안(한 단락)을 이 change의 `design.md` Migration Plan에서 가리키는 대로
      작성해 사용자에게 제시한다. 사용자가 그 범위에 동의하는지 확인한다.
- [ ] 3.2 `node-graph-analysis` capability를 구현하는 새 OpenSpec change의 범위
      초안(한 단락)을 같은 방식으로 작성해 사용자에게 제시하고 동의를 확인한다.
- [ ] 3.3 design.md의 Open Questions(Clarification 명령 경계, Node ID 접두사)를
      3.1·3.2에서 제시한 후속 change 제안 중 어느 쪽에서 다룰지 명시한다. 각
      후속 change 초안에 해당 질문이 빠짐없이 들어있는지 확인한다.

## 4. 검증

- [ ] 4.1 `npx openspec validate redesign-prompt-first-architecture --strict`를
      실행해 proposal/specs/design/tasks가 schema 오류 없이 통과하는지 확인한다.
- [ ] 4.2 `npx openspec status --change redesign-prompt-first-architecture`를
      실행해 모든 artifact가 `done`으로 표시되는지 확인한다.
