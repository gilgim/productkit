# Proposal

## Why

Change 02는 프롬프트를 6단계로 명료화하고 사용자 확인까지 받지만, 그 결과
(`steps.decomposition` 등)는 자유 문장일 뿐 독립적으로 판정·추적할 수 있는
단위가 아니다. 하나의 decomposition 항목이 여러 조건·행동을 한꺼번에 담고
있을 수도 있고, Change 04(Graph)·05(Challenge)·07(Policy)가 각자 다른 단위로
그 문장을 또 쪼개 쓰면 같은 내용이 여러 곳에서 다르게 해석된다. 이 change는
확정된 Clarification을 **원자적 단위(Node)** 로 변환해, 이후 모든 Change가
같은 단위를 공유하게 만든다.

## What Changes

- Node schema(Zod) 추가: `kind`(`fact`/`inference`/`requirement`/`policy`),
  `statement`, `origin`, `derived_from`, 원자성 판단 결과, `content_hash`.
- `product/nodes/` 디렉터리 신설(**BREAKING**: `product-workspace` capability가
  만드는 디렉터리 집합이 9개에서 10개로 늘어난다 — 아래 Modified Capabilities
  참고).
- 원자성 판단은 **단일 검증 대상 · 분해 가능성 · 의미 보존** 세 기준을 함께
  평가한다(독립적 변경 가능성 하나만으로 확정하지 않는다). ① 단일 검증
  대상 — 이 문장이 독립적으로 관찰 가능한 결과를 하나만 담는가(아니면 분해
  대상). ② 분해 가능성 — 쪼갠 조각이 서로의 전제조건이 아니라 각자 의미
  있게 성립하는가(고아 조각 발생 시 분해하지 않는다). ③ 의미 보존 — 분해든
  유지든 공유 조건·트리거를 포함해 원래 의미를 그대로 전달하는가. 복합
  조건이 하나의 정책을 구성하는 경우(예: "3회 실패 AND 1시간 이내")와
  독립적인 여러 행동이 포함된 경우(예: "확정하고, 이메일을 보내고, 차감한다")
  를 반례로 구분한다. 구조 신호(접속사·복수 서술어 개수)는 CLI가 결정적으로
  세어 "분해 검토 후보"만 표시하고, 세 기준의 실제 판정은 AI 판단 +
  신뢰수준으로 기록한다 — CLI는 "원자성을 검증했다"고 표시하지 않는다.
- 분해 누락·추가·조건 변경·논리 연산자 변경·왜곡 검증: ① span/decomposition
  커버리지(구조적, CLI) — 한 Clarification의 모든 decomposition 항목이 하나
  이상의 Node로 덮였는지 확인. ② 어휘 중복 신호(구조적 후보, CLI) — 추가
  의심. ③ 조건·논리연산자 변경 비교(의미적, AI). ④ 역-합성 비교(의미적, AI)
  — 한 decomposition 항목에서 나온 Node들을 다시 논리적으로 합성한 문장을
  원래 항목과 비교해 보존/왜곡/불확실 중 하나로 기록(신뢰수준 포함, "증명"
  으로 표시하지 않음).
- **Clarification의 확정은 Node 모델링 결과 전체에 대한 사용자 승인으로
  간주하지 않는다.** Node별 재확인은 기본적으로 생략하되, 위 추가·조건
  변경·논리연산자 변경·왜곡 중 하나라도 감지되면 그 Node는 `type` 있는
  Finding 후보(`status: open|resolved|deferred|dismissed`)로 기록되고, 해당
  Node를 포함한 Node 집합 전체는 그 Finding 후보가 열려 있는 동안
  `modeled`로 확정되지 않는다. 이 네 가지 밖의 일반 모호성은 확정을 막지
  않는다.
- `derived_from`으로 Node→Clarification→Prompt까지 체인을 잇는다(새 필드 저장
  없이 Clarification/Prompt 쪽 기존 필드를 역으로 조회하는 방식은 쓰지 않고,
  Node가 Clarification을 가리키는 한 방향만 저장한다).
- Node 집합은 그 소스가 된 Clarification `steps.decomposition`의 정규화
  해시(`source_content_hash`)에 묶인다. Clarification이 이후 수정되면(재해석
  확인으로 `steps`가 바뀌면) Node 집합은 자동으로 stale이 되어 재모델링이
  필요하다 — Change 02의 "확정 후 수정 시 무효화" 패턴을 그대로 재사용한다.
