# Proposal

## Why

`redesign-prompt-first-architecture`가 입력을 Canvas에서 자연어 프롬프트로
바꾸는 방향을 정했지만 구현은 없다. Change 01 이후 `product/` workspace 구조만
있고, 사용자의 아이디어를 실제로 받아 명료화하는 첫 단계가 없어서 이후 모든
단계(Node, Graph, 정책, 검증)가 올라설 입력이 없다. 이 change는 그 입구만
만든다 — Prompt 저장과 6단계 Clarification까지이며, Node 원자성·Graph 의미
검증·정책 확정은 포함하지 않는다.

## What Changes

- `productkit intake <text>` / `productkit intake --file <path>` 추가. 프롬프트
  원문을 `product/sources/`에 수정 없이 보존하고, 고유 ID·content hash·문자 span을
  기록한다. 같은 세션에서 프롬프트를 고치면 새 ID를 만들고 이전 것을 지우지 않는다
  (append-only).
- `skills/clarify/SKILL.md` 공통 instruction 추가: 정의 → 분해 → 구체화 → 관계
  검증 → 반례 검증 → 해석 확인 6단계.
- `productkit clarify` 추가. 입력 존재를 확인하고 instruction과 입력 경로를
  안내하며, 완료 여부는 AI의 선언이 아니라 CLI가 schema 기준으로 판정한다
  (architecture.md 3장 "CLI가 하는 네 가지"를 그대로 따른다).
- Clarification artifact(Zod schema) 추가: `interpretation_check.user_response`가
  `agreed`가 아니면 `status`는 `confirmed`가 될 수 없다.
- 용어 정의에서 사용자가 직접 말한 것(`user_stated`)과 AI가 추측한 것
  (`ai_inferred`)을 분리한다.
- 반례 검증에서 찾은 모호성·모순은 추측으로 메우지 않고 `finding_candidates`로
  보관한다(정식 Finding 승격은 Change 05 범위).
- 관계 검증의 결과는 Graph edge가 아니라 메모(`relation_candidate`)로만 남긴다
  (정식 edge 생성은 Change 04 범위).
- `product/config.yaml`의 기존 `stages.ingest`/`stages.discover` 필드를 재사용해
  진행 상태를 기록한다(schema 변경 없음, 의미만 재정의). 이 change는 이 두 키
  외의 어떤 stage 키도 읽거나 쓰지 않는다.
- Agent 진입 경로를 CLI의 명시적 호출로 고정한다 — Claude Code의 네이티브
  Skill 자동선택 기능 유무와 무관하게 동작해야 한다. `productkit init`이
  `.claude/skills/`에 파일을 쓰는 일은 없다(Change 01의 "product/ 밖은
  건드리지 않는다" 원칙 유지); 자동 트리거를 원하면 사용자가 직접 연결하고,
  CLI는 그 방법을 안내만 한다.
- `interpretation_check`를 단일 값에서 **이력 목록**으로 바꾼다. 각 항목은
  제시된 재구성 문장의 해시(`presented_hash`), 실제 사용자 발언
  (`user_statement`, 필수), 항목 자체의 무결성 해시(`entry_hash`)를 가진다.
  과거 항목은 고쳐 쓸 수 없고 새 라운드는 항목을 추가한다. CLI는 기록의
  내부 무결성만 검증할 수 있고 발언의 진위는 검증할 수 없다는 한계를 문서와
  출력에 명시한다.
- `product/config.yaml`의 stage 키 전체(9개)와 새 9-Phase의 대응표를 design.md에
  고정하고, 스키마 gap(Phase 3·4에 대응 키 없음)이 있는 채로 Change 04에서
  `schema_version`을 올려 해소하기로 시점을 못 박는다.
- fixture: `tests/fixtures/`에 합성 프롬프트 시나리오 추가.

명시적으로 포함하지 않는 것: Node 원자성 판정(Change 03), Graph 관계 생성·의미
검증(Change 04), Finding의 정식 승격과 우선순위 판정(Change 05), 정책
확정(Change 07). 이 change는 Clarification 산출물을 만들 뿐 그 이후 단계가 그것을
어떻게 쓸지는 결정하지 않는다.

## Capabilities

### New Capabilities

- `prompt-clarification`: 자연어 프롬프트를 원문 그대로 보존하고, 6단계
  방법론으로 명료화하며, 사용자의 명시적 해석 확인 없이는 완료로 전이하지 않는
  입력 단계. 설계 방향은 `redesign-prompt-first-architecture`에서 먼저
  제시됐고, 이 change가 실제 구현 계약(Prompt/Clarification 데이터 모델, CLI
  명령, Skill instruction 경계)을 정의한다.

### Modified Capabilities

없음. Change 01의 `cli-foundation`/`product-workspace`는 구조 변경 없이 그대로
쓴다 — 새 명령(`intake`, `clarify`)만 추가하고 기존 명령·워크스페이스 구조는
건드리지 않는다.

## Impact

- 새 CLI 명령: `src/cli/commands/intake.ts`, `src/cli/commands/clarify.ts`(가칭).
- 새 schema: `src/schema/prompt.ts`, `src/schema/clarification.ts`(가칭).
- 새 skill 문서: `skills/clarify/SKILL.md`.
- 쓰기 대상 경로는 기존 `product/sources/`, `product/discovery/`뿐이다(새 artifact
  디렉터리를 만들지 않는다 — design.md D2 참고).
- `product/config.yaml`의 `stages` 필드 값(문자열)은 그대로, 의미 해석만 바뀐다 —
  schema 코드 변경 없음.
- Change 01의 기존 코드·테스트는 수정하지 않는다. `.claude/skills/` 등
  `product/` 밖 경로에는 아무것도 쓰지 않는다 — CLI 도움말/README에 수동 연결
  방법만 안내한다.
- `CONSTITUTION.md` 4번 원칙의 "Canvas" 문구에 대한 수정안을 design.md(D9)에
  제시했다. 이 change는 `CONSTITUTION.md` 파일 자체를 수정하지 않는다 — 적용은
  별도 승인 사항이다.
