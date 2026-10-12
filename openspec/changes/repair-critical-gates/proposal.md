# Proposal

## Why

Change 02·03의 완료 Gate가 빈 명료화와 미분해 Node를 완료로 판정하고 실제 Prompt를 검사하지 않아 출처 변경을 무시했다. 기존 검증 계약을 복구하고 실제 CLI 회귀 테스트로 잘못된 완료 전이를 차단한다.

## What Changes

- Clarification 완료 시 정의/분해/구체화 산출물, 관계/반례 검토 결과, 해석 확인을 모두 검사한다. 빈 관계·반례 목록은 이유가 있는 명시적 검토 결과로만 완료될 수 있다.
- 확인 기록을 Prompt ID/hash와 현재 steps hash에 결합하며 실제 원문 hash/span과 내부 참조를 검사한다.
- NodeGroup은 최종 atomic Node만 허용하며 분해 전 split_required Node는 retired_nodes에 보존하고 새 Node.split_from으로 연결한다.
- 항목별 조건·논리 연산자·예외 보존 검토와 Clarification 전체 출처/확인 snapshot을 필수 완료 조건으로 추가한다.
- **BREAKING completion contract**: 구형 draft는 파싱 가능하지만 새 필수 근거가 없으면 완료로 판정하지 않는다. 자동 데이터 수정·과거 승인 재해석·config schema migration은 하지 않는다.

## Capabilities

### New Capabilities

없음.

### Modified Capabilities

- `prompt-clarification`: 6단계 구조적 완료, 실제 Prompt 참조/버전 검사와 확인 snapshot.
- `atomic-node-modeling`: 최종 Node 원자성, 분해 이력, 의미 보존 기록, 전체 출처 최신성.

두 capability는 Change 02·03의 in-flight ADDED delta에 있다. 기존 change를 덮어쓰지 않고 추가 Gate 요구사항으로 보정한다. archive 전제 순서는 01→02→03→본 보정→04이며 이번에 archive하지 않는다.

## Impact

관련 schema/Gate, clarify/model의 파일 조회와 진단, 패키지 hash helper export, 기존 정상 fixture 보강과 회귀/실제 CLI 테스트만 변경한다. 공식 문서·기존 Skills·Change 04 소스와 명세·기존 사용자 데이터는 수정하지 않는다. 상세 파일·전후 결과는 verification.md 참조.
