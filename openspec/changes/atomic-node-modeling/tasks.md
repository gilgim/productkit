# Tasks

**Stage F 완료.** 아래 체크는 실제 구현·테스트 결과를 반영한다. 계획과
달라진 부분은 각 항목에 괄호로 남긴다.

## 1. Node 데이터 계약

- [x] 1.1 `src/schema/node.ts`에 Zod로 Node schema(`id`, `kind`, `statement`,
      `origin`, `derived_from`, `atomicity`)를 정의하고 유효/무효 입력 단위
      테스트를 추가했다(**변경**: 개별 Node의 `content_hash`는 만들지
      않았다 — 무효화는 NodeGroup의 `source_content_hash` 하나로 충분해
      중복 필드가 된다고 판단)
- [x] 1.2 `derived_from`이 비어 있으면 Zod가 거부하는지(필수 필드), 범위를
      벗어난 `decomposition_index`나 다른 Clarification을 가리키는 참조가
      `judgeNodeSetCompletion()`에서 `invalid_reference`로 걸리는지
      테스트했다
- [x] 1.3 `docs/artifact-contracts.md`에 Node·NodeGroup 계약을 추가하고
      schema와 대조했다

## 2. 원자성 판정(단일 검증 대상·분해 가능성·의미 보존)과 구조 신호

- [x] 2.1 접속사·복수 서술어 개수를 세는 `computeStructuralSignal()`(결정적)
      을 구현, 플래그만 내고 분해 여부는 확정하지 않는지 테스트했다
- [x] 2.2 세 필드 + `evaluateAtomicityFinal()`(세 sub-verdict의 고정 조합
      규칙 — AI 판단을 CLI가 대신 하지 않고 기계적으로 조합만 함)을
      구현했다
- [x] 2.3 [정상] 테스트 완료
- [x] 2.4 [반례 A] 독립 행동 3개 분해 + 공유 트리거 보존 테스트 완료
- [x] 2.5 [반례 B] 복합 조건 정책 유지 테스트 완료
- [x] 2.6 [경계] uncertain은 `final: null`로 남고 임의 확정되지 않음을
      테스트 완료
- [x] 2.7 [경계] meaning_preservation이 preserved가 아니면 다른 조건이
      맞아도 `final`이 확정되지 않음을 테스트 완료

## 3. 누락·추가·조건 변경·논리 연산자 변경·왜곡 검증과 위험 신호 게이트

- [x] 3.1 커버리지 검사(결정적) 구현·테스트 완료
- [x] 3.2 `computeLexicalOverlapRatio()` + `ADDITION_SUSPECT_THRESHOLD` 구현,
      경고로만 남는지(확정 오류 아님) 테스트 완료
- [x] 3.3 조건/연산자 변경 비교는 **AI가 채우는 필드**로 schema에만
      반영했다(**변경**: CLI가 "조건이 좁아졌다/AND가 OR로 바뀌었다"를
      자동으로 비교·판정하는 함수는 만들지 않았다 — 자연어 조건 비교는
      결정적 판정이 아니므로, 결과를 기록하는 Finding 후보 schema만
      제공하고 판정 자체는 AI 몫으로 남겼다. 테스트는 AI가 이미 내린
      판정을 `judgeNodeSetCompletion()`이 올바르게 게이트하는지만 확인)
- [x] 3.4 `distortion_checks` schema(NodeGroup 레벨) 구현, `preserved`로
      자동 승격 안 되는지(명시 필드 없으면 Zod가 거부) 테스트 완료
- [x] 3.5 Node 전용 Finding 후보 schema(`type`/`status`) 구현,
      `BLOCKING_FINDING_TYPES`(4종) 정의, open 상태면 게이트되는지 테스트
      완료
