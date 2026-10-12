# Tasks

## 1. Finding 계약과 상태 규칙

- [x] 1.1 `src/schema/finding.ts`에 Finding 유형·severity·typed refs·evidence·counterexample·AI assessment·questions·history schema를 추가하고 `tests/finding.test.ts`에서 유효/불완전/잘못된 참조 반례를 검증한다.
- [x] 1.2 Finding fingerprint와 중복 제출을 구현하고 exact rerun/변경 claim ID 테스트를 통과시킨다. 기존 ID의 material evidence conflict는 fail-closed 처리한다; linked revision authoring remains a follow-up limitation.
- [x] 1.3 proposed/unresolved 초기 상태와 confirmed/rejected의 현재 hash 결합 사용자 확인을 구현했다. Change 05 resolution write path는 없으며 resolution record는 Decision ref를 요구한다.
- [x] 1.4 append-only 확인/상태 이력과 hash binding, 변조 감지 테스트를 구현했다.
- [x] 1.5 Finding 계약과 Change 06 해소 경계를 `docs/artifact-contracts.md`에 반영했다.

## 2. Challenge 범위와 완료 판정

- [x] 2.1 `src/schema/challenge.ts`에 ChallengeRun, 범위, 8개 영역, input manifest, Skill/rules version, checkpoint 및 review hash를 정의했다.
- [x] 2.2 현재 modeled NodeGroup과 연결 Prompt/Clarification/Graph/Candidates/ImpactReports/Findings의 입력 hash를 snapshot하고 scope를 기록했다.
- [x] 2.3 8개 영역 모두 reviewed 또는 이유 있는 not_applicable, 완전한 current scope와 input manifest가 있어야 완료된다; stale/missing input은 incomplete다.
- [x] 2.4 review coverage와 open/critical Findings를 독립 출력하며 unresolved Finding이 있어도 coverage completion이 가능하다.
- [x] 2.5 `tests/challenge.test.ts`에 실패 흐름, 미정 경계, 충돌/부분집합 제약, Graph 및 의미 왜곡 curated fixtures를 추가했다. 이들은 구조 상태 테스트이며 AI 정확도 증거가 아니다.

## 3. 의미 Finding 근거와 상태 출력

- [x] 3.1 Graph/Impact/Node/Prompt refs를 typed reference로 보존·검증하며 기존 Change 02~04 snapshot/validators를 재사용한다.
- [x] 3.2 의미 fixture 기대를 구조 상태 테스트와 분리했다. 실제 AI false-positive/semantic accuracy evaluation is UNKNOWN because Claude authentication is unavailable.
- [x] 3.3 Critical unresolved Findings remain visible; Change 05 has no resolution/defer/dismiss command and confirmation is separate from resolution.
- [x] 3.4 Skill/output/docs distinguish semantic AI judgment, counterexample hypotheses, and structural validation.

## 4. Freshness, 재개, 파일 안전성

- [x] 4.1 upstream workspace fingerprint, Graph, Candidate, ImpactReport, Finding content, scope를 freshness snapshot에 포함하고 change stale 테스트를 통과시킨다.
- [x] 4.2 checkpoint resume validates same fingerprint; stale input blocks resume while preserving prior record.
- [x] 4.3 atomic create/replace CAS, deterministic run/Finding IDs, idempotent creation, failed publish preservation tests added.
- [x] 4.4 `product/reviews/` persistence and schema re-read tests added.

## 5. CLI, Agent Skill, 문서

- [x] 5.1 `challenge` status, finding add/confirm, review start/area/complete/validate/resume commands and built CLI E2E implemented.
- [x] 5.2 `skills/challenge/SKILL.md` documents scope → artifacts → normal/failure/boundary → gaps/conflicts → counterexamples → proposals → uncertainty flow; actual Agent execution remains unavailable.
- [x] 5.3 architecture, artifact contracts, roadmap aligned; temporary workspace CLI commands exercised by built E2E.
- [x] 5.4 Change 01~04 regression suite, typecheck/build, and OpenSpec strict validation passed (217 tests).
- [x] 5.5 Agent 인증 상태를 확인했다 (`claude auth status`: loggedIn=false). 실제 Skill 의미 평가는 UNKNOWN; 구조 테스트로 의미 PASS를 대체하지 않았다.
