#!/usr/bin/env bun
/**
 * Apply scripts/translation_overrides.json onto static/vocabulary.json
 * without a full vocabulary rebuild.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const OVERRIDES_FILE = join(ROOT, 'scripts/translation_overrides.json');
const VOCABULARY_FILE = join(ROOT, 'static/vocabulary.json');

/** Max glosses kept per language when applying overrides (also enforced in the skill). */
export const MAX_TRANSLATIONS_PER_LANGUAGE = 5;

interface WordEntry {
	am: string;
	en?: string[];
	ru?: string[];
	pos?: string;
	spell?: string;
	[key: string]: unknown;
}

interface OverrideEntry {
	en?: string[];
	ru?: string[];
	pos?: string;
	spell?: string;
	note?: string;
}

type LeveledVocabulary = Record<string, WordEntry[]>;

function normalizeArmenianWord(word: string): string {
	return word.toLowerCase();
}

function trimGlosses(glosses: string[] | undefined): string[] | undefined {
	if (!glosses) return undefined;
	return glosses.slice(0, MAX_TRANSLATIONS_PER_LANGUAGE);
}

export function loadTranslationOverrides(
	path: string = OVERRIDES_FILE
): Map<string, OverrideEntry> {
	if (!existsSync(path)) return new Map();
	const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, OverrideEntry>;
	const map = new Map<string, OverrideEntry>();
	for (const [key, value] of Object.entries(raw)) {
		map.set(normalizeArmenianWord(key), value);
	}
	return map;
}

export function applyTranslationOverrides(
	leveled: LeveledVocabulary,
	overrides: Map<string, OverrideEntry>
): number {
	if (overrides.size === 0) return 0;
	let updated = 0;
	for (const words of Object.values(leveled)) {
		if (!Array.isArray(words)) continue;
		for (const entry of words) {
			const override = overrides.get(normalizeArmenianWord(entry.am ?? ''));
			if (!override) continue;
			if (override.en) entry.en = trimGlosses(override.en);
			if (override.ru) entry.ru = trimGlosses(override.ru);
			if (override.pos) entry.pos = override.pos;
			if (override.spell) entry.spell = override.spell;
			updated += 1;
		}
	}
	return updated;
}

function main(): void {
	if (!existsSync(VOCABULARY_FILE)) {
		console.error(`Missing ${VOCABULARY_FILE}`);
		process.exit(1);
	}

	const overrides = loadTranslationOverrides();
	if (overrides.size === 0) {
		console.log(`No overrides in ${OVERRIDES_FILE}`);
		return;
	}

	const leveled = JSON.parse(readFileSync(VOCABULARY_FILE, 'utf-8')) as LeveledVocabulary;
	const updated = applyTranslationOverrides(leveled, overrides);
	writeFileSync(`${VOCABULARY_FILE}`, `${JSON.stringify(leveled, null, 1)}\n`, 'utf-8');

	console.log(`Updated ${updated} entr(y/ies) in ${VOCABULARY_FILE}`);
	console.log('Next: bun run search-index-build');
}

if (import.meta.main) {
	main();
}
