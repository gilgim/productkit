# policies/

제품 행동 규칙. Business Rule, UX Policy, AI Policy(AI 기능이 있는 경우),
Error Policy, Edge Case.

- 각 정책은 근거가 되는 Decision을 참조한다.
- 구현 방식이 아니라 관찰 가능한 제품 행동을 쓴다. 데이터베이스·API·컴포넌트 설계는
  여기에 쓰지 않는다.
- 구조화 과정에서 새로운 제품 행동이 필요해지면 몰래 추가하지 않고 Finding으로
  되돌린다.

필드 계약: ProductKit의 `docs/artifact-contracts.md` — Definition.
