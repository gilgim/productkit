# Proposal

## Why

Change 02~04는 Prompt 명료화, Node 원자성, 관계 구조와 변경 영향 후보를 검증하지만, 그 결과를 의미적으로 비판 검토하고 근거 있는 Finding으로 보존하는 단계는 아직 없다. Challenge는 누락·모순·경계 공백과 의미 왜곡 가능성을 발견해 Change 06의 사용자 결정이 검토할 수 있는 형태로 제공한다.

## What Changes

- `requirement-challenge` capability를 추가해 범위가 명시된 Challenge review와 Finding 기록을 정의한다.
- 검토 대상은 Prompt/Clarification/Node/Graph/ImpactReport의 최신 상태이며, 구조 검증 결과를 의미 판단으로 오인하지 않도록 한다.
- Finding 후보, 실제 사용자 확인, 해결 상태, 사용자 결정 참조를 서로 구분하고 변경 이력을 보존한다.
- 검토 범위·검토 항목·미검토 범위·입력 hash를 기록한다. 검토 완료와 Finding 해결은 독립 상태다.
- `skills/challenge/SKILL.md`와 제한된 CLI 지원을 추가한다. AI는 대안이나 제품 결정을 확정하지 않으며, 해결 결정은 Change 06이 담당한다.

## Capabilities

### New Capabilities

- `requirement-challenge`: 근거와 출처를 가진 의미적 Finding, Challenge 실행 범위·커버리지·최신성, 사람 검토 상태.

### Modified Capabilities

- 없음. Change 02~04의 구조적 계약은 재구현하거나 변경하지 않는다.

## Impact

예상 구현은 `src/schema/`의 Finding/ChallengeReview schema, `src/clarification/`의 입력 fingerprint·상태 판정·안전 저장, `src/cli/commands/`의 challenge 명령, `skills/challenge/SKILL.md`, `product/findings/` 및 `product/reviews/` 파일, 테스트와 문서다. 기존 v1의 `challenge` Stage 키를 재사용하고 새 Stage나 migration은 추가하지 않는다. 저장 형식은 파일 기반이며 DB·LLM 호출·Change 06 결정 기능은 포함하지 않는다.
