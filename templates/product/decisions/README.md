# decisions/

사용자가 명시적으로 내린 결정. `DEC-xxx`.

사용자의 명시적인 선택이나 확정 발언이 있을 때만 파일을 만든다. AI 추천은 결정이
아니다.

- `rationale`이 없으면 기록하지 않고 이유를 묻는다.
- `confirmation.statement`에는 실제 사용자 발언을 보존한다.
- 이 기록은 대화 기록이며 신원 인증 증거가 아니다.
- 결정을 바꿀 때 기존 기록을 지우지 않는다. 새 결정이 `supersedes`로 대체하고 이전
  결정은 `superseded`가 된다.
- 기존 대안에 없는 선택도 기록할 수 있다.

필드 계약: ProductKit의 `docs/artifact-contracts.md` — Decision.
