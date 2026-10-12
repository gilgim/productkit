# Design

## Context

현재 config는 schema_version=0이다. Change 02의 judgeCompletion은 확인/steps hash만, Change 03의 judgeNodeSetCompletion은 null final/steps source hash만 주로 검사했다. baseline 자동 테스트는 136/136 PASS였지만 빈 steps 확정을 정상 fixture로 사용했다. 세 결함의 재현/원인은 verification.md에 기록한다. 기존 명세 이력은 그대로 둔다.

## Goals / Non-Goals

Goals: 기존 6단계·원자성·출처 계약 복구, 잘못된 완료 전이 차단, 사용자 데이터 읽기 전용 재검증, 회귀 테스트.

Non-Goals: 새로운 Graph/Phase, schema_version 변경, 자동 artifact migration, 실제 사용자 동의 생성, 자연어 의미의 기계 증명, 기존 Skill/공식 문서 재작성.

## Decisions

### D1. Draft 파싱과 완료 Gate 분리

기존 optional/default 필드는 draft 편집/구버전 파일 읽기를 위해 유지한다. 완료는 별도 구조 규칙을 모두 통과해야 한다. 빈 정의/분해/구체화는 완료 불가다. 구체화 actor/object/condition/action/result와 statement가 substantive 문자열이어야 하며 decomposition의 statement를 정확히 참조하고 모든 항목을 덮어야 한다.

관계/반례는 항상 후보가 존재하는 단계가 아니다. 빈 배열만으로는 수행 여부를 알 수 없으므로 `steps.relation_check_no_items_reason`, `steps.counterexample_no_items_reason`을 추가한다. 후보가 없으면 반드시 비어 있지 않은 검토 이유가 있어야 한다. 후보와 no-items 주장을 함께 쓰면 오류다. 관계 후보는 서로 다른 두 decomposition statement를 참조한다. 반례에는 ambiguity와 2개 이상의 해석 문자열이 필요하다. AI의 “검토했으나 없음” 주장 진위는 CLI가 판단하지 못한다.

공백과 고정 placeholder(TBD/TODO/unknown/placeholder/N/A/null/undefined/미정/미작성/작성 예정/알 수 없음/해당 없음 및 점·물음표·대시만 있는 값)를 완료 산출물로 허용하지 않는다. 더 복잡한 무의미 문장을 감지한다고 주장하지 않는다. 적용 불가 내용은 짧은 placeholder 대신 실제 검토 이유를 기록한다. 미완료 draft의 빈 배열을 금지하면 정상 중단/재개가 깨지므로 schema 파싱 자체에서 min(1)을 일괄 적용하는 대안은 기각했다.

### D2. Prompt snapshot과 현재 원본 검증

Clarification에 `prompt_content_hash`를 추가하고, 새 interpretation_check에도 `prompt_ref`와 `prompt_content_hash`를 추가한다. 이 필드들은 과거 파일 파싱에는 optional, 완료에는 필수다. `presented_hash`는 기존처럼 steps의 canonical JSON SHA-256이고 새 no-items 필드도 포함한다. `entry_hash`는 entry_hash만 제외한 id 및 새 Prompt 필드를 포함한다.

`judgeCompletion(clarification, prompt?)`는 actual Prompt context가 없으면 fail-closed다. CLI는 실제 sources/PRM-*.yaml을 읽고 파일 ID/참조 대상과 raw hash 및 기존 결정적 segmentSpans 결과를 검사한다. decomposition/finding span_refs도 이 Prompt에서 해소되어야 한다. Confirmation ID/hash와 CLR의 Prompt binding이 모두 현재 원문을 가리켜야 완료다. 원문 hash와 span을 함께 다시 계산해도 기존 승인 snapshot과 다르면 차단한다.

새 intake는 여전히 append-only이고 신규 PRM을 과거 PRM의 자동 대체로 보지 않는다. 과거 승인 항목에 새 snapshot을 덧입히지 않는다. 누락/변경은 원문 대조 후 새 확인 라운드를 요구한다. CLI는 source/CLR/Nodes를 고치지 않는다.

### D3. NodeGroup의 full Clarification snapshot

기존 source_content_hash(steps hash)는 유지하고 `clarification_content_hash`를 추가한다. `clarificationContentHash()`는 저장 status만 제외한 현재 CLR 전체를 canonical JSON SHA-256으로 계산한다. 따라서 Prompt identity/hash, 현재 steps, finding 후보, 확인 이력의 변경도 재모델링을 요구한다.

