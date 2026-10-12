# ProductKit Constitution

ProductKit이 지키는 불변 원칙이다. 모든 CLI 명령, Agent Skill, 생성 artifact는 이
원칙을 위반하지 않아야 한다. 원칙과 충돌하는 기능 요청은 구현하기 전에 사용자에게
되돌려 질문한다.

## 1. AI 추론을 사용자 결정으로 기록하지 않는다

AI가 생성한 요약, 추천, 가정은 Decision이 아니다. `DEC-xxx`는 사용자의 명시적인
선택이나 확정 발언이 있을 때만 생성한다. 추천을 제시한 상태는 `pending`이다.

## 2. 불명확한 사항은 임의로 채우지 않고 Finding으로 남긴다

빈칸을 그럴듯한 내용으로 메우지 않는다. 모르는 것은 `FND-xxx`로 기록하고 사용자에게
질문한다. 질문하지 않고 추측한 내용을 제품 정의에 넣지 않는다.

## 3. 모든 사용자 결정에는 rationale이 있어야 한다

rationale이 없는 Decision은 기록하지 않고 사용자에게 이유를 묻는다. 검증은 rationale
누락을 FAIL로 판정한다.

## 4. 원본 프롬프트부터 최종 정의까지 근거를 추적할 수 있어야 한다

모든 Definition 항목은 Decision을 거쳐 Prompt까지 참조가 이어져야 한다. 원문 인용은
원문 그대로 보존하고, AI 요약을 원문으로 표시하지 않는다.

## 5. 대안에는 이점·단점·비용·불확실성을 함께 제시한다

Proposal의 각 option은 benefits, costs, risks, assumptions를 갖는다. 장점만 나열한
대안은 대안이 아니다. 억지로 개수를 맞추지 않고 의미 있는 대안만 제시한다.

## 6. 해결되지 않은 Critical Finding이 있으면 Definition을 확정하지 않는다

Critical Finding은 단순 defer로 Gate를 통과할 수 없다. 범위 밖이라면 명시적인 범위
결정(Decision)으로 해소해야 한다.

## 7. Product Definition과 Implementation Spec을 분리한다

ProductKit은 제품 행동(Journey, 정책, Acceptance Criteria)을 정의한다. 데이터베이스
스키마, API 설계, 컴포넌트 구조는 ProductKit이 지어내지 않는다.

## 8. AI Review와 실행 가능한 검증을 분리한다

기계 검증은 schema, 참조, 상태 그래프, 상태값처럼 결정적으로 판정 가능한 것만
판정한다. 의미적 타당성은 AI Review의 영역이며, 기계 검증은 Review의 존재·형식·최신성·
미해결 Finding만 확인한다. 기계 검증이 의미 타당성을 스스로 검증했다고 주장하지 않는다.

## 9. 입력이나 결정이 바뀌면 기존 검증 결과를 그대로 재사용하지 않는다

Gate는 과거 PASS 기록이 아니라 현재 문서 내용을 기준으로 판정한다. 평가 대상 내용의
hash가 바뀌면 기존 Review와 검증 결과는 stale이다.

## 10. 초기화·재실행·export가 기존 사용자 내용을 조용히 덮어쓰지 않는다

`init` 재실행은 기존 파일을 보존하고 없는 파일만 만든다. export는 같은 이름의 change가
있으면 실패한다. 덮어쓰기가 필요하면 사용자가 명시적으로 처리한다.

---

## 적용 방식

- 이 문서는 ProductKit 저장소의 원칙이다.
- `productkit init`은 대상 앱의 `product/constitution.md`에 같은 원칙을 복사한다.
- 대상 앱은 자신의 `product/constitution.md`에 제품별 원칙을 추가할 수 있다.
  ProductKit은 재실행 시 그 파일을 덮어쓰지 않는다.
