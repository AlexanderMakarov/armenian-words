<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { page } from '$app/state';
import { tStore } from '$lib/i18n/index.js';
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
let t = $state((key: string) => key);

// Subscribe to translation store
$effect(() => {
    const unsub = tStore.subscribe((v) => (t = v));
    return unsub;
});

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

// Detect query language based on first character
type QueryLang = 'armenian' | 'russian' | 'latin';

function detectQueryLang(query: string): QueryLang {
    const trimmed = query.trim();
    if (!trimmed) return 'latin';

    const firstChar = trimmed.codePointAt(0) ?? 0;

    // Armenian: U+0530–U+058F
    if (firstChar >= 0x0530 && firstChar <= 0x058f) {
        return 'armenian';
    }

    // Cyrillic (Russian): U+0400–U+04FF
    if (firstChar >= 0x0400 && firstChar <= 0x04ff) {
        return 'russian';
    }

    // Default to Latin (English/pronunciation)
    return 'latin';
}

// Find matching text for display based on query
function findMatchingText(word: WordWithLevel, query: string, lang: QueryLang): string | null {
    const normalizedQuery = query.toLowerCase().trim();

    if (lang === 'russian') {
        // Find matching Russian translation
        for (const ru of word.ru || []) {
            if (ru.toLowerCase().startsWith(normalizedQuery)) {
                return ru;
            }
        }
    } else if (lang === 'latin') {
        // Check pronunciation first
        if (word.spell?.toLowerCase().startsWith(normalizedQuery)) {
            return word.spell;
        }
        // Then check English translations (index strips "to " prefix, so match without it)
        for (const en of word.en || []) {
            let enKey = en.toLowerCase();
            if (enKey.startsWith('to ')) {
                enKey = enKey.slice(3);
            }
            if (enKey.startsWith(normalizedQuery)) {
                return en; // Return original (with "to ") for display
            }
        }
    }

    return null;
}

const queryLang = $derived(detectQueryLang(debouncedQuery));

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
        <button class="back-link" onclick={goBack}>&larr; {t('Back')}</button>
        <h2>{t('Vocabulary')}</h2>
    </div>

    <div class="search-container">
        <input
            type="text"
            class="search-input"
            placeholder={t('Search Armenian, English, Russian, or pronunciation...')}
            bind:value={searchQuery}
            onfocus={handleInputFocus}
            onblur={handleInputBlur}
        />

        {#if showDropdown && searchQuery.trim()}
            <div class="search-dropdown">
                {#if debouncedQuery.trim() && filteredWords.length === 0}
                    <div class="no-results">{t('No words found')}</div>
                {:else if filteredWords.length > 0}
                    {#each filteredWords as word}
                        {@const matchedText = findMatchingText(word, debouncedQuery, queryLang)}
                        <div
                            class="dropdown-item"
                            role="button"
                            tabindex="0"
                            onclick={() => selectWord(word)}
                            onkeydown={(e) => e.key === 'Enter' && selectWord(word)}
                        >
                            {#if queryLang === 'armenian' || !matchedText}
                                <span class="word-armenian">{word.am}</span>
                                {#if word.spell}
                                    <span class="word-pronunciation">({word.spell})</span>
                                {/if}
                            {:else}
                                <span class="word-matched">{matchedText}</span>
                                <span class="word-armenian-secondary">({word.am})</span>
                            {/if}
                            <button
                                class="play-sound-btn small"
                                onclick={(e) => handlePlaySound(e, word.ogg_url)}
                                disabled={!word.ogg_url}
                                aria-label={t('Play pronunciation')}
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
        {t('Prefix search in Armenian, English, Russian, or pronunciation.')}
    </p>
</div>

<style>
    .word-matched {
        font-weight: 500;
    }

    .word-armenian-secondary {
        color: var(--text-secondary, #666);
        margin-left: 0.25rem;
    }
</style>
