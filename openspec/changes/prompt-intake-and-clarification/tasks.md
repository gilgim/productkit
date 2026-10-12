# Tasks

## 1. Prompt 데이터 계약과 공통 유틸

- [x] 1.1 `src/schema/prompt.ts`에 Zod로 Prompt schema(`id`, `raw_text`,
      `received_at`, `content_hash`, `spans`)를 정의하고 유효/무효 입력 단위
      테스트를 추가한다
- [x] 1.2 content_hash 계산 함수를 구현하고, 같은 `raw_text`가 항상 같은 hash를
      내는지 테스트한다
- [x] 1.3 `docs/artifact-contracts.md`의 Prompt 표와 실제 schema가 일치하는지
      대조한다
- [x] 1.4 `src/clarification/io.ts`(가칭)에 `atomicWriteFile(path, contents,
      {overwrite})` 유틸을 구현한다: 같은 디렉터리에 임시 파일을 쓰고 성공
      시에만 `rename()`으로 교체한다. 쓰기 중 실패를 주입해 대상 경로가
      그대로 남는지(신규 생성 시 안 생기고, 갱신 시 기존 내용 보존) 테스트한다
- [x] 1.5 원문을 문장/줄 단위로 나눠 `{id, start, end}` span 목록을 만드는
      `segmentSpans()`를 구현하고, 같은 입력에 항상 같은 span을 내는지(결정적)
      테스트한다

## 2. Clarification 데이터 계약

- [x] 2.1 `src/schema/clarification.ts`에 6단계(`definition`, `decomposition`,
      `elaboration`, `relation_check`, `counterexample`, `interpretation_check`)
      와 `status`, `finding_candidates` schema를 정의한다. `interpretation_check`는
      배열로 정의한다
- [x] 2.2 `definition[].origin`이 `user_stated | ai_inferred`만 허용하는지
      테스트한다
- [x] 2.3 `interpretation_check` 각 항목에 `presented_statement`,
      `presented_hash`, `user_response`, `user_statement`, `checked_at`,
      `entry_hash` 필드를 schema로 강제하고, 필수 필드 누락 시 거부되는지
      테스트한다
- [x] 2.4 `steps`(definition~counterexample)를 정규화(canonical JSON, 키 정렬)해
      SHA-256을 내는 `stepsContentHash()` 함수를 구현하고, 같은 내용이면 필드
      순서가 달라도 같은 해시가 나오는지 테스트한다
- [x] 2.5 최신 `interpretation_check` 항목이 ① `agreed` ② `user_statement`
      비어있지 않음 ③ 그 항목의 `presented_hash` == 현재 `steps`의
      `stepsContentHash()`를 모두 만족해야만 완료로 판정하는 `judgeCompletion()`
      함수를 구현하고, 세 조건을 하나씩 깨뜨린 3가지 반례로 테스트한다. 이
      함수는 파일에 적힌 `status` 값을 읽지 않고 매번 다시 계산한다
- [x] 2.6 `interpretation_check` 목록이 비어 있는 상태에서 완료로 판정하지
      않는지 테스트한다
- [x] 2.7 **확정 이후 `steps`가 수정되면** `presented_hash`와 현재
      `stepsContentHash()`가 달라져 완료 판정이 거부되는지 테스트한다(파일의
      `status`가 여전히 `confirmed`로 적혀 있어도 거부돼야 함 — 승인 조건
      1·4번 반례)
- [x] 2.8 `entry_hash`를 항목 나머지 필드로부터 계산하는 함수를 구현하고,
      과거 항목 하나의 필드를 임의로 바꾼 입력에 대해 `entry_hash` 불일치가
      탐지되는지 테스트한다(기록 변조 탐지 — presented_hash 불일치와는 다른
      사유로 보고되는지 확인)

## 3. `productkit intake`

- [x] 3.1 `src/cli/commands/intake.ts`에 `<text>` 인자와 `--file <path>` 옵션을
      구현하고, `product/sources/`에 Prompt 레코드를 생성하는지 테스트한다
- [x] 3.2 같은 세션에서 다시 `intake`를 실행하면 기존 레코드를 덮어쓰지 않고
      새 ID로 추가되는지 테스트한다(append-only)
- [x] 3.3 `product/`가 아직 초기화되지 않은 디렉터리에서 실행하면 이해 가능한
      오류와 종료 코드 `2`로 끝나는지 테스트한다
- [x] 3.4 `product/sources/` 쓰기 중 실패가 발생하면 손상된 부분 파일 없이
      오류와 종료 코드 `2`를 보고하는지 테스트한다

## 4. `productkit clarify`와 Skill instruction

- [x] 4.1 `skills/clarify/SKILL.md`를 작성한다: 목적 / 입력 파일 / 출력 파일 /
      필수 필드 / 금지 행동(추측 금지, Graph edge 확정 금지) / 질문 조건 /
      완료 조건 / 후속 검증 방법 / **진입 조건과 실패 시 대안**(CLI 미설치,
      workspace 미초기화, Prompt 없음일 때 할 일)을 명시한다
- [x] 4.2 `src/cli/commands/clarify.ts`에 입력(Prompt) 존재 확인, instruction과
      경로 안내, 출력 schema 계약 안내를 구현하고, CLI가 6단계 내용을 직접
      생성하지 않는지(= 해당 로직이 존재하지 않는지) 코드로 확인한다
- [x] 4.3 Clarification artifact가 아직 없는 상태에서 `clarify`를 실행하면
      "AI 작업 필요"로 안내하고 완료로 표시하지 않는지 테스트한다
