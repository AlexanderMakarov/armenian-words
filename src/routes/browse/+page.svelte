<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { page } from '$app/state';
import { vocabulary } from '$lib/stores/index.js';
import type { Vocabulary, Word } from '$lib/types.js';

interface WordWithLevel extends Word {
    level: string;
}

let searchQuery = $state('');
let vocab = $state<Vocabulary | null>(null);
let showDropdown = $state(false);

// Get the return path from URL query params
const returnTo = $derived(page.url.searchParams.get('from') || `${base}/`);

$effect(() => {
    const unsub = vocabulary.subscribe((v) => (vocab = v));
    return unsub;
});

// Flatten all words with their levels
const allWords = $derived<WordWithLevel[]>(() => {
    if (!vocab) return [];
    const words: WordWithLevel[] = [];
    for (const [level, levelWords] of Object.entries(vocab)) {
        for (const word of levelWords) {
            words.push({ ...word, level });
        }
    }
    return words;
});

// Filter words based on search query (Armenian or pronunciation)
const filteredWords = $derived<WordWithLevel[]>(() => {
    const words = allWords();
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase().trim();
    return words.filter((word) => {
        const matchesArmenian = word.am.toLowerCase().includes(query);
        const matchesPronunciation = word.spell?.toLowerCase().includes(query) ?? false;
        return matchesArmenian || matchesPronunciation;
    });
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
                {#if filteredWords().length === 0}
                    <div class="no-results">No words found</div>
                {:else}
                    {#each filteredWords().slice(0, 20) as word}
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
                    {#if filteredWords().length > 20}
                        <div class="more-results">
                            ...and {filteredWords().length - 20} more results
                        </div>
                    {/if}
                {/if}
            </div>
        {/if}
    </div>

    <p class="search-hint">
        Type Armenian characters or romanized pronunciation to search
    </p>
</div>
