/**
 * Trie-based search index for vocabulary (v2)
 *
 * Loads and searches the pre-built binary trie index.
 * All searches are case-insensitive (index is built lowercase).
 *
 * v2: Results stored only at terminal nodes, search collects from subtree.
 */

const MAGIC = 'TRIE';
const VERSION = 2;
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
    // Pre-computed results offsets for O(1) lookup
    resultsOffsets: Uint32Array;
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

    // Pre-compute results offsets for O(1) lookup
    const resultsOffsets = new Uint32Array(nodeCount);
    let offset = resultsOffset;
    for (let i = 0; i < nodeCount; i++) {
        resultsOffsets[i] = offset;
        const count = view.getUint16(offset, true);
        offset += 2 + count * 2;
    }

    return {
        nodeCount,
        resultsCount,
        nodes: view,
        results: view,
        nodesOffset,
        resultsOffset,
        resultsOffsets,
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
 * Get word indices for a node (O(1) with pre-computed offsets)
 */
function getNodeResults(index: SearchIndex, nodeIdx: number): number[] {
    const offset = index.resultsOffsets[nodeIdx];
    const count = index.results.getUint16(offset, true);

    if (count === 0) return [];

    const results: number[] = [];
    let pos = offset + 2;
    for (let i = 0; i < count; i++) {
        results.push(index.results.getUint16(pos, true));
        pos += 2;
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
 * Collect all results from a node and its descendants (subtree traversal)
 * Uses iterative DFS to avoid stack overflow on deep tries
 */
function collectSubtreeResults(
    index: SearchIndex,
    startNodeIdx: number,
    maxResults: number
): number[] {
    const results = new Set<number>();
    const stack: number[] = [startNodeIdx];

    while (stack.length > 0 && results.size < maxResults) {
        // biome-ignore lint/style/noNonNullAssertion: stack.length > 0 guarantees pop() returns a value
        const nodeIdx = stack.pop()!;
        const node = getNode(index, nodeIdx);

        // Collect results at this node
        const nodeResults = getNodeResults(index, nodeIdx);
        for (const idx of nodeResults) {
            results.add(idx);
            if (results.size >= maxResults) break;
        }

        // Add children to stack (process siblings via linked list)
        let childIdx = node.firstChild;
        while (childIdx !== NO_LINK) {
            stack.push(childIdx);
            const child = getNode(index, childIdx);
            childIdx = child.sibling;
        }
    }

    return Array.from(results).slice(0, maxResults);
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
    // Collect results from this node and all its descendants
    return collectSubtreeResults(index, nodeIdx, maxResults);
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
