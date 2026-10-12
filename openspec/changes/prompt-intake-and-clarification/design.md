# Design

## Context

`product/` workspace 구조(`sources/`, `discovery/` 등 9개 디렉터리)와 `config.yaml`
schema는 Change 01에서 이미 구현·테스트됐다(`src/workspace/plan.ts`,
`src/schema/config.ts`). 이 change는 그 구조를 바꾸지 않고 비어 있던
`sources/`·`discovery/`를 처음으로 채운다. 동기는 proposal.md - Why를 참고한다.

이 change가 지켜야 할 제약:

- CLI는 LLM을 호출하지 않는다(architecture.md 3장).
- 사용자 확인 없이 완료 상태로 전이할 수 없다(Constitution 1, 7).
- 모호한 내용을 추측으로 채우지 않는다(Constitution 2).
- Change 01의 기존 코드·테스트·종료 코드 규약을 바꾸지 않는다.

## Goals / Non-Goals

**Goals:**

- Prompt 원문을 안전하게 보존하는 CLI 명령
- 6단계 Clarification의 데이터 계약과 완료 판정 규칙
- AI(Skill)와 CLI의 책임 경계를 코드 수준에서 강제
- 중단 후 재개, 재실행, 쓰기 실패를 구조적으로 다루는 schema
- Claude Code 네이티브 기능 유무와 무관하게 동작하는 진입 경로(D6)
- 해석 확인 기록의 내용-발언-무결성을 하나로 묶고, CLI 검증의 한계를
  명시(D7)
- 기존 `config.yaml` stage 키와의 호환 규칙 및 정식 마이그레이션 시점(D8)

**Non-Goals:**

- Node 원자성 판정(Change 03)
- Graph edge 생성·의미 검증(Change 04)
- Finding의 정식 승격, 심각도 판정(Change 05)
- 정책 확정, 충돌 분석(Change 07)
- `config.yaml` schema 변경(기존 `stages` 필드를 재사용한다, 아래 D3)

## Decisions

### D1. CLI 명령은 `intake`와 `clarify` 두 개로 분리한다

대안은 프롬프트 입력과 명료화를 한 명령으로 묶는 것이다. 기각 사유: Phase 1(원문
보존)은 순수 CLI 결정적 작업이고 Phase 2(명료화)는 AI가 수행하는 대화형
작업이다. architecture.md 3장이 `ingest`/`discover`처럼 각 단계마다 얇은 CLI
진입점을 두는 패턴을 이미 쓰고 있으므로 그대로 따른다. 분리하면 `intake`만
단위 테스트하기도 쉽다.

### D2. Clarification 산출물은 새 디렉터리를 만들지 않는다

Prompt는 `product/sources/`, Clarification 결과는 `product/discovery/`에
쓴다 — 둘 다 Change 01이 이미 만들어 둔 디렉터리다. 대안(새 `product/prompts/`,
`product/clarifications/` 디렉터리 신설)은 Node 개념이 아직 확정되지 않은
시점에 workspace 구조를 먼저 키우는 것이라 기각한다. Change 03이 Node로
전환할 때 이 결정을 다시 검토한다.

### D3. `config.yaml`의 `stages` 필드를 재사용하고 schema는 바꾸지 않는다

대안은 `stages`에 `intake`/`clarify` 키를 새로 추가하거나 `schema_version`을
올리는 것이다. 지금 바꾸면 9단계 중 1단계만 구현된 시점에 스키마 마이그레이션
비용을 치르게 된다. 기존 키 `ingest`=Prompt intake 완료, `discover`=Clarification
완료로 의미만 다시 정의하고 코드는 건드리지 않는다. 더 많은 Phase가 구현되면
그때 한 번에 schema_version을 올린다(Constitution 10, 범용 migration 엔진을
만들지 않는다는 원칙과 동일 선상).

### D4. 완료 판정은 CLI가 매번 다시 계산하며, 저장된 status를 신뢰하지 않는다

AI가 "명료화를 마쳤다"고 보고하거나 파일에 `status: confirmed`라고 적어도, CLI는
그 값을 그대로 믿지 않는다. `clarify`가 실행될 때마다 ① 최신
`interpretation_check` 항목이 `agreed`인지 ② `user_statement`가 비어있지
않은지 ③ 그 항목의 `presented_hash`가 **현재** `steps`를 다시 정규화해 계산한
해시와 일치하는지 ④ 모든 항목의 `entry_hash`가 자기 내용과 일치하는지를 매번
다시 계산해 판정한다. `product/config.yaml`의 `stages`/`definition.status`가
"진행 메모이지 검증 결과가 아니다"(Constitution 9)라는 원칙을 Clarification의
`status` 필드에도 그대로 적용한 것이다. 이게 AI/CLI 책임 분리(요청 6), 해석확인
게이트(요청 7), 그리고 이번 승인의 1·4번 조건(해시 재검증, 수정 시 확인
무효화)을 하나의 메커니즘으로 구현한다.

