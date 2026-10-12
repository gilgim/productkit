# Change 01~03 검증 및 Change 04 승인 검토

## 판정

**NO-GO — Change 04 구현 착수 보류.** OpenSpec planning 산출물은 검토 가능하지만 필수 실제 Claude Agent 3개 사례 검증은 인증 부재로 수행하지 못했고, 사용자 해석 확인도 없다. 선행 구현에서 완료 판정/출처 검증 불일치를 확인했다. 사용자 승인을 대행하지 않았다. 이를 “조건 없이 구현 준비 완료”로 표시하지 않는다.

이번 변경 파일은 graph-and-impact-analysis/의 proposal/design/specs/tasks, 이 보고서와 evidence/뿐이다. 공식 문서·src·기존 Change·기존 사용자 workspace는 수정하지 않았다. build와 기존 자동 테스트가 dist 및 임시 패키지를 생성한 것은 검증 부산물이다. Apply/Archive/Sync/Commit/Push/PR은 실행하지 않았다. 저장소는 시작부터 대부분 파일이 untracked여서 git diff만으로 원본 대비 전체 변경을 증명할 수 없다는 한계가 있다.

## 실제 조사 범위

읽은 근거: CONSTITUTION.md; docs/architecture.md, roadmap.md, artifact-contracts.md; src/schema/{config,prompt,clarification,node}.ts; src/clarification/{hash,io,skills,spans,workspace}.ts; src/cli/program.ts, commands/{init,intake,clarify,model}.ts; src/workspace/{plan,scaffold,templates}.ts; skills/{clarify,model}/SKILL.md; templates/product/; 기존 5개 change의 proposal/design/tasks 및 specs; tests의 관련 schema/CLI/init/model/clarify/packaging 검사. openspec/specs/에는 .gitkeep만 있다.

OpenSpec은 로컬 @fission-ai/openspec 1.14.0, schema=spec-driven, authoritative root=<PRODUCTKIT_ROOT>다. 기존 Change 04(0/39 tasks) 초안이 있어 새 change를 중복 생성하지 않고 요청된 경로에서 계획을 보완했다. 최종 tasks는 0/28이며 이는 구현 미수행을 뜻한다. OpenSpec status의 planning complete는 파일 존재를 뜻하며 구현 완료가 아니다.

## 실행한 명령과 결과

| 명령 | 실제 결과 | 의미/한계 |
|---|---|---|
| npm run typecheck | exit 0 | TypeScript 구조 검사 |
| npm run build | exit 0 | dist 빌드 성공 |
| npm test (최초 sandbox) | exit 1; 131 pass, packaging 5 skipped | ~/.npm cache EPERM으로 suite 실패; 숨기지 않음 |
| npm test (승인 후 sandbox 밖 재실행) | exit 0; 10 files / 136 tests pass | packaging 포함; 실제 사용자 의미 E2E 증거 아님 |
| npx openspec validate --all --strict | 5 changes pass | 수정 전 초안 포함 기계 구조 검사 |
| npx openspec validate bootstrap-product-discovery-workflow --strict | valid | Change 01 |
| npx openspec validate prompt-intake-and-clarification --strict | valid | Change 02 |
| npx openspec validate atomic-node-modeling --strict | valid + INFO | 메인 product-workspace 부재로 현 상태 archive 거부 예정 |
| npx openspec validate graph-and-impact-analysis --strict | valid + INFO | 최종 명세; 같은 archive 선행 의존 INFO |
| npx openspec list --specs | No specs found | main spec 비어 있음 |
| claude --version | 2.1.221 | 실제 바이너리 존재 |
| claude auth status | loggedIn=false, authMethod=none | 비밀 정보/인증값 읽지 않음 |
| claude -p (Skill 원문+3개 입력을 stdin 전달) | exit 1, Not logged in · Please run /login | 실제 Agent 추론은 실행되지 못함; evidence/claude-attempt.txt |
| node /tmp/productkit-change04-audit/probe.mjs | exit 0 | 임시 workspace CLI 3개 사례 및 명시적 합성 반례; evidence 참조 |

