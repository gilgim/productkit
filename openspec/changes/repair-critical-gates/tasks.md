# Tasks

## 1. 재현과 회귀 테스트

- [x] 1.1 기존 소스/테스트를 읽고 baseline 136/136을 실행했다. 세 결함을 public Gate 실패 테스트와 이전 소스의 별도 빌드 CLI로 재현했고 verification.md/evidence에 기대·실제·원인을 기록했다.
- [x] 1.2 빈 Clarification + agreed의 실패를 먼저 확인하고 단계별 산출물/placeholder/참조 검증을 추가했다. critical-gates.test.ts의 정상·반례 테스트로 확인했다.
- [x] 1.3 split_required final의 실패를 먼저 확인한 뒤 차단했고 원본 보존·새 Node 분해·출처 오류/중복 ID/불확실 검토 테스트를 추가했다.
- [x] 1.4 Prompt context 누락/원문 변경의 실패를 먼저 확인한 뒤 actual source 참조·hash/span·확인 snapshot과 NodeGroup의 전체 CLR snapshot 검사로 수정했다.

## 2. 기존 계약과 데이터 보존

- [x] 2.1 기존 136개 테스트 사례를 유지하고 정상 fixture에 완전한 단계/출처/검토 근거만 보강했다. 정상·재실행·입출력 실패·패키징 회귀가 모두 통과했다.
- [x] 2.2 legacy 데이터는 읽되 자동 보강/삭제/승인 없이 차단하는 테스트와 원문/CLR/Node byte 보존 테스트를 통과시켰다.
- [x] 2.3 기존 change/공식 문서/Skills/Change 04를 수정하지 않고 별도 보정 specs와 additive 계약·호환성 한계를 design.md에 기록했다.

## 3. 최종 검증

- [x] 3.1 npm run typecheck 및 npm run build를 실행하고 exit 0을 확인했다.
- [x] 3.2 npm test에서 기존 136+신규 41=177 tests / 12 files가 모두 통과했다.
- [x] 3.3 보정 Change·Change 02·03·04 Strict Validation을 실행하고 통과 및 기존 archive 선행 INFO를 기록했다.
- [x] 3.4 빌드된 실제 CLI 별도 프로세스 8개 E2E를 실행했다. 합성 확인과 실제 사용자 E2E를 구분하고 Change 04 잔여 NO-GO 조건을 보고했다. Apply/Archive/Commit/Push/PR 및 Change 04 구현은 실행하지 않았다.
