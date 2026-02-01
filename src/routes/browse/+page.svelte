<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { page } from '$app/state';
import { searchVocabulary } from '$lib/stores/vocabulary.js';
import type { Word } from '$lib/types.js';
import { playSound } from '$lib/utils.js';

interface WordWithLevel extends Word {
    level: string;
}

// biome-ignore lint/style/useConst: Required for bind:value in Svelte
let searchQuery = $state('');
let debouncedQuery = $state('');
let showDropdown = $state(false);

// Get the return path from URL query params
const returnTo = $derived(page.url.searchParams.get('from') || `${base}/`);

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

// Search using trie index (with fallback to linear search)
const filteredWords = $derived.by<WordWithLevel[]>(() => {
    if (!debouncedQuery.trim()) return [];

    const results = searchVocabulary(debouncedQuery, MAX_RESULTS);
    return results.map(({ word, level }) => ({ ...word, level }));
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

function handlePlaySound(event: MouseEvent, url: string | undefined) {
    event.stopPropagation();
    playSound(url);
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
            placeholder="Search Armenian, English, Russian, or pronunciation..."
            bind:value={searchQuery}
            onfocus={handleInputFocus}
            onblur={handleInputBlur}
        />

        {#if showDropdown && searchQuery.trim()}
            <div class="search-dropdown">
                {#if debouncedQuery.trim() && filteredWords.length === 0}
                    <div class="no-results">No words found</div>
                {:else if filteredWords.length > 0}
                    {#each filteredWords as word}
                        <div
                            class="dropdown-item"
                            role="button"
                            tabindex="0"
                            onclick={() => selectWord(word)}
                            onkeydown={(e) => e.key === 'Enter' && selectWord(word)}
                        >
                            <span class="word-armenian">{word.am}</span>
                            {#if word.spell}
                                <span class="word-pronunciation">({word.spell})</span>
                            {/if}
                            <button
                                class="play-sound-btn small"
                                onclick={(e) => handlePlaySound(e, word.ogg_url)}
                                disabled={!word.ogg_url}
                                aria-label="Play pronunciation"
                            >
                                🔊
                            </button>
                            <span class="word-level">{word.level}</span>
                        </div>
                    {/each}
                {/if}
            </div>
        {/if}
    </div>

    <p class="search-hint">
        Search by Armenian, English, Russian, or romanized pronunciation
    </p>
</div>
