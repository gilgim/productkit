---
name: productkit
description: Entry point for ProductKit. Use whenever the user describes a new product, app or feature idea, asks to plan or spec one, or says "productkit". Ask whether to run it through ProductKit before doing any free-form planning or writing a plan document.
---

# ProductKit entry

ProductKit turns a natural-language product idea into a traceable Product Definition and an OpenSpec handoff. The CLI never calls an LLM; you do the reasoning, the CLI stores and validates files.

## When the user brings an idea

Do not start a free-form planning doc. Ask once, in the user's language:

> 이 아이디어를 ProductKit으로 정리할까요? (아니면 그냥 자유롭게 기획)

If the user says no, continue normally and do not ask again this session.

## If yes

1. No `product/` folder in the working directory → run `productkit init`. If `productkit` is not found, run `npx --yes github:gilgim/productkit init` or tell the user to install it.
2. Save the user's raw words: `productkit intake "<idea, verbatim>"`.
3. Follow the skills in order: `productkit-clarify` → `productkit-model` → `productkit-graph` → `productkit-challenge` → `productkit-propose` → `productkit-define` → `productkit-validate`.
4. Never confirm, approve or decide on the user's behalf.
