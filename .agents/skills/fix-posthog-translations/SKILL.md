---
name: fix-posthog-translations
description: Bulk-fix wrong or missing Armenian vocabulary translations reported via the PostHog Open feedback survey. Use when the user asks to process translation-error feedback from PostHog, fix absent/wrong EN/RU glosses, or apply translation overrides from survey responses.
---

# Fix PostHog translation feedback

## When to use

User asks to process PostHog feedback of type **Translation error** (or Russian **ошибка перевода**), including bulk cleanup of many responses.

Do **not** use for app bugs, pronunciation-only reports, or UX suggestions — those belong in `triage-posthog-feedback` (and GitHub issues when deferred).

## Survey identity

- Survey name: Open feedback
- Survey ID: `019c053a-2fd8-0000-a68f-0ab1a0cb5df7`
- Choice question id: `a1cb5b0e-8230-45ee-9874-188f6ddeaf5f`
- Description question id: `bf28dca4-6711-4892-b4ba-b97c42458184`
- Translation choice labels: `Translation error (ошибка перевода)` (and older English-only variants)

Fetch rows with PostHog `surveys-responses-list` for that survey id. Prefer responses that include a non-empty description answer. Also read event/person context when present: `feedback_word`, `feedback_page_path`, `current_url` (browse word pages often encode the Armenian lemma).

## Delivery mechanism (repo)

1. Add or update an entry in `scripts/translation_overrides.json` keyed by the Armenian lemma (`am`).
2. Shape:

```json
{
  "տալ": {
    "en": ["to give", "to hand over", "to allot"],
    "ru": ["давать, дать", "отдавать, отдать", "золовка"],
    "note": "optional human rationale"
  }
}
```

3. **Maximum 5 meanings per language** (`en` and `ru` arrays each ≤ 5). Prefer the most common learner-facing senses; drop slang, grammar-form glosses, and rare senses when over the cap. `scripts/apply-translation-overrides.ts` truncates to 5 if an override exceeds it.
4. Apply without full dictionary rebuild:

```bash
bun run vocabulary-overrides-apply
bun run search-index-build
```

5. Full rebuilds also apply the same overrides via `scripts/build_vocabulary_v2.py` after CEFR leveling, so overrides survive `bun run vocabulary-build`.

6. Verify by checking `static/vocabulary.json` for the lemma. Run `bun run lint` and `bun run build` before declaring done.

Put the **primary learner-facing sense first** in `en` / `ru` arrays. Keep secondary senses when they are real (homographs/polysemy), rather than deleting them blindly — but never more than 5 per language.

## Bulk workflow

1. List translation-error responses from PostHog (filter on the choice answer; skip empty descriptions unless `feedback_word` / browse URL identifies the lemma).
2. Deduplicate by Armenian lemma.
3. Resolve correct EN + RU glosses (see lookup section below); trim each list to ≤ 5.
4. Write all overrides into `scripts/translation_overrides.json` in one edit.
5. Run apply + search-index-build once for the batch.
6. Summarize fixed lemmas vs skipped (with reason) for the user.

## Lookup sources (verified for agent use)

Probe words used when validating: `տալ` (common/polysemous), `գրադարան` (mid), `փռշտալ` (rarer). Prefer multi-sense dictionary results over single-gloss machine translation.

### Preferred order

1. **Local repo files (always first)**
   - Current app data: `static/vocabulary.json`
   - Russian StarDict extract: `scripts/tmp/armenian_russian.csv`
   - English kaikki cache: `scripts/tmp/kaikki_entries.json` → `english` map; raw senses in `vocabulary_sources/kaikki.org-dictionary-Armenian-words.jsonl`
   - Manual overrides already present: `scripts/translation_overrides.json`
2. **http://brrn.ru/ru/** (BaRaRaN, Armenian↔Russian, multi-sense)
   - Use **HTTP** (HTTPS fails: weak TLS cert).
   - Needs session cookie from `GET /ru/` plus `Referer: http://brrn.ru/ru/`.
   - Autocomplete: `POST /ru/search` with form field `mask=<lemma>` → JSON `{result:[{word,hash,...}]}`.
   - Card: `POST /ru/translate` with `hash=<hash from search>` → JSON with `cardhtml` (parse text from HTML).
   - May return a thin/empty card for some lemmas; fall through if so. Can require captcha under load — stop and ask the user if captcha appears.
3. **https://glosbe.com/hy/en/<lemma>** and **https://glosbe.com/hy/ru/<lemma>**
   - Multi-sense; works for common and rarer lemmas (tested through `փռշտալ`).
   - Rank listed dictionary senses above “automatic translations” / Google blocks on the same page.
4. **https://www.museum.am/glossary/display-armrus.php?action=search&word=<lemma>&type=full&method=1**
   - Armenian–Russian; good coverage (tested on all three probe words).
   - Often **very verbose** (many senses/examples). Use to confirm meaning; extract at most 5 learner glosses, do not dump the whole article into `en`/`ru` arrays.
   - Note the hyphenated script name `display-armrus.php` (not `displayarmrus.php`).
5. **https://www.armdict.com/dictionary/armenian-russian/<lemma>** (and `/dictionary/armenian-english/<lemma>` for EN)
   - Works for the probe set and returns useful multi-sense RU for `տալ`.
   - Coverage is uneven vs larger dictionaries; treat as supporting evidence, not sole authority when it disagrees with local/brrn/glosbe.

### Do not rely on these for agent lookups

| Source | Why skip |
| --- | --- |
| https://translate.yandex.com | Bot **captcha** wall; not usable from tools. |
| https://translate.google.com | SPA; typically **one** gloss; not suitable for sense selection. |
| https://www.polytranslator.com/dictionary/armenian-to-english/ | Static common-word table only; per-lemma paths **404**; query params do not run a real lookup. |

### Conflict / sense rules

- Prefer **multi-sense** sources (local kaikki + StarDict, brrn, Glosbe, museum, armdict) over MT one-liners.
- If EN (kaikki) and RU (StarDict) disagree on the *primary* sense, check brrn + Glosbe; put the learner-primary sense first in both languages and keep real secondary senses (**≤ 5**).
- Homographs (e.g. `տալ` = give **and** sister-in-law): keep both when space allows under the cap, primary first.
- If local pipeline missed a sense that dictionaries agree on, fix via override (do not wait for a full rebuild).
- If sources conflict and no clear primary sense emerges, ask the user rather than guessing.

Known pipeline facts:

- English glosses come from kaikki.org; Russian from StarDict.
- Builder historically **overwrote** English when multiple POS entries shared a lemma; merging is fixed in `build_vocabulary_v2.py`, but old cache may still be wrong — prefer overrides for reported words.

## Out of scope

- Inbox triage (fix-now vs GitHub issue) lives in `triage-posthog-feedback`.
- Changing CEFR levels or pronunciation audio unless the report is specifically about those.
