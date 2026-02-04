<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { page } from '$app/state';
import { tStore } from '$lib/i18n/index.js';
import { quizLanguage, vocabulary } from '$lib/stores/index.js';
import type { QuizLanguage, Vocabulary, Word } from '$lib/types.js';
import { expandPos, playSound } from '$lib/utils.js';

interface WordWithLevel extends Word {
    level: string;
}

let vocab = $state<Vocabulary | null>(null);
let language = $state<QuizLanguage>('english');
let t = $state((key: string) => key);

$effect(() => {
    const unsub = vocabulary.subscribe((v) => (vocab = v));
    return unsub;
});

$effect(() => {
    const unsub = quizLanguage.subscribe((l) => (language = l));
    return unsub;
});

$effect(() => {
    const unsub = tStore.subscribe((v) => (t = v));
    return unsub;
});

// Get the word from URL params (decoded)
const wordParam = $derived(decodeURIComponent(page.params.word ?? ''));

// Get the return path from URL query params (this is the original page, e.g., /learn/A1)
const originalFrom = $derived(page.url.searchParams.get('from') || `${base}/`);

// Find the word in vocabulary
const foundWord = $derived<WordWithLevel | null>(() => {
    if (!vocab || !wordParam) return null;

    for (const [level, levelWords] of Object.entries(vocab)) {
        const word = levelWords.find((w) => w.am === wordParam);
        if (word) {
            return { ...word, level };
        }
    }
    return null;
});

function goBackToBrowse() {
    // Return to browse page, preserving the original return path
    const fromParam = encodeURIComponent(originalFrom);
    goto(`${base}/browse?from=${fromParam}`);
}
</script>

<div class="word-detail-page">
    {#if foundWord()}
        {@const word = foundWord()}
        <div class="word-detail-header">
            <button class="back-link" onclick={goBackToBrowse}>&larr; {t('Back to Search')}</button>
        </div>

        <div class="word-detail-card">
            {#if word.pos}
                <div class="detail-part-of-speech">{expandPos(word.pos, language)}</div>
            {/if}

            <div class="word-main">
                <span class="detail-armenian-word">{word.am}</span>
                <button
                    class="play-sound-btn"
                    onclick={() => playSound(word.ogg_url)}
                    disabled={!word.ogg_url}
                    aria-label={t('Play pronunciation')}
                    title={word.ogg_url ? t('Play pronunciation') : t('No audio available')}
                >
                    🔊
                </button>
                <span class="level-badge level-{word.level.toLowerCase()}">{word.level}</span>
            </div>

            {#if word.spell}
                <div class="detail-pronunciation">{word.spell}</div>
            {/if}

            <div class="translations-section">
                <div class="translation-group">
                    <h3>{t('English')}</h3>
                    <ul class="translation-list">
                        {#each word.en as translation}
                            <li>{translation}</li>
                        {/each}
                    </ul>
                </div>

                <div class="translation-group">
                    <h3>{t('Русский')}</h3>
                    <ul class="translation-list">
                        {#each word.ru as translation}
                            <li>{translation}</li>
                        {/each}
                    </ul>
                </div>
            </div>

            {#if word.etymology_text}
                <div class="detail-etymology">{word.etymology_text}</div>
            {/if}
        </div>
    {:else}
        <div class="word-not-found">
            <h2>{t('Word not found')}</h2>
            <p>{t('The word was not found in the vocabulary.')}</p>
            <button class="btn primary" onclick={goBackToBrowse}>{t('Back to Search')}</button>
        </div>
    {/if}
</div>
