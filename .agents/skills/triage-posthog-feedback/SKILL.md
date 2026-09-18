---
name: triage-posthog-feedback
description: Triage PostHog Open feedback survey responses into fix-now vs GitHub-issue-later buckets. Use when the user asks to review new PostHog feedback, triage survey responses, decide what to fix immediately vs file as issues, or process the Open feedback survey inbox.
---

# Triage PostHog feedback

## When to use

User asks to look at new/recent PostHog feedback, triage survey responses, or decide what to fix now vs track later.

## Survey identity

- Survey name: Open feedback
- Survey ID: `019c053a-2fd8-0000-a68f-0ab1a0cb5df7`
- Choice question id: `a1cb5b0e-8230-45ee-9874-188f6ddeaf5f`
- Description question id: `bf28dca4-6711-4892-b4ba-b97c42458184`
- Choices: Translation error / Pronunciation issue / App bug / Suggestion for improvement (RU labels may appear alongside)

Fetch with PostHog `surveys-responses-list`. Prefer rows with a non-empty description. Use `feedback_word`, `feedback_page_path`, `current_url`, device/browser when present. Ignore incomplete choice-only rows unless context alone identifies a clear actionable item. Skip noise from browser extensions (e.g. `moz-extension://…/content.js` console errors).

Also skim open GitHub issues (`gh issue list`) so you do not file duplicates.

## Buckets (follow exactly)

### Fix right now

- Any types of translation issues or pronunciation issues (Should be handled with `/fix-posthog-translations`)
- Small UI issues like unclear text or button overflow, text overflow, etc.
- Console error or just logical Errors on the page.

### Create a GitHub issue

- All enhancements and features, fixes which require some planning, tradeoffs to Consider before implementing or just require Big effort to fix.

## Triage workflow

1. List recent survey responses (newest first). Deduplicate near-identical reports.
2. For each actionable item, assign **Fix right now** or **Create a GitHub issue** using the buckets above.
3. Present a short triage table to the user (id/date, type, summary, bucket, suggested action). Ask which fix-now items to start with if several.
4. **Fix right now**
   - Translation or pronunciation → invoke skill `fix-posthog-translations` (do not invent glosses outside that skill).
   - Small UI / console / logical page errors → investigate root cause, implement the minimal fix, run `bun run lint` and `bun run build`.
5. **Create a GitHub issue**
   - Use `gh issue create` with a clear title, PostHog source date/type, user wording, URL/context, and acceptance criteria.
   - Do not start large feature work in the same turn unless the user explicitly asks to implement after filing.

## Ambiguity

- If a report mixes a small bug with a large enhancement, split: fix the small part now (or note it), file the enhancement.
- If effort/planning need is unclear, ask once; default to **Create a GitHub issue** when a change would need product tradeoffs.
- Extension-only console noise → skip (not an app bug).

## Out of scope

- Deep translation lookup rules live in `fix-posthog-translations`, not here.
- Do not close or archive PostHog responses unless the user asks.
