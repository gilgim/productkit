# nodes/

확정된 Clarification을 단일 검증 대상·분해 가능성·의미 보존 기준으로 변환한
원자적 단위. `NDG-xxx`(Node 집합) 하나가 Clarification 하나에 대응하고, 그
안에 `NOD-xxx-N` Node들이 들어 있다.

- `productkit model` instruction을 따라 AI가 쓴다.
- 추가·조건 변경·논리 연산자 변경·왜곡 가능성이 감지되면 Finding 후보로
  남고, 해소 전까지 이 Node 집합은 `modeled` 상태가 되지 않는다.
- Clarification의 해석 확인은 Node 전체에 대한 승인이 아니다.
- 소스 Clarification이 바뀌면 이 Node 집합은 자동으로 무효화된다.

필드 계약: ProductKit의 `docs/artifact-contracts.md` — Node & NodeGroup.
