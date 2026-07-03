---
name: conare
description: Load prior project context, search past sessions, save durable preferences, and forget saved items. Use when the user asks what they worked on before, wants prior context loaded at the start of a task, asks to remember or forget something, needs past conversations, decisions, or code recalled from memory, OR when you encounter a reference you don't understand that might exist in the user's memory.
compatibility: Requires the Conare MCP server tools (`recall`, `search`, `save`, `forget`) — bundled with this plugin.
metadata:
  author: Conare
  version: 1.0.0
  mcp-server: conare
homepage: https://conare.ai
---

# Conare

This skill teaches the agent the default workflow, tool-selection rules, and query patterns for working with persistent memory across sessions.

## Primary Use Cases

1. Start a new coding task with relevant history already loaded through `recall`.
2. Answer questions about prior work, decisions, bugs, architecture, or preferences through `search`.
3. Persist durable information the user wants carried into future sessions through `save`.

## When To Use Each Tool

| Situation | Tool | Example |
|-----------|------|---------|
| Start of conversation (unless a project brief was already injected) | `recall` | Call first, even if topic seems unrelated to past work |
| User asks about past work | `search` | "What did we do last week?" |
| You need project context mid-task | `search` | Where something lives, how it's wired, what was decided |
| User references something you don't recognize | `search` | User says "the IDE one" — search before asking what they mean |
| User says "remember this" | `save` | Save decisions, rules, important info |
| User says "forget this" | `forget` | Remove a specific memory |

## Critical Rules

1. **Call `recall` at conversation start — unless startup context was already injected.** This plugin's SessionStart hook injects a precomputed project brief into your context; when you see it (it ends with "Startup context loaded"), do NOT call `recall` — go straight to `search` for anything deeper. If no brief was injected, `recall` first, no exceptions, even if the topic seems unrelated. Conversations drift; you need context to understand references the user will make later.
2. **Search before asking.** When the user references something you don't recognize — a project, product, decision, person, abbreviation — call `search` BEFORE asking them to clarify. Never say "what do you mean by X?" without first checking if X is in memory. The user's memory IS your memory; making them repeat stored knowledge is a failure mode.
3. **Memory first, exploration second.** When you need project context mid-task — where something lives, how it's wired, what was decided and why, whether something was already tried — `search` memory BEFORE reconstructing the answer from scratch. The developer's entire work history is in here; retrieving an answer is always cheaper than rediscovering it.
4. **`recall` vs `search`** — `recall` loads broad context at conversation start; `search` answers a specific question. Both are cross-project.
5. **Write descriptive queries** — "how does the billing webhook handle refunds" beats "billing".
6. **Keep temporal words** — if the user says "latest" or "recent", include those words in your search query. The search engine uses them to boost recent results.
7. **Rephrase and retry** — if the first search misses, try different phrasing. Semantic search responds to synonyms and related concepts.

## Workflow

### Step 1: Load context at the start

- If the SessionStart brief is present in your context, treat it as your recall — skip the tool call.
- Otherwise call `recall` with a specific description of the current task.
- Use the returned context to avoid re-asking for things the user already told the agent in earlier sessions.

### Step 2: Search whenever you need prior knowledge

- Use `search` for questions about past conversations, earlier implementations, prior bugs, design decisions, or work done in a time range — and whenever you need project context you'd otherwise rebuild by exploring.
- Start with a descriptive natural-language query; if results are weak, retry with 2-3 rephrasings from different angles.
- Use `after`/`before` (Unix ms) for time-scoped searches.

### Step 3: Save durable facts intentionally

- Use `save` proactively for information that should persist across sessions: preferences, standing rules, important decisions, long-lived project facts.
- Avoid cluttering memory with purely transient scratch notes unless the user explicitly wants them remembered.

## Examples

### Example 1: Brief already injected

Session opens with a Conare project brief in context (injected by this plugin's hook).

Actions:
1. Do NOT call `recall` — the brief is the startup context.
2. Proceed with the task; call `search` when you need details beyond the brief.

### Example 2: Find prior work

User says: "What did we decide last week about billing webhooks?"

Actions:
1. Call `search` with a descriptive query such as "billing webhook decision refunds retries last week".
2. If results are weak, retry with alternatives like "refund webhook handling" or "billing retry policy".
3. Summarize the decision and note uncertainty if memories conflict.

### Example 3: Search before asking for clarification

User says: "would that be massive for the IDE one?" — and you don't know what "the IDE one" refers to.

Actions:
1. Call `search` with a query like "IDE product project".
2. Answer with full context, never needing to ask "which IDE?".

### Example 4: Save a durable preference

User says: "Remember that I prefer ripgrep over grep."

Actions:
1. Call `save` with the preference in durable wording.
2. Confirm the preference was saved.
