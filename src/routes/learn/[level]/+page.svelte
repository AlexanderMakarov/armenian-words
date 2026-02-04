<script lang="ts">
import { onMount } from 'svelte';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { page } from '$app/state';
import { ProgressBar } from '$lib/components/index.js';
import { tStore } from '$lib/i18n/index.js';
import {
    autoPlaySound,
    cardsCount,
    currentLevel,
    currentWordIndex,
    getWordsByLevel,
    learningWords,
    learntTranslations,
    quizLanguage,
    resetLearningSession,
    vocabulary,
} from '$lib/stores/index.js';
import type { QuizLanguage, Word } from '$lib/types.js';
import {
    expandPos,
    getLanguageLabel,
    getTranslationDisplay,
    playSound,
    shuffle,
    uniqueByArmenian,
} from '$lib/utils.js';

let words = $state<Word[]>([]);
let wordIndex = $state(0);
let language = $state<QuizLanguage>('english');
let soundEnabled = $state(true);
let t = $state((key: string) => key);

// Get level from URL params
const level = $derived(page.params.level ?? '');

onMount(() => {
    // Subscribe to language for display
    const unsubLanguage = quizLanguage.subscribe((l) => (language = l));
    const unsubT = tStore.subscribe((v) => (t = v));

    // Subscribe to vocabulary and initialize words
    const unsubVocab = vocabulary.subscribe((vocab) => {
        if (!vocab || !level) return;

        // Get words for this level
        const levelWords = getWordsByLevel(vocab, level);
        if (levelWords.length === 0) {
            goto(base || '/');
            return;
        }

        // Read settings synchronously
        const count = get(cardsCount);
        const currentLanguage = get(quizLanguage);

        // Filter unlearnt words first, then add learnt words
        // A word is "unlearnt" if not all its translations have been learned
        const unlearntWords = levelWords.filter(
            (word) => !learntTranslations.isWordFullyLearnt(word, currentLanguage)
        );
        const combined = [...unlearntWords, ...levelWords];

        // Remove duplicates, shuffle, and limit to user-selected count
        const uniqueWords = uniqueByArmenian(combined);
        const shuffled = shuffle(uniqueWords);
        words = shuffled.slice(0, Math.min(count, shuffled.length));

        // Update stores
        currentLevel.set(level);
        learningWords.set(words);
        resetLearningSession();
    });

    const unsubIndex = currentWordIndex.subscribe((i) => {
        wordIndex = i;
    });

    const unsubSound = autoPlaySound.subscribe((v) => (soundEnabled = v));

    return () => {
        unsubVocab();
        unsubIndex();
        unsubLanguage();
        unsubSound();
        unsubT();
    };
});

// Auto-play sound when word changes (if enabled)
$effect(() => {
    if (soundEnabled && currentWord?.ogg_url) {
        playSound(currentWord.ogg_url);
    }
});

const currentWord = $derived(words[wordIndex]);
const displayIndex = $derived(Math.min(wordIndex + 1, words.length));

const translation = $derived(() => {
    if (!currentWord) return '';
    return getTranslationDisplay(currentWord, language);
});

const languageLabel = $derived(getLanguageLabel(language));
const canGoPrevious = $derived(wordIndex > 0);
const canGoNext = $derived(wordIndex < words.length - 1);
const isLastWord = $derived(wordIndex === words.length - 1 && words.length > 0);

function nextWord() {
    if (wordIndex < words.length) {
        currentWordIndex.update((i) => i + 1);
    }
}

function previousWord() {
    if (wordIndex > 0) {
        currentWordIndex.update((i) => i - 1);
    }
}

function startQuiz() {
    goto(`${base}/quiz`);
}

function goToMainScreen() {
    goto(base || '/');
}

function handleKeydown(event: KeyboardEvent) {
    if (isLastWord && event.key === 'Enter') {
        event.preventDefault();
        startQuiz();
    } else if (event.key === 'ArrowRight' && !isLastWord) {
        event.preventDefault();
        nextWord();
    } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previousWord();
    }
}
</script>

<svelte:window onkeydown={handleKeydown} />

<div id="learning-mode" class="screen active">
	<div class="learning-count">{displayIndex} / {words.length}</div>
	<ProgressBar current={displayIndex} total={words.length} />

	{#if currentWord}
		<div class="word-card">
			{#if currentWord.pos}
				<div class="part-of-speech">{expandPos(currentWord.pos, language)}</div>
			{/if}
			<div class="word-header">
				<div class="armenian-word">{currentWord.am}</div>
				<button
					class="play-sound-btn"
					onclick={() => playSound(currentWord.ogg_url)}
					disabled={!currentWord.ogg_url}
					aria-label={t('Play pronunciation')}
					title={currentWord.ogg_url ? t('Play pronunciation') : t('No audio available')}
				>
					🔊
				</button>
			</div>
			{#if currentWord.spell}
				<div class="pronunciation">{currentWord.spell}</div>
			{/if}
			<div class="translation">{translation()} ({languageLabel})</div>
			{#if currentWord.etymology_text}
				<div class="etymology">{currentWord.etymology_text}</div>
			{/if}
			<div class="word-navigation">
				<button
					id="previous-word"
					class="btn secondary"
					class:disabled={!canGoPrevious}
					disabled={!canGoPrevious}
					onclick={previousWord}
				>
					{t('Previous Word')}
				</button>
				{#if isLastWord}
					<button id="start-quiz" class="btn primary" onclick={startQuiz}>
						{t('Start Quiz')}
					</button>
					<button id="main-screen" class="btn secondary" onclick={goToMainScreen}>
						{t('Main Screen')}
					</button>
				{:else}
					<button
						id="next-word"
						class="btn primary"
						class:disabled={!canGoNext}
						disabled={!canGoNext}
						onclick={nextWord}
					>
						{t('Next Word')}
					</button>
				{/if}
			</div>
		</div>
	{/if}

</div>
