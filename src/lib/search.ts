/**
 * Trie-based search index for vocabulary
 *
 * Loads and searches the pre-built binary trie index.
 * All searches are case-insensitive (index is built lowercase).
 */

const MAGIC = 'TRIE';
const VERSION = 1;
const NO_LINK = 0xffffffff;
const HEADER_SIZE = 13;
const NODE_SIZE = 12;

export interface SearchIndex {
    nodeCount: number;
    resultsCount: number;
    nodes: DataView;
    results: DataView;
    nodesOffset: number;
    resultsOffset: number;
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
        throw new Error(`Unsupported search index version: ${version}`);
    }

    const nodeCount = view.getUint32(5, true);
    const resultsCount = view.getUint32(9, true);

    // Validate sizes
    const nodesOffset = HEADER_SIZE;
    const resultsOffset = HEADER_SIZE + nodeCount * NODE_SIZE;

    if (resultsOffset > buffer.byteLength) {
        throw new Error(
            `Invalid search index: nodes extend beyond buffer (${resultsOffset} > ${buffer.byteLength})`
        );
    }

    return {
        nodeCount,
        resultsCount,
        nodes: view,
        results: view,
        nodesOffset,
        resultsOffset,
    };
}

/**
 * Get node data at given index
 */
function getNode(
    index: SearchIndex,
    nodeIdx: number
): { char: number; firstChild: number; sibling: number } {
    const offset = index.nodesOffset + nodeIdx * NODE_SIZE;
    return {
        char: index.nodes.getUint32(offset, true),
        firstChild: index.nodes.getUint32(offset + 4, true),
        sibling: index.nodes.getUint32(offset + 8, true),
    };
}

/**
 * Get word indices for a node
 */
function getNodeResults(index: SearchIndex, nodeIdx: number): number[] {
    // Results are stored sequentially after all nodes
    // We need to iterate through all previous nodes to find offset
    let offset = index.resultsOffset;

    for (let i = 0; i < nodeIdx; i++) {
        const count = index.results.getUint16(offset, true);
        offset += 2 + count * 2;
    }

    const count = index.results.getUint16(offset, true);
    offset += 2;

    const results: number[] = [];
    for (let i = 0; i < count; i++) {
        results.push(index.results.getUint16(offset, true));
        offset += 2;
    }

    return results;
}

/**
 * Find child node with given character
 */
function findChild(index: SearchIndex, parentIdx: number, charCode: number): number | null {
    const parent = getNode(index, parentIdx);
    let childIdx = parent.firstChild;

    while (childIdx !== NO_LINK) {
        const child = getNode(index, childIdx);
        if (child.char === charCode) {
            return childIdx;
        }
        // Children are sorted by char, so we can stop early
        if (child.char > charCode) {
            return null;
        }
        childIdx = child.sibling;
    }

    return null;
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

    // Traverse trie following the query characters
    let nodeIdx = 0; // Start at root

    for (const char of normalized) {
        // biome-ignore lint/style/noNonNullAssertion: char is always a valid string from iteration
        const codePoint = char.codePointAt(0)!;
        const childIdx = findChild(index, nodeIdx, codePoint);

        if (childIdx === null) {
            // No match found
            return [];
        }

        nodeIdx = childIdx;
    }

    // Found the node matching the full query prefix
    // Return word indices stored at this node
    const results = getNodeResults(index, nodeIdx);

    return results.slice(0, maxResults);
}

/**
 * Validate search index integrity
 * Returns true if valid, throws on error
 */
export function validateSearchIndex(buffer: ArrayBuffer): boolean {
    const index = parseSearchIndex(buffer);

    // Check all nodes are readable
    for (let i = 0; i < index.nodeCount; i++) {
        const node = getNode(index, i);

        // Validate links
        if (node.firstChild !== NO_LINK && node.firstChild >= index.nodeCount) {
            throw new Error(`Node ${i} has invalid firstChild: ${node.firstChild}`);
        }
        if (node.sibling !== NO_LINK && node.sibling >= index.nodeCount) {
            throw new Error(`Node ${i} has invalid sibling: ${node.sibling}`);
        }
    }

    // Check results are readable
    let resultsRead = 0;
    let offset = index.resultsOffset;

    for (let i = 0; i < index.nodeCount; i++) {
        if (offset + 2 > buffer.byteLength) {
            throw new Error(`Results count extends beyond buffer at node ${i}`);
        }

        const count = index.results.getUint16(offset, true);
        offset += 2;

        if (offset + count * 2 > buffer.byteLength) {
            throw new Error(`Results extend beyond buffer at node ${i}`);
        }

        offset += count * 2;
        resultsRead += count;
    }

    if (resultsRead !== index.resultsCount) {
        throw new Error(
            `Results count mismatch: header says ${index.resultsCount}, found ${resultsRead}`
        );
    }

    return true;
}
