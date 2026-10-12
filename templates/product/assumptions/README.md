# assumptions/

검증이 필요한 가정과 그 상태. `ASM-xxx`.

Finding의 `assumption`은 의심되는 가정을 발견한 기록이고, 여기 있는 Assumption은 이후
검증 상태를 관리한다.

- `risk`: critical | noncritical
- `status`: unverified | verified | disproven | accepted_risk

미검증 가정을 사용자가 받아들였다고 해서 `verified`로 바꾸지 않는다. 그 경우는
`accepted_risk`이며 결정 참조가 필요하다. critical 가정이 미검증이거나 반증되면 Gate가
막는다.

필드 계약: ProductKit의 `docs/artifact-contracts.md` — Assumption.
