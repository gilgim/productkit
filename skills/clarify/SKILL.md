---
name: productkit-clarify
description: Clarify a raw product idea saved by `productkit intake` into a confirmed, traceable Clarification (definition, decomposition, elaboration, relations, counter-examples, span coverage, interpretation check). Use after intake, or when the user wants to sharpen a vague product idea.
---

# Clarify Skill

ProductKit의 Phase 2(Clarification) instruction이다. CLI는 이 내용을 생성하지
않는다 — 이 instruction을 읽고 따르는 건 Agent의 일이다. 정확한 필드 목록은
이 문서가 아니라 `productkit schema clarification` 이 원본이다. 이 문서와 CLI
출력이 다르면 CLI 가 맞다.

## 목적

`product/sources/PRM-xxx.yaml` 의 원문을 **빠짐없이** 다룬 Clarification 을 만들고,
사용자가 CLI 가 그려 준 내용을 보고 직접 동의하게 한다. 원문과 추론을 분리하고,
원문의 어떤 문장도 조용히 사라지지 않게 하는 것이 이 단계의 전부다.

## 진입

1. `productkit` 이 없다 → 설치 안내(`README.md`). 더 진행하지 않는다.
2. `productkit clarify` 가 "No ProductKit workspace found" → `productkit init`.
3. "No prompt found" → `productkit intake -- "<프롬프트>"` (원문이 `-` 로 시작하면 `--` 가 필요하다).
4. 그 외는 CLI 가 알려주는 입력·출력 경로를 따른다.

## 입력 · 출력

- 입력 `product/sources/PRM-xxx.yaml` — **수정하지 않는다.** `spans` 가 원문을
  문장 단위로 자른 목록이다.
- 출력 `product/discovery/CLR-xxx.yaml` (xxx 는 Prompt 와 같은 번호). 정확한 형식:
  `productkit schema clarification`. Agent 가 쓰는 부분은 `steps` 와
  `finding_candidates` 뿐이다. `interpretation_check` 는 손으로 쓰지 않는다
  (아래 "해석 확인").

## steps 를 쓰는 규칙

- `definition[].origin` 은 `user_stated`(사용자가 직접 말함) 또는
  `ai_inferred`. 추측한 정의를 `user_stated` 로 적지 **않는다**.
- `decomposition[]` — 요구사항으로 읽는 문장마다 항목 하나. `statement` 는 그 span 의
  원문 **글자 그대로**다(공백만 다를 수 있다). 바꿔 말하지도, 줄이지도, 이름표를
  붙이지도 않는다 — 다르면 `reading_incomplete` 로 거부된다. 이 단계에서 Agent 가
  정하는 것은 "이 문장이 요구사항인가 / 아닌가 / 질문인가" 뿐이고, 한 문장을 여러
  요구로 나누는 일은 atomize 에서 원문 조각(slice)으로 한다.
  - span 여러 개를 한 항목에 묶으면 `statement` 는 그 span 들을 띄어쓰기로 이은
    원문이고 `merge_reason`(6자·2단어 이상) 필수.
  - 원문에 없는 내용을 지어내 넣지 않는다.
- `elaboration[]` — decomposition 의 각 `statement` 와 **글자 그대로 같은**
  `statement` 로 하나씩. actor·object·condition·action·result 를 채운다.
- `relation_check[]` — `statement_a`·`statement_b` 는 서로 다른 두 decomposition
  `statement` 를 글자 그대로. 후보가 없으면 목록을 비우고
  `relation_check_no_items_reason` 에 왜 없는지 적는다(둘 다 있으면 거부).
- `counterexample[]` — 모호한 문장마다 해석 후보 2개 이상. 없으면 비우고
  `counterexample_no_items_reason`.
