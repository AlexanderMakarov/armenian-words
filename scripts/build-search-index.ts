#!/usr/bin/env bun
/**
 * Build search index for vocabulary
 *
 * Creates a compact binary trie index for multi-language vocabulary search.
 * Supports searching by: Armenian (am), English (en), Russian (ru), pronunciation (spell)
 *
 * Binary Format (v2 - terminal nodes only):
 * [Header] (13 bytes)
 *   - magic (4): "TRIE"
 *   - version (1): 2
 *   - node_count (4): total nodes
 *   - results_count (4): total word indices (stored only at terminal nodes)
 *
 * [Nodes] (12 bytes each)
 *   - char (4): UTF-32 code point
 *   - first_child (4): index of first child (0xFFFFFFFF = none)
 *   - sibling (4): index of next sibling (0xFFFFFFFF = none)
 *
 * [Results] (after all nodes)
 *   - For each node: count (2) + indices (2 each)
 *   - Only terminal nodes have non-zero counts
 */

import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAGIC = 'TRIE';
const VERSION = 2;
const NO_LINK = 0xffffffff;

interface Word {
	am: string;
	ru: string[];
	en: string[];
	spell?: string;
}

interface Vocabulary {
	[level: string]: Word[];
}

// In-memory trie node for building
interface TrieNode {
	char: number; // UTF-32 code point
	children: Map<number, TrieNode>;
	wordIndices: Set<number>; // Only populated at terminal nodes
}

function createNode(char: number): TrieNode {
	return {
		char,
		children: new Map(),
		wordIndices: new Set(),
	};
}

function insertWord(root: TrieNode, text: string, wordIndex: number): void {
	const normalized = text.toLowerCase();
	let node = root;

	for (const char of normalized) {
		const codePoint = char.codePointAt(0)!;
		if (!node.children.has(codePoint)) {
			node.children.set(codePoint, createNode(codePoint));
		}
		node = node.children.get(codePoint)!;
	}

	// Store word index ONLY at the terminal node (end of word)
	node.wordIndices.add(wordIndex);
}

function buildTrie(vocabulary: Vocabulary): {
	root: TrieNode;
	wordCount: number;
} {
	const root = createNode(0);
	let wordIndex = 0;

	// Flatten vocabulary and index all searchable fields
	const levels = Object.keys(vocabulary).sort();

	for (const level of levels) {
		const words = vocabulary[level];
		for (const word of words) {
			// Index Armenian word
			if (word.am) {
				insertWord(root, word.am, wordIndex);
			}

			// Index pronunciation
			if (word.spell) {
				insertWord(root, word.spell, wordIndex);
			}

			// Index English translations
			for (const en of word.en || []) {
				insertWord(root, en, wordIndex);
			}

			// Index Russian translations
			for (const ru of word.ru || []) {
				insertWord(root, ru, wordIndex);
			}

			wordIndex++;
		}
	}

	return { root, wordCount: wordIndex };
}

interface FlatNode {
	char: number;
	firstChild: number;
	sibling: number;
	wordIndices: number[];
}

function flattenTrie(root: TrieNode): FlatNode[] {
	const nodes: FlatNode[] = [];

	function flatten(node: TrieNode): number {
		const nodeIndex = nodes.length;
		const flatNode: FlatNode = {
			char: node.char,
			firstChild: NO_LINK,
			sibling: NO_LINK,
			wordIndices: Array.from(node.wordIndices).sort((a, b) => a - b),
		};
		nodes.push(flatNode);

		// Process children as a linked list via siblings
		const children = Array.from(node.children.values()).sort((a, b) => a.char - b.char);

		let prevChildIndex = -1;
		for (let i = 0; i < children.length; i++) {
			const childIndex = flatten(children[i]);

			if (i === 0) {
				flatNode.firstChild = childIndex;
			} else {
				nodes[prevChildIndex].sibling = childIndex;
			}
			prevChildIndex = childIndex;
		}

		return nodeIndex;
	}

	flatten(root);
	return nodes;
}

function serializeTrie(nodes: FlatNode[]): Buffer {
	// Calculate sizes
	let totalResults = 0;
	let terminalNodes = 0;
	for (const node of nodes) {
		totalResults += node.wordIndices.length;
		if (node.wordIndices.length > 0) {
			terminalNodes++;
		}
	}

	const headerSize = 13;
	const nodesSize = nodes.length * 12;
	const resultsSize = nodes.length * 2 + totalResults * 2; // count per node + indices

	const buffer = Buffer.alloc(headerSize + nodesSize + resultsSize);
	let offset = 0;

	// Write header
	buffer.write(MAGIC, offset, 4, 'ascii');
	offset += 4;
	buffer.writeUInt8(VERSION, offset);
	offset += 1;
	buffer.writeUInt32LE(nodes.length, offset);
	offset += 4;
	buffer.writeUInt32LE(totalResults, offset);
	offset += 4;

	// Write nodes
	for (const node of nodes) {
		buffer.writeUInt32LE(node.char, offset);
		offset += 4;
		buffer.writeUInt32LE(node.firstChild, offset);
		offset += 4;
		buffer.writeUInt32LE(node.sibling, offset);
		offset += 4;
	}

	// Write results
	for (const node of nodes) {
		buffer.writeUInt16LE(node.wordIndices.length, offset);
		offset += 2;
		for (const idx of node.wordIndices) {
			buffer.writeUInt16LE(idx, offset);
			offset += 2;
		}
	}

	console.log(`  Terminal nodes (with results): ${terminalNodes}`);

	return buffer;
}

function main() {
	const projectRoot = join(import.meta.dir, '..');
	const vocabPath = join(projectRoot, 'static', 'vocabulary.json');
	const outputPath = join(projectRoot, 'static', 'search-index.bin');

	console.log('Building search index (v2 - terminal nodes only)...\n');

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

	// Build trie
	console.log('Building trie index...');
	const { root, wordCount } = buildTrie(vocabulary);

	// Flatten trie
	console.log('Flattening trie...');
	const flatNodes = flattenTrie(root);
	console.log(`  Created ${flatNodes.length} nodes`);

	// Serialize
	console.log('\nSerializing to binary...');
	const buffer = serializeTrie(flatNodes);

	// Write output
	writeFileSync(outputPath, buffer);

	// Statistics
	const stats = statSync(outputPath);
	console.log('\n=== Statistics ===');
	console.log(`Words indexed: ${wordCount}`);
	console.log(`Trie nodes: ${flatNodes.length}`);
	console.log(`File size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
	console.log(`Output: ${outputPath}`);
}

main();