첫 Claude 호출은 --tools 옵션 인자 처리로 prompt 입력 오류였고 stdin 방식으로 바로잡아 재시도했다. 최종 차단 원인은 인증 부재다. 로그인이나 사용자 발언을 임의 생성하지 않았고 인증 설정을 수정하지 않았다.

## Change 01~03 실제 일치 여부

| 항목 | 판정 | 근거 |
|---|---|---|
| 01 workspace init | 주요 기능 PASS | 현재 10개 artifact dirs, config v0, 24 entries. 빈 경로/공백 경로/재실행 보존/충돌 사전 검사/쓰기 실패/밖 파일 보존이 자동 테스트로 통과. 01의 9 dirs에서 03이 nodes 추가한 누적 구현과 일치 |
| 02 원문 append-only | PASS (지원 CLI 경로) | intake는 새 PRM ID·hash·span 기록, 기존 파일 덮어쓰기 안 함 |
| 02 명확성 6단계 | PARTIAL/명세 불일치 | schema에 5개 steps 배열+interpretation_check 이력은 있으나 배열 default=[]; judgeCompletion은 단계 수행 여부를 검사하지 않음. 전부 빈 steps+합성 agreed도 confirmed로 판정됨 |
| 02 실제 발언 구분 | 구조 PARTIAL | definition.origin enum과 실제 발언 필드/출력 한계는 있음. 필드 라벨이 사실인지 검증 못함. decomposition/elaboration 전체 provenance 라벨을 강제하지는 않음 |
| 03 원자성 세 기준 | 구조 구현됨, 완료 게이트 결함 | evaluateAtomicityFinal truth table 존재. 독립 행동/복합조건/불확실/왜곡 반례 자동 테스트 통과. 그러나 split_required가 남아도 group modeled 허용(아래 F03) |
| 03 의미 보존 | AI 평가 의존 | condition/operator 후보 schema, distortion_checks 존재. 실제 자연어 판정은 AI; 구조 PASS를 의미 증명으로 볼 수 없음 |
| 04 원문/명료화 변경 무효화(선행 평가 항목) | PARTIAL | CLR steps 변경→확인 hash mismatch, steps 변경→NodeGroup source hash mismatch는 검사됨. Prompt raw 수정/없는 PRM/span/CLR 변경은 기존 CLI에서 체인 검증되지 않음 |
| 05 사용자·AI·결정 구분(선행 평가 항목) | 계약은 구분, 실제 E2E UNKNOWN | origin/confirmation 존재; Decision schema/명령은 Change 06로 아직 없음. 확인 레코드 해시는 실제 발언 인증 불가 |

위 “04/05” 행은 사용자 검증 체크리스트의 항목 번호이며 구현 Change 번호를 뜻하지 않는다.

## 발견 사항과 미해결 위험

