<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { page } from '$app/state';
import { vocabulary } from '$lib/stores/index.js';
import type { Vocabulary, Word } from '$lib/types.js';

interface WordWithLevel extends Word {
    level: string;
}

// biome-ignore lint/style/useConst: Required for bind:value in Svelte
let searchQuery = $state('');
let debouncedQuery = $state('');
let vocab = $state<Vocabulary | null>(null);
let showDropdown = $state(false);

// Get the return path from URL query params
const returnTo = $derived(page.url.searchParams.get('from') || `${base}/`);

$effect(() => {
    const unsub = vocabulary.subscribe((v) => (vocab = v));
    return unsub;
});

// Debounce search query to avoid recalculating on every keystroke
$effect(() => {
    // Read searchQuery to establish dependency
    const query = searchQuery;

    const timeoutId = setTimeout(() => {
        debouncedQuery = query;
    }, 150); // 150ms debounce

    return () => clearTimeout(timeoutId);
});

const MAX_RESULTS = 10;

// Filter words based on search query (Armenian or pronunciation)
// Searches directly in vocabulary structure without flattening first
// Uses early termination to avoid scanning entire vocabulary
const filteredWords = $derived<WordWithLevel[]>(() => {
    if (!vocab || !debouncedQuery.trim() || typeof vocab !== 'object') return [];

    const query = debouncedQuery.toLowerCase().trim();
    const results: WordWithLevel[] = [];

    // Search directly in vocabulary structure - no need to flatten first
    // This avoids creating a 9,539 element array on every search
    try {
        for (const [level, levelWords] of Object.entries(vocab)) {
            if (!Array.isArray(levelWords)) continue;
            for (const word of levelWords) {
                if (!word || !word.am) continue;
                const matchesArmenian = word.am.toLowerCase().includes(query);
                const matchesPronunciation = word.spell?.toLowerCase().includes(query) ?? false;
                if (matchesArmenian || matchesPronunciation) {
                    results.push({ ...word, level });
                    if (results.length >= MAX_RESULTS) break;
                }
            }
            // Early exit if we've found enough results
            if (results.length >= MAX_RESULTS) break;
        }
    } catch (error) {
        console.error('Error filtering words:', error);
        return [];
    }

    return results;
});

function handleInputFocus() {
    showDropdown = true;
}

function handleInputBlur() {
    // Delay hiding to allow click on dropdown items
    setTimeout(() => {
        showDropdown = false;
    }, 200);
}

function selectWord(word: WordWithLevel) {
    const encodedWord = encodeURIComponent(word.am);
    const fromParam = encodeURIComponent(returnTo);
    goto(`${base}/browse/${encodedWord}?from=${fromParam}`);
}

function goBack() {
    goto(returnTo);
}
</script>

<div class="browse-page">
    <div class="browse-header">
        <button class="back-link" onclick={goBack}>&larr; Back</button>
        <h2>Browse Vocabulary</h2>
    </div>

    <div class="search-container">
        <input
            type="text"
            class="search-input"
            placeholder="Search by Armenian word or pronunciation..."
            bind:value={searchQuery}
            onfocus={handleInputFocus}
            onblur={handleInputBlur}
        />

        {#if showDropdown && searchQuery.trim()}
            <div class="search-dropdown">
                {#if debouncedQuery.trim() && filteredWords().length === 0}
                    <div class="no-results">No words found</div>
                {:else if filteredWords().length > 0}
                    {#each filteredWords() as word}
                        <button
                            class="dropdown-item"
                            onclick={() => selectWord(word)}
                        >
                            <span class="word-armenian">{word.am}</span>
                            {#if word.spell}
                                <span class="word-pronunciation">({word.spell})</span>
                            {/if}
                            <span class="word-level">{word.level}</span>
                        </button>
                    {/each}
                {/if}
            </div>
        {/if}
    </div>

    <p class="search-hint">
        Type Armenian characters or romanized pronunciation to search
    </p>
</div>