### D5. 재실행·중단재개는 상태 필드로만 구분한다

`status: in_progress | awaiting_confirmation | confirmed` 세 값과 이미 기록된
`steps`의 존재 여부만으로 "처음부터"와 "이어서"를 구분한다. 별도의 체크포인트
파일이나 잠금 메커니즘은 만들지 않는다(로컬 단일 사용자 CLI, Change 01의 TOCTOU
수용 원칙과 동일선상).

### D6. 진입은 Agent의 명시적 CLI 호출이며, Claude Code 네이티브 Skill 자동선택에 기대지 않는다

처음 검토했을 때는 Claude Code의 `.claude/skills/`에 `productkit init`이 skill
파일을 복사해 자동 트리거를 만드는 방안을 고려했다. 기각한다 — 그러려면 `init`이
`product/` 밖에 쓰게 되는데, 이는 Change 01이 이미 구현·테스트한 "대상 앱의
`product/` 밖은 건드리지 않는다" 원칙(`tests/init.test.ts` "leaves CLAUDE.md,
AGENTS.md and openspec/ alone")과 충돌한다. 대신 architecture.md 3장이 이미
쓰고 있던 패턴을 그대로 쓴다: CLI는 instruction 파일 경로를 안내하고, Agent는
그 경로를 읽어 따른다 — 이건 Claude Code의 네이티브 Skill 기능이 전혀 없어도
동작한다(Codex도 포함). Claude Code의 자동 트리거를 쓰고 싶은 사용자는
`.claude/skills/clarify/SKILL.md`를 설치된 `skills/clarify/SKILL.md`로 직접
연결하면 되고, 이는 CLI 도움말에 **안내만** 하고 쓰기는 하지 않는다.

### D7. interpretation_check는 해시로 묶인 불변 이력 목록이고, presented_hash는 "제시문 자기해시"가 아니라 "그 시점 산출물 해시"다

대안은 지난 제안처럼 `agreed` 플래그 하나만 보는 것이다. 기각 사유: 그 필드는
AI 자신이 파일에 쓰는 값이라서, 사용자에게 실제로 뭘 보여줬는지·실제로 뭐라고
답했는지와 분리된 채로 "agreed"라고만 적으면 CLI가 걸러낼 방법이 없었다.

처음엔 `presented_hash`를 `presented_statement`(재구성 문장 텍스트) 자신의
해시로 뒀다. 이것도 기각한다 — 그러면 "제시문과 그 해시가 서로 일치하는가"만
확인할 뿐, **그 사이에 `steps`(definition~counterexample)가 바뀌었는지는
전혀 못 잡는다.** 사용자가 어떤 요약에 동의한 뒤 AI가 나중에 `decomposition`
내용만 조용히 고쳐도, 제시문-자기해시 방식은 여전히 "일치"로 보인다. 그래서
`presented_hash`를 **그 interpretation_check 항목이 생성된 시점의 `steps`
전체를 정규화(JSON, 키 정렬)해 해시한 값**으로 재정의했다. 이러면 승인 1번
조건(현재 산출물과의 해시 비교)과 4번 조건(확정 후 수정 시 무효화)이 같은
필드 하나로 해결된다 — 확정 후 `steps`가 바뀌면 "현재 해시"가 달라져 D4의
재계산에서 자동으로 불일치가 나온다.

`entry_hash`는 역할이 다르다 — 그 항목 자체(`presented_statement`+
`presented_hash`+`user_response`+`user_statement`+`checked_at`)가 저장된
뒤에 변조됐는지만 본다. `presented_hash`는 "산출물이 바뀌었는가"(의도된
재작업 포함), `entry_hash`는 "기록 자체가 몰래 바뀌었는가"(변조)를 본다 —
목적이 다른 두 해시다.

과거 항목은 추가만 되고 수정은 금지한다. 이건 **tamper-evident**(바뀌면
들킨다)이지 **tamper-proof**(못 바꾸게 막는다)가 아니다 — 로컬 파일을
물리적으로 못 고치게 막을 방법은 없다. `entry_hash`는 **탐지** 용도로만
쓰고, 사용자의 실제 동의나 변조 방지를 **보장**한다고 표현하지 않는다(승인
조건 2, spec.md 마지막 요구사항).