| ID | 심각도 | 관찰/재현 | 필요한 후속 조치 (이번 수정 아님) |
|---|---|---|---|
| F01 | major | 빈 steps가 합성 확인만으로 confirmed. tests/clarification.test.ts도 emptySteps 확정을 기대함 | 02의 단계 수행/적용 안 함 기록 계약을 결정하고 별도 수정 승인. 단순 min(1)은 정상 관계/반례 없음도 막으므로 해결로 단정하지 않음 |
| F02 | major | prompt_ref=PRM-999가 존재하지 않아도 clarify는 confirmed, exit 0. runClarify/runModel은 PRM raw hash/spans를 읽지 않음 | 참조/원문 hash/span 검사와 변경 snapshot 범위를 선행 수정에서 승인. 04에서는 Graph 입력 경계로 유입 차단 |
| F03 | major | evaluateAtomicityFinal=no+valid_split+preserved→split_required지만 judgeNodeSetCompletion 결과 modeled | 완료 시 final=atomic 요구를 선행 수정으로 승인. 독립 행동이 쪼개지지 않아도 완료되는 구조적 공백 |
| F04 | major | distortion_checks 기본 [] 허용; 항목별 역합성 존재/coverage를 강제하지 않음. Node ID 중복 및 originMatchesSourceRefs가 model CLI에 통합되지 않음 | 기존 03 AC와 완료 gate 범위 재검토. Graph에서는 중복 ID/출처/atomic 검사 추가 |
| F05 | major | Node finding이 open 아니면 resolution_ref/실제 결정 유효성 없이 modeled 가능; 기존 spec도 해소 절차는 후속 범위라 경계가 느슨함 | 자동 해소 금지 Skill 유지, 05~06의 해소 근거 계약 보강을 별도 승인 |
| F06 | major | clarify Skill은 computeEntryHash 설명에 id 제외라고 안내하지만 함수는 entry_hash만 제외한 id 포함 전체 필드를 hash | 실제 Agent가 지시를 그대로 따르면 무결성 오류 가능. Skill 수정은 기존 Change 승인 범위로 별도 요청 |
| F07 | major | config는 Zod object parse 후 stringify하므로 unknown 필드·주석이 stage 갱신에서 손실 가능(코드 확인) | 04 migration 및 stage writer에서 YAML 보존을 명세화; 기존 명령 일반 데이터 보존 개선은 승인된 04 범위로 구현 시 검사 |
| F08 | major | init은 별도 constitution template을 복사하며 template 4항은 아직 “Canvas 원본”, Decision→Prompt 의무도 빠져 있음 | 01 template 정합성 수정 별도 승인. 기존 workspace constitution은 덮어쓰지 않음 |
| F09 | minor | 구조 신호/어휘 함수는 export와 단위 테스트만 있고 model CLI에서 후보 출력에 사용되지 않음 | 03의 CLI 신호 제공 AC 충족 여부 재검토 및 별도 수정 승인 |
| F10 | limitation | entry_hash를 포함해 파일 전체와 hash를 함께 다시 쓸 수 있음 | 내부 일관성만 검사; 인증/악의적 변조 방지 표현 제거안 보고 |

F01/F02/F03은 evidence/probes.json에서 실행 결과로 재현했다. F04~F09는 코드/문서 조사 결과이며 실제 Claude 발생 오류라고 주장하지 않는다. 실제 3개 사례 Agent의 의미 오류 개수는 UNKNOWN이다. 기존 tasks의 “과거 실제 Agent” 주장은 이번 세션의 재검증 증거로 재사용하지 않았다.

## 3개 사례 평가 — 실제 Claude 미완료 / 별도 CLI 모의 검사

공통: 실제 Claude output Clarification=UNKNOWN, Node=UNKNOWN, 실제 사용자 승인=없음. stdin으로 skills/clarify와 skills/model 원문을 제공해 실행을 시도했지만 인증에서 차단됐다. 따라서 Claude가 Skill을 실제 수행했다고 보고하지 않는다.

별도로 현재 주 Agent가 작성한 **최소 구조 draft**를 임시 workspace에 넣어 CLI gate만 검사했다. 각 draft는 원문 전체를 decomposition 1개로 보존, 해당 Prompt의 모든 span_refs, 나머지 steps 배열=[], interpretation_check=[], status=awaiting_confirmation이다. 이는 6단계 분석 완성품이나 사용자 승인 artifact가 아니다. 상세 원문/YAML 객체/CLI stdout·stderr·exit은 evidence/cases.json에 있다.

| 사례 | 원문 | 주 Agent의 의미 검토(예상 위험) | 실제 CLI 모의 결과 / Node |
|---|---|---|---|
| S01 독립 행동 | 결제가 완료되면 주문을 확정하고 이메일을 보내고 재고를 차감한다. | 행동 3개로 나누되 각자 결제 완료 트리거 보존. 병렬 가능하며 서술 순서만으로 선후/인과/의존을 가정하면 의미 오류 | init/intake 0; clarify 0이나 not yet complete(no_confirmation); model 2. Node 생성 안 함 |
| S02 AND/OR·예외 | 로그인 실패가 3회 이상이고 최근 1시간 이내이거나 관리자가 잠금을 요청하면 계정을 잠근다. 단, 서비스 계정은 제외한다. | `(실패≥3 AND 최근1h) OR 관리자요청` 해석은 후보이며 실제 괄호 확인 필요. 서비스 계정 예외가 두 분기 전체에 적용되는지 질문. 임의 AND/OR 치환·조건 분해·예외 범위 확정은 의미 오류 | 같은 미확인 차단. Clarification은 최소 draft이며 Node 없음 |
| S03 변경·충돌 | 기존 규정: 구매 후 7일 이내 환불 가능. 신규 요구: 디지털 상품은 구매 후 30일 이내 환불 가능. | 기존 7일 “이내 가능”이 7일 초과 금지를 뜻하는지 UNKNOWN. 신규가 예외/확대/전체 대체인지 질문. conflicts/exception/supersedes 중 하나 자동 확정 금지 | 같은 미확인 차단. 기존 정책 artifact와의 실제 Agent cross-workspace 비교도 미수행; Node 없음 |