- **원문 전수 처리 (Constitution 11).** Prompt 의 모든 span 은 셋 중 한 곳에 있어야
  한다. 하나라도 빠지면 `uncovered_spans` 로 거부된다.
  1. `decomposition[].span_refs` — 요구사항으로 읽었다.
  2. `finding_candidates[].span_refs` — 모호·모순·전제 누락이라 질문으로 남겼다.
     이 후보는 나중에 Challenge 에서 **사용자가 확인한 Finding** 으로 올라가야
     validate 를 통과한다. 쓰레기통이 아니다.
  3. `steps.span_coverage` — 요구사항이 아니다(제목·비유·예시·서술). `reason` 한 줄
     (6자·2단어 이상). 다음은 여기 둘 수 없다 — 분해하거나 질문으로: `?` 로 끝나는
     문장, 숫자가 든 문장, 부정·조건어(불가·없이·않·단·만·이내·경우에만 …)가 든 문장,
     내용 단어 10개 이상인 문장, **서술형으로 끝나는 문장**("…다", "…한다", "…됨"),
     그리고 **사용자가 표시하지 않은 모든 문장**. 제외할 수 있는 건 둘뿐이다 —
     구조 줄(`#` 제목·구분선·목록 번호, 단 숫자·부정어가 없을 때)과 사용자가 직접
     `예:`·`예시:`·`비유:`·`참고:`·`비고:`·`주:`·`note:` 로 시작하게 쓴 줄. "배송 무료",
     "- 결제 수단: 카드" 같은 줄은 사용자가 표시를 안 했으니 내용이다. Agent 가 이유를
     아무리 잘 써도 안 된다.
  - "단, …" "다만 …" 처럼 예외로 시작하는 문장은 앞 문장과 **한 항목으로 묶어야**
    한다(`merge_reason` 포함). 따로 읽으면 거부된다.
- 모호성·모순은 임의로 하나를 골라 확정하지 않고 `finding_candidates` 에 남긴다.
- YAML 문자열 안에 `"..."` 인용부호를 그대로 넣지 않는다(파싱 오류). 작은따옴표
  규칙(`''`) 을 쓰거나 따옴표 없이 쓴다.

## 해석 확인 (완료 조건)

사용자에게 보여주는 문장은 **CLI 가 만든다.** Agent 가 요약해서 보여주지 않는다.

1. `productkit clarify` 를 실행한다. steps 가 온전하면 `Show the user` 아래에
   용어, 원문 순서대로 문장마다 해석·요구사항 아님·질문, 관계 후보, 달리 읽힐 수
   있는 곳이 찍힌다. steps 에 문제가
   있으면 이유(`uncovered_spans`, `missing_merge_reason`, …)가 찍힌다. 고치고 다시
   실행한다.
2. 그 블록을 **그대로** 사용자에게 보여주고 동의를 구한다. 여기서 사용자가 틀린
   해석·잘못 제외된 문장을 잡는다.
3. 사용자 응답 기록은 `productkit clarify confirm --response agreed|disagreed|partially_agreed`
   이다. 이 명령은 블록을 다시 그리고, `presented_hash`·`entry_hash` 를 계산하고,
   사용자 발언을 **실행한 터미널에서 직접** 읽어 `interpretation_check` 에 붙인다.
   - Agent 는 터미널이 없어 이 명령을 끝낼 수 없다("No terminal is attached").
     그게 정상이다. 명령을 사용자에게 넘기고 멈춘다.
   - `product/config.yaml` 이 `attestation: flag` 일 때만 `--user-statement "<사용자
     발언 원문>"` 을 Agent 가 넘길 수 있고, 그 워크스페이스의 모든 검증 보고에
     경고가 붙는다. 그 줄을 Agent 가 바꾸지 않는다.
4. 동의하지 않으면 steps 를 고치고 1~3 을 반복한다. 이전 항목은 그대로 둔다.
   steps 가 바뀌면 이전 동의는 무효다(해시가 안 맞는다).

`interpretation_check` 항목을 손으로 조립해야 하는 경우(테스트 등)에만
`productkit hash steps` 와 `productkit hash entry --input <yaml>` 을 쓴다.

## 질문 조건

반례 검증에서 모호성을 발견했거나 구체화에 필요한 정보(주체·대상·조건·행동·
결과)가 원문에 없을 때 질문한다. "더 자세히 알려주세요" 같은 일반 질문은
하지 않는다 — 무엇이 불명확한지 말한다. 질문으로 남긴 것은 `finding_candidates`
에 남겨야 뒤 단계가 잊지 않는다.

## 완료

`productkit clarify` 가 "Clarification confirmed" 를 찍는 것만이 완료다. 그
출력은 기록이 무결하다는 뜻이지 사용자의 동의 자체를 증명하지는 않는다.
