# Tasks

사용자는 v0 Graph 관계 6종, `contains`/`causes`의 RelationCandidate 보존, 기존 9개 Stage 키를 유지하는 명시적 v0→v1 migration을 승인했다. 실제 사용자 관계 승인은 만들지 않았다. 구조 검증은 의미적 정확성이나 발언 진위를 증명하지 않는다.

## 1. 명세와 데이터 계약

- [x] 1.1 승인된 Graph 관계와 Stage migration 결정을 proposal/design/specs에 반영한다.
- [x] 1.2 6종 Graph Edge, 허용 kind, 확인 이력·claim/endpoint hash 계약을 Zod schema로 구현한다.
- [x] 1.3 unsupported RelationCandidate schema, 결정적 ID, 파일 단위 저장, 중복 억제, append-only review 이력을 구현한다.
- [x] 1.4 ImpactReport의 경로 증거, blocked inputs, completeness 및 input fingerprint를 구현한다.

## 2. provenance, 관계, 영향

- [x] 2.1 Prompt 무결성 및 Prompt→Clarification→NodeGroup→Node 참조/현재 상태를 검증한다.
- [x] 2.2 관계 방향별 confirmed/potential 영향과 terminal review 후보를 계산하고 잘못된 kind/endpoint 관계의 전파를 차단한다.
- [x] 2.3 confirmed cycle을 차단하고 proposed cycle은 검토 경고로 남긴다.
- [x] 2.4 Candidate stale 상태를 endpoint snapshot으로 재평가하고 모든 미지원 후보를 blocked_inputs에 명시한다.
- [x] 2.5 실제 발언 진위와 AI 의미 판단을 CLI가 증명하지 않는다고 Skill/문서/CLI 안내에 명시한다.

## 3. Stage Schema migration

- [x] 3.1 v0 9-key 및 v1 11-key schema를 지원하고 새 workspace는 v1을 사용한다.
- [x] 3.2 `productkit migrate` 명령에 dry-run, backup, journal, lock, resume, rollback을 구현한다.
- [x] 3.3 기존 값·주석·unknown field 보존, 실패·중단 복구·재실행·rollback 안전성을 테스트한다.
- [x] 3.4 v0 Change 01~03 명령 호환성과 v1 model/graph stage 갱신을 회귀 검증한다.

## 4. CLI, Skill, 문서

- [x] 4.1 Graph 상태, validate, trace, impact, Edge add/confirm, Candidate add/list/review CLI를 구현한다.
- [x] 4.2 graph Skill에 미지원 관계 보존·사용자 확인·구조/의미 평가 분리 절차를 작성한다.
- [x] 4.3 architecture, roadmap, artifact-contracts, README 및 graph template의 Change 04 설명을 구현과 일치시킨다.
- [x] 4.4 실제 빌드된 CLI를 임시 소비자 workspace에서 Candidate·impact·migration 경로로 검증한다.

## 5. 검증 및 Agent 평가

- [x] 5.1 관계·승인 hash·Node 변경 무효화·cycle·영향 방향/분류·Candidate 보존/중복/쓰기 실패 테스트를 통과한다.
- [x] 5.2 migration 경계 중단·복구·중복 실행·쓰기 실패·rollback과 기존 Change 01~03 회귀 테스트를 통과한다.
- [x] 5.3 `npm run typecheck`, `npm run build`, `npm test`, OpenSpec strict validation을 통과한다.
- [ ] 5.4 실제 Claude Code Skill 기반 3개 의미 평가를 실행한다. 현재 인증 상태가 `loggedIn=false`, `authMethod=none`이므로 결과는 UNKNOWN이며 이 task는 미완료다.
- [ ] 5.5 실제 사용자 응답이 필요한 관계는 사용자에게 제시하고 기다린다. 합성 fixture는 실제 승인으로 기록하지 않는다.

실제 Agent 인증과 사용자 관계 확인이 없는 상태에서도 구조 구현/테스트는 완료 가능하다. 이 change는 archive하지 않는다.
