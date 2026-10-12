# sources/

사용자가 입력한 프롬프트 원문을 보존하는 곳이다. `PRM-xxx`.

- `productkit intake`가 만든다. 원문은 한 번 저장되면 수정하지 않는다
  (append-only) — 프롬프트를 고치면 새 `PRM-xxx`가 생기고 이전 것은 남는다.
- 원문, 내용 hash, 문자 span(`SPN-xxx`)을 함께 기록한다.
- 원문 인용은 원문 그대로 보존한다. AI 요약을 원문으로 표시하지 않는다.

필드 계약: ProductKit의 `docs/artifact-contracts.md` — Prompt & Clarification.
