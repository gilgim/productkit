<div align="center">

# ProductKit

**한 줄짜리 아이디어를, 모든 결정에 근거 영수증이 붙은 Product Definition으로.**

Claude Code·Codex와 함께 쓰는 로컬 CLI + Agent Skills. AI가 묻고, 반박하고, 제안한다. 결정은 사람이 한다. ProductKit은 누가 무엇을 왜 결정했는지 기록한다.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.19-339933.svg)](https://nodejs.org)
[![Release](https://img.shields.io/github/v/tag/gilgim/productkit?label=release)](https://github.com/gilgim/productkit/tags)

[English](README.md) · 한국어

</div>

---

## 왜 만들었나

AI에게 "러닝 기록 공유 앱 만들어줘"라고 하면 빈칸을 전부 그럴듯하게 채워 준다. 몇 주 뒤에는 어떤 동작이 결정이었고 어떤 게 추측이었는지 아무도 모른다.

ProductKit은 아이디어와 명세 사이에 안전장치를 둔다.

- **AI의 추측은 결정이 되지 않는다.** `DEC-xxx`는 사용자가 근거와 함께 직접 말했을 때만 생긴다.
- **모르는 건 보이게 남긴다.** AI가 풀 수 없는 건 요구사항을 지어내지 않고 `FND-xxx` Finding과 질문으로 남는다.
- **양방향으로 추적된다.** Definition → Decision → Prompt 로 거슬러 올라가고, 반대로 원문의 모든 문장은 분해되거나, 질문으로 남거나, "요구사항 아님"으로 이유와 함께 사용자 동의를 받는다. 모든 Node는 Definition·기록된 제외·미해결 Finding 중 한 곳에 들어간다. 조용히 사라지는 건 없다 — 사라진 게 있으면 게이트가 이름을 댄다.
- **승인은 낡는다.** 승인 뒤에 입력이 바뀌면 승인이 무효가 된다.
- **CLI 안에 LLM이 없다.** CLI는 파일·스키마·검증만 맡는다. 추론은 쓰고 있는 Claude Code나 Codex 세션에서 일어나므로 별도 API 키도, 숨은 모델 호출도 없다.

## 동작 방식

<p align="center"><img src="docs/assets/how-it-works.ko.svg" alt="ProductKit 동작 방식: 사람이 결정하고, 에이전트가 추론하고, CLI가 판정·기록한다" width="100%"></p>

각 단계가 정말 끝났는지는 CLI가 판정한다. 에이전트가 스스로 완료를 선언할 수 없다.

## 빠른 시작

Node.js 20.19 이상과 Git이 필요하다.

```bash
npm install --global "git+https://github.com/gilgim/productkit.git#v0.1.0-beta.1"
productkit --version        # 0.1.0-beta.1
```

> npm 레지스트리의 `productkit` 이름은 다른 프로젝트가 쓰고 있어서, 위처럼 GitHub 태그로 설치한다.

앱 폴더 안에 workspace를 만들고 아이디어를 넣는다.

```bash
cd ~/projects/my-app
productkit init
productkit intake "친구들과 러닝 기록을 공유하는 앱을 만들고 싶다"
productkit clarify
```

`clarify`는 내용을 대신 써 주지 않는다. 에이전트가 다음에 할 일을 알려 준다.

```text
Prompt saved: PRM-001
  product/sources/PRM-001.yaml

AI action required: Clarification has not started.
  Prompt:      product/sources/PRM-001.yaml
  Instruction: skills/clarify/SKILL.md
  Write to:    product/discovery/CLR-001.yaml
  Bind prompt_ref + prompt_content_hash in the clarification and new confirmation; do not invent user agreement.
```

일이 실제로 끝나기 전에는 게이트가 통과하지 않는다.

```text
$ productkit validate
PRODUCT READINESS BLOCKED
FAIL definition.required: Product Definition is missing.
```

따로 연결할 게 없다. `productkit init` 이 Skill 을 `.claude/skills/` 와
`.agents/skills/` 에 같이 써 준다. 그 폴더에서 Claude Code·Codex 를 다시 켜면
바로 잡힌다(원치 않으면 `--no-skills`, [설치 가이드](docs/installation.md)).

Claude Code에서 `/productkit-clarify`라고 말하고 질문에 답한다. 정의가 승인되면 내보낸다.

```bash
productkit export openspec --change <change-id> --capability <capability-id>
```

`export openspec`은 workspace에 OpenSpec CLI가 설치돼 있어야 한다. [설치 가이드](docs/installation.md#productkit-and-openspec)를 본다.

## 만들어지는 것

`productkit init`은 파일 기반 workspace를 만든다. Markdown과 YAML이라 diff와 PR 리뷰가 된다.

```text
product/
├── sources/      프롬프트 원문(수정 없이 보존)
├── discovery/    명료화: 누가·무엇을·왜·흐름
├── nodes/        원자적 요구사항
├── graph/        관계와 영향 분석
├── findings/     허점·가정·모순
├── proposals/    이점·비용·위험이 함께 적힌 대안
├── decisions/    사용자의 명시적 결정 + 근거
├── journeys/  policies/  assumptions/
├── validations/  semantic-reviews/  approvals/
└── exports/      OpenSpec export manifest
```

## 원칙

ProductKit은 11개 원칙을 지킨다([CONSTITUTION.md](CONSTITUTION.md)). 핵심은 다음과 같다.

1. AI 추론을 사용자 결정으로 기록하지 않는다.
2. 불명확한 사항은 추측하지 않고 Finding으로 남긴다.
3. 모든 결정에는 근거가 있다.
4. 모든 정의 항목은 원본 프롬프트까지 추적된다.
5. 원문의 모든 절은 포함되거나, 결정으로 제외되거나, 미해결 Finding으로 남는다. 조용히 사라지는 절은 없다.
6. 대안은 이점·비용·위험을 함께 보여 준다.
7. 해결되지 않은 Critical Finding이 있으면 Definition을 확정하지 않는다.
8. Product Definition과 구현 명세를 분리한다. DB 스키마나 API를 지어내지 않는다.

## 한계

- **v0 beta**다. 구조(파일·스키마·게이트·해시)는 자동 테스트 270개로 검증한다. 한때 READY까지 뚫렸던 공격을 그대로 옮긴 회귀 테스트가 포함돼 있다.
- 검증 통과는 **구조**가 맞다는 뜻이지 제품이 옳다는 보증이 아니다. 의미의 품질은 에이전트와 사람에게 달려 있다.
- coverage 게이트는 **빠짐**을 잡지 **틀림**을 잡지 않는다. 문장을 엉뚱한 이유로 "요구사항 아님"이라 적거나, Definition 항목이 원문 Node와 반대로 말해도 CLI는 모른다. export에 원문 Node 문장을 항목 옆에 같이 찍어 줄 뿐이다. 그 대조는 사람이 읽어야 한다.
- 검토 기록은 증거를 인용해야 검토로 치지만, 그 증거가 그 영역에 맞는 증거인지는 CLI가 판단 못 한다. "뭔가 인용했다"는 바닥선이지 기준이 아니다.
- CLI는 확인·승인을 누가 입력했는지 인증하지 못한다. 실제 사람이 말한 뒤에만 결정과 승인을 기록한다.

## 문서

| | |
|---|---|
| [CLI 레퍼런스](docs/cli.md) | 모든 명령·옵션·종료 코드 |
| [아키텍처](docs/architecture.md) | 역할 분리, 저장 구조, 게이트 |
| [Artifact 계약](docs/artifact-contracts.md) | 필드 단위 스키마 |
| [설치 가이드](docs/installation.md) | 태그 고정 설치, Skill, OpenSpec |
| [로드맵](docs/roadmap.md) | Change 01~09 |

## 개발

```bash
git clone https://github.com/gilgim/productkit.git && cd productkit
npm install && npm run build
npm test
```

이슈와 PR을 환영한다. ProductKit 자체의 개발은 OpenSpec(`openspec/changes/`)으로 관리한다.

## 라이선스

[MIT](LICENSE)