### D8. config.yaml stage 키 매핑을 전부 표로 고정하고, 마이그레이션 시점을 Change 04로 못 박는다

기존 9개 키(`ingest`/`discover`/`challenge`/`propose`/`decide`/`define`/
`review`/`validate`/`export`)와 새 9-Phase를 전부 대응시켜 보면 완전히
맞아떨어지지 않는다 — Atomic Node Modeling(Phase 3)과 Graph & Impact
Analysis(Phase 4)에 대응하는 기존 키가 없고, `review`는 새 Validation &
Approval Gate(Phase 8)에 흡수되어 남는 키가 된다. 이 gap을 숨기지 않고 표로
남긴다.

| 기존 stage 키 | 새 Phase | 상태 |
|---|---|---|
| `ingest` | Phase 1 Prompt Input | 재사용(이번 change) |
| `discover` | Phase 2 Clarification | 재사용(이번 change) |
| *(없음)* | Phase 3 Atomic Node Modeling | **schema gap** — Change 04에서 새 키 추가 |
| *(없음)* | Phase 4 Graph & Impact Analysis | **schema gap** — Change 04에서 새 키 추가 |
| `challenge` | Phase 5 Challenge | 그대로 재사용 예정(Change 05) |
| `propose` | Phase 6 전반부(Proposal) | 그대로 재사용 예정(Change 06) |
| `decide` | Phase 6 후반부(Decision) | 그대로 재사용 예정(Change 06) |
| `define` | Phase 7 Product Definition & Policy | 그대로 재사용 예정(Change 07) |
| `review` | — | **흡수됨** — Phase 8이 review+validate를 합치므로 deprecated |
| `validate` | Phase 8 Validation & Approval Gate | 그대로 재사용 예정(Change 08) |
| `export` | Phase 9 OpenSpec Bridge | 그대로 재사용 예정(Change 09) |

**정식 마이그레이션 시점**: Change 04(Graph & Impact Analysis) 구현 시점에
`schema_version`을 `1`로 올리고, `stages`에 `atomic_modeling`·`graph_analysis`
두 키를 추가하며 `review` 키를 deprecated 처리(값은 유지하되 더는 읽거나 쓰지
않음)한다. 그 전까지(Change 02, 03)는 기존 키 재사용만으로 충분하므로 schema를
건드리지 않는다. 이 change(Change 02)는 `ingest`/`discover` 외 어떤 키도
읽거나 쓰지 않는다(spec.md 참고).

### D9. CONSTITUTION.md의 Canvas 문구는 수정안만 제시하고 이번엔 적용하지 않는다

4번 원칙이 아직 "Canvas 원본부터 최종 정의까지..."로 돼 있다. 수정안:

> **기존**: "## 4. Canvas 원본부터 최종 정의까지 근거를 추적할 수 있어야 한다
>
> 모든 Definition 항목은 Decision을 거쳐 Source까지 참조가 이어져야 한다. ..."
>
> **제안**: "## 4. 원본 프롬프트부터 최종 정의까지 근거를 추적할 수 있어야 한다
>
> 모든 Definition 항목은 Decision을 거쳐 Prompt까지 참조가 이어져야 한다. ..."

이번 승인 범위(Change 02 명세 보완)는 `openspec/changes/
prompt-intake-and-clarification/`의 proposal/design/specs/tasks까지로
한정됐으므로 `CONSTITUTION.md` 자체는 건드리지 않는다. 적용 여부는 별도 승인
필요.

### D10. 쓰기는 같은 디렉터리의 임시 파일 + rename으로 처리한다

Change 01의 `scaffoldWorkspace`는 신규 파일에 `wx` 플래그(존재하면 실패)만
쓴다 — Prompt는 매번 새 파일이라 이 패턴을 그대로 재사용할 수 있다.
Clarification artifact는 다르다 — 같은 파일을 여러 라운드에 걸쳐 갱신한다.
갱신 중 프로세스가 죽으면 절반만 쓰인 파일이 최종 경로에 남을 위험이 있다.
그래서 모든 쓰기(신규·갱신 공통)에 `atomicWriteFile` 유틸을 쓴다: 같은
디렉터리에 임시 파일을 쓰고, 성공하면 `rename()`으로 최종 경로에 교체한다.
`rename`은 같은 파일시스템 안에서 원자적이다(POSIX). 신규 파일은 교체 직전에
대상 경로 존재 여부를 확인해 `wx`와 같은 효과를 낸다 — 확인과 rename 사이의
TOCTOU는 Change 01 때와 같은 이유로 수용한다(로컬 단일 사용자 CLI).

