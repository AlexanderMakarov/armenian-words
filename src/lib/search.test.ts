import { beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSearchIndex, type SearchIndex, searchIndex, validateSearchIndex } from './search';

const SEARCH_INDEX_PATH = join(import.meta.dir, '../../static/search-index.bin');
const VOCABULARY_PATH = join(import.meta.dir, '../../static/vocabulary.json');

interface Word {
    am: string;
    ru: string[];
    en: string[];
    spell?: string;
}

interface Vocabulary {
    [level: string]: Word[];
}

describe('Search Index', () => {
    let indexBuffer: ArrayBuffer;
    let index: SearchIndex;
    let vocabulary: Vocabulary;
    let flatWords: Word[];

    beforeAll(() => {
        // Load the actual search index
        const buffer = readFileSync(SEARCH_INDEX_PATH);
        indexBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        // Load vocabulary for verification
        const vocabJson = readFileSync(VOCABULARY_PATH, 'utf-8');
        vocabulary = JSON.parse(vocabJson);

        // Flatten vocabulary in sorted level order (same as build script)
        flatWords = [];
        const levels = Object.keys(vocabulary).sort();
        for (const level of levels) {
            flatWords.push(...vocabulary[level]);
        }

        index = parseSearchIndex(indexBuffer);
    });

    describe('Index Validation', () => {
        test('search-index.bin exists and is readable', () => {
            expect(indexBuffer.byteLength).toBeGreaterThan(0);
        });

        test('has valid magic header', () => {
            const view = new DataView(indexBuffer);
            const magic = String.fromCharCode(
                view.getUint8(0),
                view.getUint8(1),
                view.getUint8(2),
                view.getUint8(3)
            );
            expect(magic).toBe('TRIE');
        });

        test('has valid version', () => {
            const view = new DataView(indexBuffer);
            const version = view.getUint8(4);
            expect(version).toBe(1);
        });

        test('passes full integrity validation', () => {
            expect(() => validateSearchIndex(indexBuffer)).not.toThrow();
            expect(validateSearchIndex(indexBuffer)).toBe(true);
        });

        test('node count is reasonable', () => {
            expect(index.nodeCount).toBeGreaterThan(0);
            // Should have at least some nodes for each word
            expect(index.nodeCount).toBeGreaterThan(flatWords.length);
        });

        test('results count matches expected range', () => {
            // Each word can be indexed multiple times (am, spell, en[], ru[])
            // So resultsCount should be >= flatWords.length
            expect(index.resultsCount).toBeGreaterThanOrEqual(flatWords.length);
        });
    });

    describe('Search Functionality', () => {
        test('empty query returns empty results', () => {
            const results = searchIndex(index, '');
            expect(results).toEqual([]);
        });

        test('non-matching query returns empty results', () => {
            const results = searchIndex(index, 'xyznonexistent123');
            expect(results).toEqual([]);
        });

        test('search is case-insensitive', () => {
            // Find a word with English translation to test
            const wordWithEnglish = flatWords.find((w) => w.en && w.en.length > 0);
            if (wordWithEnglish) {
                const enWord = wordWithEnglish.en[0];
                const lowerResults = searchIndex(index, enWord.toLowerCase());
                const upperResults = searchIndex(index, enWord.toUpperCase());
                const mixedResults = searchIndex(
                    index,
                    enWord.charAt(0).toUpperCase() + enWord.slice(1).toLowerCase()
                );

                expect(lowerResults).toEqual(upperResults);
                expect(lowerResults).toEqual(mixedResults);
            }
        });

        test('can search by Armenian word', () => {
            // Use the first Armenian word in vocabulary
            const firstWord = flatWords[0];
            const results = searchIndex(index, firstWord.am);

            expect(results.length).toBeGreaterThan(0);
            // The result should include index 0 (the first word)
            expect(results).toContain(0);
        });

        test('can search by pronunciation (spell)', () => {
            // Find a word with spell field
            const wordIdx = flatWords.findIndex((w) => w.spell);
            if (wordIdx >= 0) {
                const word = flatWords[wordIdx];
                // biome-ignore lint/style/noNonNullAssertion: we just checked w.spell exists
                const results = searchIndex(index, word.spell!);

                expect(results.length).toBeGreaterThan(0);
                expect(results).toContain(wordIdx);
            }
        });

        test('can search by English translation', () => {
            // Find a word with unique English translation
            const wordIdx = flatWords.findIndex(
                (w) => w.en && w.en.length > 0 && w.en[0].length > 3
            );
            if (wordIdx >= 0) {
                const word = flatWords[wordIdx];
                const results = searchIndex(index, word.en[0]);

                expect(results.length).toBeGreaterThan(0);
                expect(results).toContain(wordIdx);
            }
        });

        test('can search by Russian translation', () => {
            // Find a word with Russian translation
            const wordIdx = flatWords.findIndex(
                (w) => w.ru && w.ru.length > 0 && w.ru[0].length > 3
            );
            if (wordIdx >= 0) {
                const word = flatWords[wordIdx];
                const results = searchIndex(index, word.ru[0]);

                expect(results.length).toBeGreaterThan(0);
                expect(results).toContain(wordIdx);
            }
        });

        test('prefix search works', () => {
            // Find a word with spell longer than 3 chars
            const wordIdx = flatWords.findIndex((w) => w.spell && w.spell.length > 3);
            if (wordIdx >= 0) {
                const word = flatWords[wordIdx];
                // biome-ignore lint/style/noNonNullAssertion: we just checked w.spell exists
                const prefix = word.spell!.substring(0, 2);
                const results = searchIndex(index, prefix);

                expect(results.length).toBeGreaterThan(0);
                // Should find the word with this prefix
                expect(results).toContain(wordIdx);
            }
        });

        test('maxResults limits output', () => {
            // Search for a common prefix that likely matches many words
            const results5 = searchIndex(index, 'a', 5);
            const results10 = searchIndex(index, 'a', 10);

            expect(results5.length).toBeLessThanOrEqual(5);
            expect(results10.length).toBeLessThanOrEqual(10);
        });

        test('returned indices are valid vocabulary indices', () => {
            const results = searchIndex(index, 'a', 20);

            for (const idx of results) {
                expect(idx).toBeGreaterThanOrEqual(0);
                expect(idx).toBeLessThan(flatWords.length);
            }
        });
    });

    describe('Index Consistency with Vocabulary', () => {
        test('all Armenian words are searchable', () => {
            // Sample test - check first 10 words
            const sampleSize = Math.min(10, flatWords.length);
            for (let i = 0; i < sampleSize; i++) {
                const word = flatWords[i];
                const results = searchIndex(index, word.am);
                expect(results).toContain(i);
            }
        });

        test('vocabulary word count matches expected', () => {
            const totalWords = Object.values(vocabulary).reduce(
                (sum, words) => sum + words.length,
                0
            );
            expect(flatWords.length).toBe(totalWords);
        });
    });

    describe('Error Handling', () => {
        test('rejects invalid magic header', () => {
            const badBuffer = new ArrayBuffer(100);
            const view = new DataView(badBuffer);
            view.setUint8(0, 'B'.charCodeAt(0));
            view.setUint8(1, 'A'.charCodeAt(0));
            view.setUint8(2, 'D'.charCodeAt(0));
            view.setUint8(3, '!'.charCodeAt(0));

            expect(() => parseSearchIndex(badBuffer)).toThrow(/Invalid search index/);
        });

        test('rejects unsupported version', () => {
            const badBuffer = new ArrayBuffer(100);
            const view = new DataView(badBuffer);
            // Valid magic
            view.setUint8(0, 'T'.charCodeAt(0));
            view.setUint8(1, 'R'.charCodeAt(0));
            view.setUint8(2, 'I'.charCodeAt(0));
            view.setUint8(3, 'E'.charCodeAt(0));
            // Invalid version
            view.setUint8(4, 99);

            expect(() => parseSearchIndex(badBuffer)).toThrow(/Unsupported search index version/);
        });

        test('rejects truncated buffer', () => {
            const badBuffer = new ArrayBuffer(20);
            const view = new DataView(badBuffer);
            // Valid magic and version
            view.setUint8(0, 'T'.charCodeAt(0));
            view.setUint8(1, 'R'.charCodeAt(0));
            view.setUint8(2, 'I'.charCodeAt(0));
            view.setUint8(3, 'E'.charCodeAt(0));
            view.setUint8(4, 1);
            // Node count that would exceed buffer
            view.setUint32(5, 1000, true);

            expect(() => parseSearchIndex(badBuffer)).toThrow(/beyond buffer/);
        });
    });
});
