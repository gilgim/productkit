# journeys/

확정된 결정에 근거한 사용자 여정. `JRN-xxx`.

최소 구조: id, actor, goal, entry_state, states, transitions, terminal_states,
decision_refs, acceptance_criteria.

검증이 확인하는 것:

- 진입 상태와 종료 상태가 있는가
- 존재하지 않는 상태로 향하는 transition이 없는가
- 도달 가능한 모든 상태에서 종료 상태로 가는 경로가 있는가
- 핵심 Journey에 Acceptance Criteria가 있는가

상태 그래프 검사는 종료 가능성을 확인할 뿐, 현실의 UX가 타당하다는 것을 증명하지
않는다.

필드 계약: ProductKit의 `docs/artifact-contracts.md` — Definition.