`judgeNodeSetCompletion(group,currentSteps,source?)`의 source는 `{clarification,prompt}`다. 없거나 judgeCompletion이 통과하지 못하면 invalid_source다. group.clarification_ref와 현재 CLR ID 및 steps가 맞아야 하고 두 source hash가 모두 일치해야 한다. 기존 API 호출은 TypeScript에서 optional context로 호환되지만 context 생략 시 완료 불가다. 함수 변경은 fail-closed이며 릴리스 안내가 필요하다.

### D4. 최종 atomic Node와 분해 이력

최종 `nodes[]`는 모두 final=atomic이어야 하며 sub-verdict truth table도 일치해야 한다. null과 split_required를 차단한다. 단순히 final만 atomic으로 수정하면 mismatch로 차단한다. Node 내용과 판정은 CLI가 생성/수정하지 않는다.

실제 분해 시 기존 Node 원문/판정을 `retired_nodes[]`에 그대로 보존하고 새 ID의 자식 Node가 `split_from`을 가진다. retired Node는 여전히 split_required이어야 하며 truth table과 일치해야 한다. 각 retired Node에 적어도 2개의 직계 자식(최종 또는 다시 retired된 Node)이 필요하다. 자식의 CLR/index 출처는 부모와 동일해야 하고 ID 재사용·깨진 참조·self/cycle을 차단한다. 집합 내부 분해 출처이며 Content Graph Edge가 아니다.

이력은 검증 가능한 명시적 기록을 제공한다. 파일 전체와 모든 판정을 악의적으로 재작성하거나 과거 기록을 지우는 행위를 인증·방지하는 기능은 아니다. 임의 자연어 “분해 필요” 판정 변경의 의미적 정당성은 AI/사용자 검토 영역이다.

### D5. 커버리지와 의미 보존 검토

완료에는 비어 있지 않은 분해와 최종 Node 집합이 필요하다. 유효 출처 index를 가진 최종 Node만 coverage에 포함한다. Node/retired Node ID 중복, source origin의 빈 span 근거, finding의 존재하지 않는 node_ref를 차단한다.

모든 decomposition index에 정확히 1개의 distortion_check를 요구한다. 재합성 statement/reason, overall verdict=preserved와 condition_preservation/operator_preservation/exception_preservation의 `{verdict,reason}`이 있어야 한다. aspect verdict는 preserved 또는 이유가 있는 not_applicable만 허용하며 uncertain/distorted/누락은 완료 불가다. 최종 판정/열린 4종 위험신호/소스 stale 검사는 그대로 유지한다. 기록의 존재·형식만 검사하며 조건/연산자/예외가 실제로 보존됐다는 의미 증명은 아니다.

### D6. 호환성과 종료 코드

config version/stage 이름·init/intake 동작은 변경하지 않는다. clarify는 기존 진행 보고 규약대로 미완료=0, 유효한 요청 자체가 성립하지 않는 파일/ID 오류=2다. model은 미확정 source를 기존처럼 코드 2로 거부하고 NodeGroup needs_review는 진행 보고(0)로 남긴다. 따라서 코드 0을 완료 증거로 해석해서는 안 되며 출력 status를 봐야 한다. Change 08의 통합 Gate 종료 코드로 임의 변경하지 않는다.

기존 Skills는 이번 범위 밖이라 수정하지 않았다. CLI 초기 안내에 새 완료 계약을 표시하고 public helper clarificationContentHash를 export했다. 새 필드는 이 명세와 dist schema declaration에서 조회할 수 있다. 기존 Skill만 따르는 Agent는 재검토가 필요할 수 있으며 실제 Agent 통합은 잔여 검증 항목이다.

## Risks / Trade-offs

- 실제 발언/AI 분석 진위는 로컬 hash로 인증 불가; 합성 테스트 승인을 사용자 동의로 보고하지 않는다.
- legacy 완료 파일도 새 snapshot/review가 없으면 차단; 자동 보강하지 않고 새 검토를 요구한다.
- 구체화 exact statement 참조는 의미 동등한 다른 문구도 거부; 기존 문자열 기반 참조의 결정적 무결성을 우선한다.
- 의미 보존 기록은 현재 Node 내용과의 의미적 일치까지 검사하지 않는다. AI Review가 별도로 필요하다.
- 전체 파일을 읽은 뒤 외부 프로그램이 동시 수정하는 경우 일관된 다중 파일 transaction snapshot은 제공하지 않는다. 새 동시성 framework는 범위 밖이다.

## Migration Plan

config/기존 workspace의 자동 변환은 없다. 새 버전으로 읽을 때 누락된 snapshot/완료 근거를 차단하고, 원문 대조·새 명료화 확인·필요 시 재모델링으로 갱신한다. 과거 확인 기록/원본/분해 전 Node를 삭제하거나 자동 덮어쓰지 않는다. archive 순서 의존성은 proposal을 따르되 이번에 archive하지 않는다.
