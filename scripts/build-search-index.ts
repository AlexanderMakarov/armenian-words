#!/usr/bin/env bun
/**
 * Build search index for vocabulary
 *
 * Creates a compact sorted array index for multi-language vocabulary search.
 * Supports searching by: Armenian (am), English (en), Russian (ru), pronunciation (spell)
 *
 * Binary Format (v3 - sorted array):
 * [Header] (9 bytes)
 *   - magic (4): "SIDX"
 *   - version (1): 1
 *   - entry_count (4): number of entries
 *
 * [Entries] (sorted by key, variable length)
 *   For each entry:
 *     - key_length (1): length of search key in bytes (UTF-8)
 *     - key_bytes (variable): UTF-8 encoded lowercase search key
 *     - word_index (2): index into flattened vocabulary
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAGIC = 'SIDX';
const VERSION = 1;

interface Word {
	am: string;
	ru: string[];
	en: string[];
	spell?: string;
}

interface Vocabulary {
	[level: string]: Word[];
}

interface SearchEntry {
	key: string; // lowercase search key
	wordIndex: number; // index into flattened vocabulary
}

function buildEntries(vocabulary: Vocabulary): SearchEntry[] {
	const entries: SearchEntry[] = [];
	let wordIndex = 0;

	// Flatten vocabulary in sorted level order
	const levels = Object.keys(vocabulary).sort();

	for (const level of levels) {
		const words = vocabulary[level];
		for (const word of words) {
			// Index Armenian word
			if (word.am) {
				entries.push({ key: word.am.toLowerCase(), wordIndex });
			}

			// Index pronunciation
			if (word.spell) {
				entries.push({ key: word.spell.toLowerCase(), wordIndex });
			}

			// Index English translations (strip "to " prefix from verbs)
			for (const en of word.en || []) {
				let key = en.toLowerCase();
				if (key.startsWith('to ')) {
					key = key.slice(3);
				}
				entries.push({ key, wordIndex });
			}

			// Index Russian translations
			for (const ru of word.ru || []) {
				entries.push({ key: ru.toLowerCase(), wordIndex });
			}

			wordIndex++;
		}
	}

	// Sort entries by key for binary search
	// Use simple string comparison (not localeCompare) for consistent binary search
	entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

	return entries;
}

function serializeEntries(entries: SearchEntry[]): Buffer {
	// Calculate total size
	let totalSize = 9; // header
	for (const entry of entries) {
		const keyBytes = Buffer.from(entry.key, 'utf-8');
		totalSize += 1 + keyBytes.length + 2; // key_length + key_bytes + word_index
	}

	const buffer = Buffer.alloc(totalSize);
	let offset = 0;

	// Write header
	buffer.write(MAGIC, offset, 4, 'ascii');
	offset += 4;
	buffer.writeUInt8(VERSION, offset);
	offset += 1;
	buffer.writeUInt32LE(entries.length, offset);
	offset += 4;

	// Write entries
	for (const entry of entries) {
		const keyBytes = Buffer.from(entry.key, 'utf-8');

		// Key length (1 byte - max 255 bytes per key)
		if (keyBytes.length > 255) {
			console.warn(`Key too long (${keyBytes.length} bytes), truncating: ${entry.key}`);
			const truncated = entry.key.substring(0, 80); // ~80 chars should be under 255 bytes
			const truncatedBytes = Buffer.from(truncated, 'utf-8');
			buffer.writeUInt8(truncatedBytes.length, offset);
			offset += 1;
			truncatedBytes.copy(buffer, offset);
			offset += truncatedBytes.length;
		} else {
			buffer.writeUInt8(keyBytes.length, offset);
			offset += 1;
			keyBytes.copy(buffer, offset);
			offset += keyBytes.length;
		}

		// Word index (2 bytes)
		buffer.writeUInt16LE(entry.wordIndex, offset);
		offset += 2;
	}

	return buffer.slice(0, offset);
}

function main() {
	const projectRoot = join(import.meta.dir, '..');
	const vocabPath = join(projectRoot, 'static', 'vocabulary.json');
	const outputPath = join(projectRoot, 'static', 'search-index.bin');

	console.log('Building search index (v3 - sorted array)...\n');

	// Load vocabulary
	console.log(`Loading vocabulary from ${vocabPath}`);
	const vocabJson = readFileSync(vocabPath, 'utf-8');
	const vocabulary: Vocabulary = JSON.parse(vocabJson);

	// Count words per level
	let totalWords = 0;
	for (const [level, words] of Object.entries(vocabulary)) {
		console.log(`  ${level}: ${words.length} words`);
		totalWords += words.length;
	}
	console.log(`  Total: ${totalWords} words\n`);

	// Build entries
	console.log('Building search entries...');
	const entries = buildEntries(vocabulary);
	console.log(`  Created ${entries.length} searchable entries`);

	// Serialize
	console.log('\nSerializing to binary...');
	const buffer = serializeEntries(entries);

	// Write output
	writeFileSync(outputPath, buffer);

	// Statistics
	const stats = statSync(outputPath);
	console.log('\n=== Statistics ===');
	console.log(`Words indexed: ${totalWords}`);
	console.log(`Search entries: ${entries.length}`);
	console.log(`File size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
	console.log(`Output: ${outputPath}`);
}

main();
