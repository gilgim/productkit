# Tasks

## 1. 프로젝트 설정

- [x] 1.1 `package.json`에 ESM 설정, `bin: productkit`, `files`, 빌드/테스트 스크립트를
      작성하고 `npm run build`가 성공하는지 확인한다
- [x] 1.2 `tsconfig.json`을 추가하고 `npx tsc --noEmit`이 오류 없이 끝나는지 확인한다
- [x] 1.3 `commander`, `zod`, `yaml`과 개발 의존성 `typescript`, `vitest`,
      `@fission-ai/openspec`를 설치하고 `npm ls`로 설치를 확인한다

## 2. 원칙과 설계 문서

- [x] 2.1 `CONSTITUTION.md`에 10개 원칙을 작성하고 각 원칙이 roadmap의 Change와
      연결되는지 확인한다
- [x] 2.2 `docs/architecture.md`에 v0 전체 설계(역할 분리, 저장 구조, Gate, 종료 코드)를
      작성한다
- [x] 2.3 `docs/artifact-contracts.md`에 Source/Discovery/Finding/Proposal/Decision/
      Assumption/Definition/Review 필드 계약을 작성하고, 구현된 것과 계획을 구분해
      표시한다
- [x] 2.4 `docs/roadmap.md`에 Change 02~08의 범위와 완료 조건을 기록하고 Change 01만
      구현됨으로 표시한다

## 3. CLI 기반

- [x] 3.1 `src/errors.ts`에 종료 코드 상수와 `CliError`를 구현하고 단위 테스트로 코드
      값(0/1/2)을 고정한다
- [x] 3.2 `src/version.ts`에서 패키지 버전을 읽고, 테스트로 `package.json`의 값과
      일치하는지 확인한다
- [x] 3.3 `src/cli/program.ts`에 Commander 프로그램을 구성하고 `--help`, `--version`
      출력과 종료 코드 `0`을 테스트한다
- [x] 3.4 `src/cli/bin.ts`에 shebang 진입점을 두고 알 수 없는 명령·옵션이 종료 코드 `2`를
      반환하는지 테스트한다
- [x] 3.5 미구현 명령(`discover` 등)이 도움말에 없고 실행 시 `2`로 끝나는지 테스트한다

## 4. config schema

- [x] 4.1 `src/schema/config.ts`에 Zod로 `config.yaml` schema를 정의하고 유효/무효
      입력에 대한 단위 테스트를 추가한다
- [x] 4.2 단계 상태 기본값이 `not_started`이고 READY/PASS 값을 허용하지 않는지 테스트로
      확인한다
- [x] 4.3 `docs/artifact-contracts.md`의 config 표가 실제 schema와 일치하는지 대조한다

## 5. 템플릿과 workspace 계획

- [x] 5.1 `templates/product/`에 `config.yaml`, `constitution.md`, `overview.md`와 9개
      artifact 디렉터리 안내 문서를 작성한다
- [x] 5.2 `src/workspace/templates.ts`에 템플릿 경로 해석과 `{{key}}` 치환을 구현하고,
      알 수 없는 키가 남으면 오류가 나는지 테스트한다
- [x] 5.3 `src/workspace/plan.ts`에 생성 대상 경로 목록을 명시적으로 선언하고, 생성 경로
      집합을 고정하는 테스트를 추가한다

## 6. init 명령

- [x] 6.1 `src/workspace/scaffold.ts`에 plan → conflict check → write 3단계를 구현하고
      충돌 시 아무 파일도 쓰지 않는지 테스트한다
- [x] 6.2 `src/cli/commands/init.ts`에 명령을 연결하고 빈 디렉터리 초기화가 종료 코드
      `0`으로 끝나는지 테스트한다
- [x] 6.3 재실행 시 기존 파일 내용이 보존되고 건너뜀으로 보고되는지 테스트한다
- [x] 6.4 일부 파일만 있는 workspace에서 누락 파일만 생성되는지 테스트한다
- [x] 6.5 공백이 포함된 경로와 경로 생략(현재 디렉터리)이 동작하는지 테스트한다
- [x] 6.6 파일/디렉터리 자리 충돌과 쓰기 실패가 이해 가능한 메시지와 종료 코드 `2`로
      보고되는지 테스트한다
- [x] 6.7 생성된 `config.yaml`이 config schema 검증을 통과하고 모든 상태가
      `not_started`인지 테스트한다
- [x] 6.8 `product/` 밖의 `CLAUDE.md`, `openspec/`이 변경되지 않는지 테스트한다

## 7. 패키징과 문서

- [x] 7.1 `npm pack` 결과 tarball에 `dist/`와 `templates/`가 포함되는지 테스트한다
- [x] 7.2 tarball을 임시 디렉터리에 설치해 저장소 밖에서 `productkit init`이 동작하는지
      확인한다
- [x] 7.3 `README.md`에 설치·빌드·초기화 방법과 현재 구현 범위를 쓰고, 미구현 기능을
      계획으로 명확히 구분한다

## 8. 통합 검증

- [x] 8.1 `npm run build && npm test`가 모두 통과하는지 확인한다
- [x] 8.2 `npx openspec validate bootstrap-product-discovery-workflow --strict`가 통과하는지
      확인한다
- [x] 8.3 tasks/specs에 적힌 동작과 실제 CLI 출력이 일치하는지 수동으로 한 번 실행해
      대조한다