실제 사용자 확인을 받기 전 model Skill로 Node를 생성하는 것은 기존 계약 위반이므로 중단했다. probes의 SYNTHETIC TEST ONLY 확인은 별도 반례 데이터에만 사용했고 위 세 사례의 사용자 동의로 사용하지 않았다. 이 모의 검사가 실제 Claude E2E를 대체하지 않는다.

재개에 필요한 조건: 사용자가 Claude Code 로그인 환경을 준비하고 실제 6단계 해석을 검토·응답해야 한다. 인증 없이 임의 계정/대체 API를 사용하지 않는다. 사용자 응답 없이 3개 E2E 성공을 선언하지 않는다.

## Archive 사전 점검 (실행 안 함)

| Change | task 현황 | Strict | archive 시 메인 spec | 의존/충돌 | 준비 상태 |
|---|---|---|---|---|---|
| 01 bootstrap-product-discovery-workflow | 32/32 | PASS | cli-foundation (ADDED), product-workspace (ADDED, 9 dirs) | main spec 없으므로 ADDED 가능. 코드 누적 10 dirs는 03 delta로 설명. constitution template 불일치 별도 해소 필요 | 구조상 선행 가능, 내용 확인 필요 |
| 02 prompt-intake-and-clarification | 40/41 | PASS | prompt-clarification (ADDED) | 8.1 fixtures 경로 task 미체크: inline 테스트 대체라고 쓰여 있으나 완료 처리 합의 없음. 6단계/출처 gate 불일치 미해소 | 보류 |
| 03 atomic-node-modeling | 30/31 | PASS + main 부재 INFO | atomic-node-modeling (ADDED), product-workspace (MODIFIED, 10 dirs) | 8.4 archive 검증 미체크. MODIFIED의 exact heading “init은 product workspace 구조를 만든다”는 01 ADDED와 일치. 01 없이 archive 불가 | 01 필요 + 완료 gate 수정 검토 후 |

권장 순서: **01→02→03→04**. 구조적으로 03의 product-workspace 직접 선행은 01이고 02는 CLR 입력 계약의 논리적 선행이다. 03 MODIFIED는 전체 init requirement와 기존 경로/공백 시나리오를 포함하므로 부분 delta로 기존 요구를 잃는 문제는 없다. 04도 같은 requirement를 11 dirs로 갱신하며 기존 init 보존 요구를 삭제하지 않는다. 순서대로 반영된 메인 spec과의 의미 충돌 없음은 문서 비교 수준의 결론이며 실제 archive 실행 검증은 UNKNOWN이다.

별도 `redesign-prompt-first-architecture`는 0/12, Strict PASS지만 02와 중복되는 prompt-clarification ADDED heading 및 별도 node-graph-analysis의 “모든 순환 오류/복합 Node 거부” 등 후속 정교화와 상충하는 요구를 가진다. 02 다음에 그대로 archive하면 duplicate ADDED 문제가 생길 수 있고, 이전에 archive해도 02 ADDED와 충돌한다. 자동으로 순서에 끼우지 않는다. 이 설계 방향 change를 문서 결정으로만 유지할지 delta를 재조정할지 별도 승인해야 한다. 기존 change 수정·archive는 이번 범위 밖이다.

Strict PASS는 archive 적용 가능성·task 완료·의미 정합성을 보장하지 않는다. CLI가 main product-workspace 부재를 INFO로 명시했으며 이를 무시하지 않았다.