### D11. `clarify`가 미완료·무결성위반을 보고하는 건 오류가 아니라 정상 종료다

CLI 종료 코드는 architecture.md 9장에 고정돼 있다: `0` 정상/Gate통과, `1`
검증실패/Gate차단(Change 08부터), `2` 잘못된 명령·입력·IO 오류. "아직 해석
확인이 안 됐다"나 "해시가 안 맞아 재확인이 필요하다"는 Change 02 수준에서는
**사용법 오류도 아니고 Change 08의 Gate 차단도 아니다** — 진행 상태를
알려주는 정상적인 보고다. 그래서 `clarify`는 이 경우들을 종료 코드 `0`으로
보고한다(`init --dry-run`이 "아직 안 됨"을 0으로 보고하는 것과 같은 선례).
`product/` 없음·Prompt 없음처럼 **명령을 쓸 수 있는 상태 자체가 아닌 경우만**
`2`로 처리한다(spec.md "진입 경로" 요구사항).

- [`config.yaml` 재사용(D3)이 나중에 Phase 이름을 정식으로 바꿀 때 한 번에 더 큰
  마이그레이션이 필요해짐] → Change 09 이전, 파이프라인 절반 이상이 구현된
  시점에 한 번만 schema_version을 올리기로 지금 결정해 둔다.
- [`finding_candidates`를 이 change가 보관만 하고 승격하지 않으므로, Change 05가
  구현되기 전까지는 모호성이 쌓이기만 하고 해소되지 않음] → v0에서는 수용한다.
  사람이 `product/discovery/`를 직접 열어 보는 것으로 임시 완화된다.
- [해석확인 재구성 문장을 사람이 꼼꼼히 안 읽고 형식적으로 동의할 위험] → 이미
  알려진 잔여 위험(이전 설계 검토에서부터 반복 확인됨). 이 change의 범위에서
  해결할 수 없다 — UI/UX 설계가 아니라 데이터 계약 설계이기 때문이다.
- [D7의 해시 묶음은 tamper-evident일 뿐 tamper-proof가 아니다 — 파일을 직접
  고치는 걸 막을 수는 없다] → entry_hash 재계산 검증(spec.md)으로 "들키지
  않고 고치는 것"은 막되, "고치는 행위 자체"는 막지 않는다. 이 한계를 숨기지
  않고 명시한다(D7, CLI 출력 문구).
- [config.yaml stage gap(D8)을 Change 04까지 방치하면, Change 03(Atomic Node
  Modeling) 구현 중에 진행 상태를 기록할 곳이 없어 임시방편이 필요할 수
  있음] → Change 03 design.md에서 다시 검토한다. 이 change(02)의 구현을
  막지는 않는다.

## Open Questions

없음. 이전 설계 검토에서 남아 있던 두 미해결 항목(narrow 조건 형식의 현실
커버리지, Challenge 완료 판정 기준)은 각각 Change 07, Change 05 범위이며 이
change의 구현을 막지 않는다.

## Integration Testing Notes (Stage F 이후 발견)

실제 npm 패키지를 빌드·설치해 저장소 밖 소비자 앱에서 Skill instruction을
그대로 따라가며 통합 테스트를 했다. 두 가지를 발견해 이 change 범위에서
고쳤다.

- **`require('yaml')`을 Agent 스크립트에 직접 쓰게 한 건 불필요한 의존이었다.**
  SKILL.md의 해시 계산 예시가 소비자 앱 쪽에서 `yaml` 패키지를 직접
  불러오게 돼 있었는데, 이건 소비자 앱의 node_modules 레이아웃(호이스팅
  여부)에 기대는 불필요한 가정이다. `stepsContentHashFromYaml(yamlText)`를
  `productkit` 패키지 자체에서 내보내 YAML 파싱을 내부로 감췄다 —
  Agent는 `productkit`만 설치돼 있으면 되고, 그 안에서 `yaml`을 쓰는 건
  productkit 자신의 node_modules 해석이라 항상 안정적이다. (이 분리 자체는
  실제로 검증했으나, "호이스팅 안 된 환경에서 기존 방식이 깨진다"는 가설은
  정상 설치를 깨뜨리지 않고는 재현하지 못했다 — API를 더 안전한 쪽으로
  바꾼 것이지, 실제 크래시를 재현해 고친 것은 아니다.)
- **YAML에 겹따옴표로 특정 표현을 그대로 인용하면 파싱이 깨진다.** 실제로
  Clarification 초안을 작성하다 겪은 오류다. SKILL.md에 "따옴표로 특정
  표현을 인용하지 않는다"는 주의사항을 추가했다.