- [x] 4.4 `product/`가 없는 상태에서 `clarify`를 실행하면 `productkit init`을
      먼저 하라는 안내와 종료 코드 `2`로 끝나는지 테스트한다
- [x] 4.5 Prompt가 하나도 없는 상태에서 `clarify`를 실행하면 `productkit
      intake`를 먼저 하라는 안내와 종료 코드 `2`로 끝나는지 테스트한다
- [x] 4.6 `productkit clarify --help`(또는 README)에 Claude Code `.claude/
      skills/`에 수동으로 연결하는 방법을 안내 문구로 넣는다(쓰기는 하지
      않음을 코드로 확인 — `init`/`clarify`가 `product/` 밖에 쓰지 않는
      기존 테스트가 깨지지 않는지 재확인)

## 5. 완료 판정(해석확인 게이트)과 기록 무결성

- [x] 5.1 CLI가 Clarification artifact 파일을 직접 읽어 최신
      `interpretation_check` 항목의 `user_response`·해시 일치·`user_statement`
      존재를 확인하는 판정 함수를 구현하고, 셋 다 만족할 때만 완료로 판정하는지
      테스트한다
- [x] 5.2 AI가 작성한 artifact의 `status`가 `confirmed`로 쓰여 있어도 위 세
      조건 중 하나라도 깨지면 CLI 판정이 완료를 거부하는지 테스트한다(AI
      선언과 CLI 판정의 불일치 케이스)
- [x] 5.3 `user_response: disagreed`인 경우 관련 단계가 재작업 가능한 상태로
      남는지 테스트한다
- [x] 5.4 CLI가 매 판정 시 모든 `interpretation_check` 항목의 `entry_hash`를
      재계산해 변조를 탐지하는지, 변조 발견 시 "기록 무결성 위반"으로 명확히
      구분해 보고하는지(해석 불일치와 다른 메시지인지) 테스트한다
- [x] 5.5 CLI 출력 문구(또는 관련 문서)에 "이 판정은 기록 무결성만 확인하며
      발언의 진위는 확인하지 않는다"는 한계가 포함되는지 확인한다

## 6. 진입 흐름과 stage 호환성

- [x] 6.1 `intake`/`clarify`가 `product/config.yaml`의 `stages.ingest`,
      `stages.discover` 외의 어떤 stage 키도 읽거나 쓰지 않는지 테스트한다
- [x] 6.2 `schema_version`이 이 change의 실행으로 바뀌지 않는지 테스트한다
- [x] 6.3 design.md D8의 stage 키 대응표와 실제 코드가 쓰는 키가 일치하는지
      대조한다 — `markStage()`의 타입 시그니처가 `'ingest' | 'discover'`만
      받도록 제한돼 있어, 다른 키를 쓰려는 코드는 컴파일 자체가 안 된다

## 7. 재실행·중단 후 재개

- [x] 7.1 6단계 중 일부만 기록된 Clarification artifact를 입력으로 `clarify`를
      다시 실행하면, 이미 기록된 단계를 요구하지 않고 이어서 진행 안내를
      하는지 테스트한다
- [x] 7.2 이미 `confirmed`된 Clarification에 대해 `clarify`를 다시 실행하면
      기존 내용을 덮어쓰지 않고 "이미 완료됨"으로 보고하는지 테스트한다
- [x] 7.3 Finding 후보(`finding_candidates`)가 중단 전후로 유실되지 않는지
      테스트한다

## 8. 패키징과 문서

- [ ] 8.1 `tests/fixtures/`에 정상/모호성 있는 프롬프트 합성 시나리오를
      추가한다 — **범위 변경**: 저장소에 `tests/fixtures/` 관례가 아직 없어
      (Canvas 전용으로 계획됐던 디렉터리, 한 번도 생긴 적 없음), 대신 각
      테스트 파일 안에 직접 시나리오를 구성했다(`buildEntry`/`writeClarification`
      헬퍼). 별도 fixture 파일이 꼭 필요해지면 그때 추가한다
- [x] 8.2 `README.md`의 "지금 동작하는 것" 표에 `intake`/`clarify`를 추가하고
      "아직 동작하지 않는 것" 표에서 제거한다
- [x] 8.3 `docs/roadmap.md`의 Change 02 상태를 "명세 준비됨"에서 "구현됨"으로
      갱신한다(이 change의 Apply 완료 후)

## 9. 통합 검증

- [x] 9.1 `npm run build && npm test`가 모두 통과하는지 확인한다
- [x] 9.2 `npx openspec validate prompt-intake-and-clarification --strict`가
      통과하는지 확인한다
- [x] 9.3 실제로 `productkit intake` → `productkit clarify` → (AI가 artifact
      작성) → 재실행 순서로 한 번 수동 실행해 README에 쓴 설명과 실제 동작이
      일치하는지 대조한다 — 확정, 확정 후 내용 변경(무효화), 기록 변조 3개
      시나리오까지 추가로 수동 검증했다
- [x] 9.4 `npm pack`으로 실제 설치 가능한 패키지를 만들어 저장소 밖 소비자
      앱에 설치하고, `skills/clarify/SKILL.md`에 적힌 명령을 글자 그대로
      실행해 본다 — 이 과정에서 `require('yaml')` 직접 의존 문제를 발견해
      `stepsContentHashFromYaml()`로 교체했다(design.md "Integration Testing
      Notes" 참고)