## 공식 문서 정합성과 변경안 (미적용)

| 문서/파일 | 현황/불일치 | 제안 변경 및 영향 범위 |
|---|---|---|
| CONSTITUTION.md | Prompt 방향과 AI/CLI 분리·명시 동의·최신성 원칙은 현 설계와 일치. “같은 원칙 복사”는 오래된 template과 불일치 | 원칙 수정 불필요. template 정합성은 01 별도 수정 승인; 기존 사용자 constitution은 덮어쓰지 않음 |
| docs/architecture.md | 입력 Prompt, 실제 src 4개 디렉터리와 10 artifact dirs 정확. 8종 고정·선형 체인·04 migration D11 참조는 새 초안과 달라짐 | 6종/2종 보류 근거, 생성 순서와 출처 DAG 구분, 명시적 migration·9-Phase/11-key 대응표. 새 명령은 구현 후 노출 |
| docs/roadmap.md | 01~03 완료 단정은 실제 task/결함/E2E와 차이. tests/fixtures 실제 없음. “span 100%”는 decomposition-index 커버리지 구현과 다름 | 구현됨과 검증 완료를 분리, inline fixture, 실제 coverage 단위, 04의 관계 선택 반영. 과거 번호 표는 역사 설명으로 유지 |
| docs/artifact-contracts.md | 서두 “01 config만 실제 구현”은 02~03 코드와 불일치. config v0 설명은 현재 구현으로 정확. Discovery 폐기 절은 역사 표시. 해시의 “들키지 않고 고칠 수 없음”은 재해시 가능성 대비 과장 | 현 구현/계획 구분, Graph/Impact v1·확인 이력·provenance·migration 추가, hash 한계 수정. Policy Node≠최종 Policy 명시 |
| templates/product/constitution.md | Canvas 원본 표기, Prompt/Decision 체인 의무 누락 | 01 별도 수정으로 새 workspace template만 교정; 기존 데이터 보존 |
| package.json | description/keywords에 Canvas/Obsidian 남음 | 출시 metadata 수정 별도 범위; 이번 소스/metadata 수정 안 함 |
| 기존 01 tasks/설계 | Change 02~08 등 옛 번호와 Canvas 시절 설명 일부 유지 | 역사 기록과 현행 동작 구분, 기존 change 수정은 별도 승인 |
| skills/clarify/SKILL.md | entry hash id 제외 안내가 코드와 다름; tamper 설명 과장 | 02 별도 Skill 교정안; 04 Graph Skill에는 id 포함 및 인증 불가 정확히 명시 |

공식 문서와 기존 change를 조용히 고치지 않았다. 위 변경안과 영향 범위만 제시한다.

## 구현 승인 전 결정 사항

1. `contains`/`causes` 보류와 6종 닫힌 Graph 계약, terminal 검토/전파 방향표 승인.
2. v0 키 보존+2키 추가(schema 1, 11 keys)와 명시적 migrate/resume/rollback, 자동 migration 금지 승인.
3. F01~F09의 기존 Change 수정 범위를 별도로 승인하고 02/03 미완료 task 처리 방침 결정. 이 보고서는 수정 권한을 추정하지 않는다.
4. 실제 Claude 인증 후 3개 사례의 사용자 해석 확인 진행. 이번 계획 승인은 각 사례의 Clarification/Edge 승인이 아니다.
5. 공식 문서/constitution template/옛 redesign change의 정합성 수정 범위 승인. Archive는 별도 승인·별도 작업이다.

위 결정을 반영하고 실제 Agent/user 검증 및 선행 결함 해소를 완료한 뒤 Change 04 구현을 승인할지 요청한다. 지금은 검증된 planning 문서 검토에서 종료하며 자동 Apply로 진행하지 않는다.

## 인수 테스트 위치

구조 T01~T10/T13/T14/T15는 specs/graph-and-impact-analysis/spec.md, workspace T11/T12/T13/T14는 specs/product-workspace/spec.md에 WHEN/THEN으로 정의했다. 실제 AI 의미 평가 AI-S01~03은 별도 scenario와 tasks 4.3~4.4에 있다. T15의 후속 artifact 부분은 합성 계약 테스트이며 실제 Change 05~09 E2E 완료와 구분한다. 구현 예정 파일은 design D10, 데이터 계약은 D2~D7, migration은 D9/D11, 단계별 테스트는 tasks.md를 참조한다.

