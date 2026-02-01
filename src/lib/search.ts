/**
 * Sorted array search index for vocabulary (v3)
 *
 * Loads and searches the pre-built binary search index.
 * All searches are case-insensitive (index is built lowercase).
 *
 * Uses binary search to find first prefix match, then linear scan for all matches.
 */

const MAGIC = 'SIDX';
const VERSION = 1;
const HEADER_SIZE = 9;

export interface SearchIndex {
    entryCount: number;
    data: DataView;
    // Pre-computed entry offsets for O(1) access
    entryOffsets: Uint32Array;
}

/**
 * Parse and validate the search index binary format
 */
export function parseSearchIndex(buffer: ArrayBuffer): SearchIndex {
    const view = new DataView(buffer);

    // Validate header
    const magic = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
    );

    if (magic !== MAGIC) {
        throw new Error(`Invalid search index: expected magic "${MAGIC}", got "${magic}"`);
    }

    const version = view.getUint8(4);
    if (version !== VERSION) {
        throw new Error(`Unsupported search index version: ${version}, expected ${VERSION}`);
    }

    const entryCount = view.getUint32(5, true);

    // Pre-compute entry offsets for O(1) access
    const entryOffsets = new Uint32Array(entryCount);
    let offset = HEADER_SIZE;

    for (let i = 0; i < entryCount; i++) {
        if (offset >= buffer.byteLength) {
            throw new Error(`Entry ${i} extends beyond buffer`);
        }
        entryOffsets[i] = offset;
        const keyLength = view.getUint8(offset);
        offset += 1 + keyLength + 2; // key_length + key_bytes + word_index
    }

    return {
        entryCount,
        data: view,
        entryOffsets,
    };
}

/**
 * Get entry at given index
 */
function getEntry(index: SearchIndex, entryIdx: number): { key: string; wordIndex: number } {
    const offset = index.entryOffsets[entryIdx];
    const keyLength = index.data.getUint8(offset);

    // Decode UTF-8 key
    const keyBytes = new Uint8Array(index.data.buffer, offset + 1, keyLength);
    const key = new TextDecoder().decode(keyBytes);

    const wordIndex = index.data.getUint16(offset + 1 + keyLength, true);

    return { key, wordIndex };
}

/**
 * Binary search to find the first entry where key >= query
 */
function lowerBound(index: SearchIndex, query: string): number {
    let left = 0;
    let right = index.entryCount;

    while (left < right) {
        const mid = (left + right) >>> 1;
        const entry = getEntry(index, mid);

        if (entry.key < query) {
            left = mid + 1;
        } else {
            right = mid;
        }
    }

    return left;
}

/**
 * Search the index for words matching the query prefix
 * Returns word indices (into flattened vocabulary array)
 *
 * @param index - The parsed search index
 * @param query - Search query (will be lowercased)
 * @param maxResults - Maximum number of results to return
 */
export function searchIndex(index: SearchIndex, query: string, maxResults = 10): number[] {
    if (!query) return [];

    const normalized = query.toLowerCase();

    // Find first entry that could match (key >= query)
    const startIdx = lowerBound(index, normalized);

    // Collect all entries that start with the query prefix
    const results = new Set<number>();

    for (let i = startIdx; i < index.entryCount && results.size < maxResults; i++) {
        const entry = getEntry(index, i);

        // Stop if key no longer starts with query
        if (!entry.key.startsWith(normalized)) {
            break;
        }

        results.add(entry.wordIndex);
    }

    return Array.from(results);
}

/**
 * Validate search index integrity
 * Returns true if valid, throws on error
 */
export function validateSearchIndex(buffer: ArrayBuffer): boolean {
    const index = parseSearchIndex(buffer);

    // Check all entries are readable and sorted (using simple string comparison)
    let prevKey = '';
    for (let i = 0; i < index.entryCount; i++) {
        const entry = getEntry(index, i);

        // Validate sorting (simple string comparison, same as build script)
        if (entry.key < prevKey) {
            throw new Error(`Entry ${i} is not sorted: "${entry.key}" < "${prevKey}"`);
        }
        prevKey = entry.key;

        // Validate word index is reasonable (< 65535 for 2-byte storage)
        if (entry.wordIndex > 65535) {
            throw new Error(`Entry ${i} has invalid wordIndex: ${entry.wordIndex}`);
        }
    }

    return true;
}