- CLI는 Node 내용을 생성하지 않는다. `productkit model`(가칭) 명령은 입력
  확인·instruction 안내·완료(커버리지+해시 일치) 여부 판정만 한다.
- `skills/model/SKILL.md` 공통 instruction 추가.

명시적으로 포함하지 않는 것: Graph 관계 생성과 의미 검증(Change 04), 정책
충돌·우선순위(Change 07), Finding의 정식 승격(Change 05). Node의 `kind:
policy`는 schema에 자리만 만들고, 정책 구조화(CACEP 등)와 충돌 판정은 다루지
않는다.

## Capabilities

### New Capabilities

- `atomic-node-modeling`: 확정된 Clarification을 단일 검증 대상·분해
  가능성·의미 보존 기준의 원자적 Node로 변환하고, 누락·추가·조건 변경·논리
  연산자 변경·왜곡을 구조적/의미적으로 구분해 검증하며, 소스가 바뀌면
  자동으로 무효화되는 변환 단계.

### Modified Capabilities

- `product-workspace`(Change 01): `productkit init`이 만드는 디렉터리 집합에
  `product/nodes/`를 추가한다. 기존 9개 디렉터리와 기존 파일은 그대로 두고
  추가만 한다 — 재실행해도 기존 사용자 파일을 덮어쓰지 않는다는 원칙
  (Constitution 10)은 그대로 유지된다. **Archive 순서 제약**: 이 delta는
  Change 01의 `product-workspace`(ADDED)가 먼저 archive돼 있어야 적용
  가능하다(`npx openspec validate atomic-node-modeling --strict`의 INFO로
  확인됨, design.md D5).

## Impact

신규(이번 change에서는 작성하지 않음, 설계만 고정):

- `src/schema/node.ts`, `src/cli/commands/model.ts`, `skills/model/SKILL.md`,
  `src/clarification/`(또는 신규 `src/node-modeling/`) 안의 원자성 판정·
  커버리지·역-합성 비교·해시 함수들

**영향받는 기존 workspace 구조**(`product-workspace` MODIFIED, Change 01 소유):

- `src/workspace/plan.ts`: `ARTIFACT_DIRS`(현재 9개)에 `nodes` 추가 → 10개.
  `buildInitPlan()`이 만드는 항목 수가 디렉터리당 2개(디렉터리+README.md)씩
  늘어 22개 → 24개가 된다.
- `templates/product/nodes/README.md` 신규 필요(다른 artifact 디렉터리와
  동일한 안내 문서 패턴).

**영향받는 기존 테스트**(구현 시 숫자를 갱신해야 깨지지 않음):

| 파일 | 영향받는 부분 |
|---|---|
| `tests/init.test.ts` | `'22 created'`, `'20 created, 2 skipped'` 등 생성 개수 문자열 단언 전부. `ARTIFACT_DIRS`를 순회하는 테스트(`'creates every artifact directory'`)는 개수 변경에 자동으로 맞춰지지만, 하드코딩된 문자열 단언은 수동 갱신 필요 |
| `tests/templates.test.ts` | `buildInitPlan()`을 순회하므로 로직 자체는 영향 없음. `templates/product/nodes/README.md`가 실제로 있어야 `'has a template file on disk for every planned file'`가 통과함 |
| `tests/packaging.test.ts` | `templates.length).toBe(12)` → `nodes/README.md` 추가분만큼 갱신(12→13) 필요. `'initialises a workspace outside the repository'`의 `'22 created'` 단언도 갱신 필요 |
| `tests/cli.test.ts` | 직접 영향 없음(명령 목록 테스트는 `ingest`/`discover` 등 옛 이름만 확인하므로 `nodes` 추가와 무관) |

이 변경은 Change 01이 만든 기존 9개 디렉터리·파일의 내용·동작을 하나도
바꾸지 않고 10번째 디렉터리만 추가한다 — 재실행 시 기존 파일 보존
(Constitution 10)과 "생성·건너뜀·충돌 구분 보고" 동작은 그대로 유지된다.

`docs/artifact-contracts.md`에 Node 계약 추가, `docs/roadmap.md`의 Change 03
상태 갱신(이번엔 "명세 준비됨"까지만).