- [x] 3.6 [정상] 테스트 완료
- [x] 3.7 [반례] 테스트 완료
- [x] 3.8 [경계] 일반 모호성(Clarification 쪽에 남아있는 ambiguity 등)은
      NodeGroup.finding_candidates에 애초에 들어갈 수 없음(schema가 4종
      으로 한정)을 테스트로 확인 — 섞어 넣는 대신 "애초에 섞일 수 없는
      구조"임을 증명하는 방식으로 테스트했다

## 4. 소스 변경 시 무효화

- [x] 4.1 `nodeSetContentHash()` 구현(Change 02 `stepsContentHash()`와
      동일 알고리즘 재사용 확인 테스트 포함)
- [x] 4.2 `judgeNodeSetCompletion()` 구현 — 계획한 4조건에
      **`invalid_reference`를 다섯 번째 조건으로 추가**했다(계획에는 없었음
      — Node 참조 무결성 테스트 요구사항을 다루며 "범위 밖 참조가 커버리지
      계산에서 조용히 무시되는" 문제를 발견해 별도 사유로 분리)
- [x] 4.3 소스 변경 시 stale 판정 테스트 완료(저장된 `status: modeled`
      여도 무시하는 것까지 확인)

## 5. CLI와 `product-workspace` 확장

- [x] 5.1 `ARTIFACT_DIRS`에 `nodes` 추가, `templates/product/nodes/README.md`
      작성, `tests/init.test.ts`(4곳)·`tests/packaging.test.ts`(2곳) 숫자
      갱신 완료 — 디렉터리 10개, 생성 24개, 템플릿 13개. Change 01 기존
      9개 디렉터리 생성 동작 회귀 없음 확인
- [x] 5.2 `src/cli/commands/model.ts` 구현 — 코드에 statement 생성 로직
      없음을 테스트로 확인(`model.test.ts`의 소스 스캔 테스트)
- [x] 5.3 `skills/model/SKILL.md` 작성 완료

## 6. 중단 후 재개

- [x] 6.1 테스트 완료(부분 커버리지 상태에서 재실행 시 남은 decomposition
      인덱스만 보고)

## 7. 쓰기 안전성

- [x] 7.1 **범위 재확인**: `productkit model`은 `product/nodes/`에 아무것도
      쓰지 않는다(Clarification과 마찬가지로 NodeGroup도 AI가 직접 쓴다).
      그래서 CLI 자체의 "쓰기 실패" 시나리오는 없다 — 대신 ①
      `product/nodes/`가 읽기전용이어도 `model`은 정상 동작함을, ②
      Change 02의 `atomicWriteFile`이 NodeGroup 모양 데이터에도 그대로
      동작(쓰기 실패 시 기존 파일 보존)함을 테스트했다. config.yaml
      stage 갱신도 없다(design.md D8 — Change 03은 예약된 stage 키가
      없음, Change 04에서 schema_version과 함께 추가 예정)

## 8. 통합 검증

- [x] 8.1 `npm run build && npm test` — 136/136 통과(Change 01·02의 기존
      테스트 전부 포함, 숫자 갱신 반영)
- [x] 8.2 `npx openspec validate atomic-node-modeling --strict` 통과
- [x] 8.3 실제 설치된 패키지로 수동 E2E 확인 완료(아래 보고 참고)
- [x] 8.5 **(후속 턴 추가)** 실제 Claude Code Agent로 진짜 아이디어 2개를
      Clarification→Node Modeling까지 수행(해석 확인은 모의로 명시 표시).
      그 과정에서 `distortion_checks`가 확정을 막지 못하던 버그를 발견해
      `unresolved_distortion_check` 사유로 수정, 회귀 테스트 3개 추가
- [ ] 8.4 **보류** — 이번 턴은 "Change 01·02의 Archive는 아직 실행하지
      않는다"는 제약이 있어 `openspec archive`를 실제로 돌려보지 않았다.
      design.md D5의 순서(Change 01 → 03)는 그대로 유효하며, archive 승인
      시 이 항목부터 확인한다
