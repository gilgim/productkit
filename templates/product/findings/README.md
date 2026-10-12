# findings/

검토에서 발견한 허점·가정·모순·엣지 케이스. `FND-xxx`.

- `type`: gap | assumption | contradiction | edge_case | ux_friction |
  unnecessary_complexity | missing_state | alternative
- `severity`: critical | major | minor
- `status`: open | resolved | deferred | dismissed

규칙:

- `resolved`에는 해결 근거가 필요하다.
- `deferred`, `dismissed`에는 사용자 결정 참조가 필요하다.
- Critical Finding은 단순 defer로 Gate를 통과할 수 없다.
- 같은 문제를 재발견하면 새 ID를 만들지 않고 기존 항목을 갱신한다.

필드 계약: ProductKit의 `docs/artifact-contracts.md` — Finding.