---

## Change 04 구현 검증 보충 (2026-10-13)

위 사전 검토의 **NO-GO는 구현 전 상태의 역사적 판정**이다. 이후 사용자가 6종 관계·RelationCandidate·v0→v1 migration을 명시 승인하여 이 Change의 Stage F를 구현했다. 현재 코드는 다음과 같이 판정한다.

- Graph Edge는 6종만 저장한다. `contains`/`causes`를 비롯한 미지원 관계는 지원 Edge로 alias하지 않으며 개별 YAML RelationCandidate로 보존한다. Candidate fingerprint는 중복 생성을 억제하고 Node snapshot 변경 후 stale로 표시한다. 후보는 영향 경로에 참여하지 않고 ImpactReport `blocked_inputs`에서 ID/제외 이유로 드러나며 보고서를 incomplete로 만든다.
- Edge의 제안 상태, 사용자 응답 이력, claim hash, endpoint snapshot, append-only 확인 기록을 분리했다. CLI는 구조와 hash만 검사한다. 확인 텍스트의 실제 발언자나 관계의 의미적 진실을 증명하지 않는다.
- 영향 탐색은 타입별 방향을 적용한다. 잘못된 kind/endpoint 관계는 incomplete blocked input이며 전파되지 않는다. 영향 report의 재검사는 현재 입력에서 재계산한 결과 본문과 비교하므로 저장 report 변경도 감지한다.
- 신규 workspace는 v1을 사용한다. 명시적 `productkit migrate`가 v0의 기존 9개 Stage 키를 보존하면서 두 키를 더한다. 백업/journal/lock, resume, hash 조건부 rollback과 실패 주입 테스트가 있다.
- `docs/architecture.md`, `docs/artifact-contracts.md`, `docs/roadmap.md`, README, Graph Skill을 구현과 정합화했다. 사용자 workspace 파일은 수정하지 않았다.

### 검증 실행

| 명령/검증 | 결과 |
|---|---|
| `npm run typecheck` | PASS, exit 0 |
| `npm run build` | PASS, exit 0 |
| `npm test` | PASS, 18 test files / 206 tests |
| `npx openspec validate graph-and-impact-analysis --strict` | PASS. 단, main `product-workspace` spec이 없어 archive 시 MODIFIED delta를 적용할 수 없다는 INFO가 남는다. Archive는 실행하지 않았다. |
| 빌드된 `dist/cli/bin.js` E2E | PASS. 임시 소비자 workspace에서 unsupported Candidate 저장→ImpactReport 차단, 저장 report 변경 감지, v0→v1 명시 migration/backup을 실행했다. 합성 fixture이며 사용자 승인으로 간주하지 않는다. |
| Claude Code 인증/Agent 실행 | UNKNOWN. `claude auth status`: `loggedIn=false`, `authMethod=none`. 실제 Skill을 지정한 `claude -p` 시도도 `Not logged in · Please run /login`, exit 1. A/B/C 세 의미 평가는 실행되지 않았다. |

자동화 테스트의 사용자 확인 문구는 명시적으로 `SYNTHETIC TEST ONLY`로 표시했다. 어떤 실제 Edge도 사용자 승인 상태로 만들지 않았다. 실제 의미 검토 세 사례와 실제 사용자 응답은 아직 검증되지 않았다.

### 최종 판단

Change 04의 구조 구현, migration, 문서 정합화 및 자동/빌드 CLI 검증은 완료됐다. 실제 Agent 의미 평가와 실제 제품 관계 사용자 승인은 미완료/UNKNOWN이다. 따라서 **구조 구현을 Change 05로 자동 확장하지 않는다**. Archive, Commit, Push, PR도 실행하지 않았다. OpenSpec tasks의 실제 Agent 평가 및 실제 사용자 응답 항목은 체크하지 않은 상태로 둔다.
