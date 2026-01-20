<script lang="ts">
import { onMount } from 'svelte';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { ProgressBar } from '$lib/components/index.js';
import {
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
import { getLanguageLabel, getTranslationDisplay, shuffle, uniqueByArmenian } from '$lib/utils.js';

let words = $state<Word[]>([]);
let wordIndex = $state(0);
let language = $state<QuizLanguage>('english');
let showComplete = $state(false);

// Get level from URL params
const level = $derived(page.params.level ?? '');

onMount(() => {
    // Subscribe to language for display
    const unsubLanguage = quizLanguage.subscribe((l) => (language = l));

    // Subscribe to vocabulary and initialize words
    const unsubVocab = vocabulary.subscribe((vocab) => {
        if (!vocab || !level) return;

        // Get words for this level
        const levelWords = getWordsByLevel(vocab, level);
        if (levelWords.length === 0) {
            goto('/');
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
        showComplete = i >= words.length && words.length > 0;
    });

    return () => {
        unsubVocab();
        unsubIndex();
        unsubLanguage();
    };
});

const currentWord = $derived(words[wordIndex]);
const displayIndex = $derived(Math.min(wordIndex + 1, words.length));

const translation = $derived(() => {
    if (!currentWord) return '';
    return getTranslationDisplay(currentWord, language);
});

const languageLabel = $derived(getLanguageLabel(language));
const canGoPrevious = $derived(wordIndex > 0);
const canGoNext = $derived(wordIndex < words.length);

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
    goto('/quiz');
}

function handleKeydown(event: KeyboardEvent) {
    if (showComplete && event.key === 'Enter') {
        event.preventDefault();
        startQuiz();
    } else if (event.key === 'ArrowRight') {
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

	{#if !showComplete && currentWord}
		<div class="word-card">
			<div class="armenian-word">{currentWord.am}</div>
			{#if currentWord.spell}
				<div class="pronunciation">{currentWord.spell}</div>
			{/if}
			<div class="translation">{translation()} ({languageLabel})</div>
			<div class="word-navigation">
				<button
					id="previous-word"
					class="btn secondary"
					class:disabled={!canGoPrevious}
					disabled={!canGoPrevious}
					onclick={previousWord}
				>
					Previous Word
				</button>
				<button
					id="next-word"
					class="btn primary"
					class:disabled={!canGoNext}
					disabled={!canGoNext}
					onclick={nextWord}
				>
					Next Word
				</button>
			</div>
		</div>
	{/if}

	{#if showComplete}
		<div class="learning-complete" id="learning-complete">
			<h3>Learning Complete!</h3>
			<p id="learning-complete-text">You've studied {words.length} words. Ready for the quiz?</p>
			<button id="start-quiz" class="btn primary" onclick={startQuiz}>Start Quiz</button>
		</div>
	{/if}
</div>
