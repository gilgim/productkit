# discovery/

프롬프트를 정의·분해·구체화·관계검증·반례검증·해석확인 6단계로 명료화한 결과.
`CLR-xxx`.

- `productkit clarify` instruction을 따라 AI가 쓴다. 사용자의 명시적 해석
  확인(동의) 없이는 완료로 표시되지 않는다.
- 용어 정의는 `origin`으로 사용자가 직접 말한 것(`user_stated`)과 AI가 추론한
  것(`ai_inferred`)을 구분한다.
- 반례 검증에서 찾은 모호성·모순은 추측으로 메우지 않고 `finding_candidates`로
  남긴다.

필드 계약: ProductKit의 `docs/artifact-contracts.md` — Prompt & Clarification.
