<script lang="ts">
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { ProgressBar } from '$lib/components/index.js';
import {
    cardsCount,
    currentLevel,
    currentWordIndex,
    getWordsByLevel,
    learningWords,
    learntWords,
    quizLanguage,
    resetLearningSession,
    vocabulary,
} from '$lib/stores/index.js';
import type { QuizLanguage, Word } from '$lib/types.js';

let words = $state<Word[]>([]);
let wordIndex = $state(0);
let language = $state<QuizLanguage>('english');
let count = $state(10);
let showComplete = $state(false);

// Get level from URL params
const level = $derived(page.params.level ?? '');

onMount(() => {
    // Subscribe to stores
    const unsubVocab = vocabulary.subscribe((vocab) => {
        if (!vocab || !level) return;

        // Get words for this level
        const levelWords = getWordsByLevel(vocab, level);
        if (levelWords.length === 0) {
            goto('/');
            return;
        }

        // Filter unlearnt words first, then add learnt words
        const unlearntWords = levelWords.filter((word) => !learntWords.isLearnt(word));
        const combined = [...unlearntWords, ...levelWords];

        // Remove duplicates
        const uniqueWords: Word[] = [];
        const seen = new Set<string>();
        combined.forEach((w) => {
            if (!seen.has(w.am)) {
                seen.add(w.am);
                uniqueWords.push(w);
            }
        });

        // Shuffle and limit
        const shuffled = [...uniqueWords].sort(() => 0.5 - Math.random());
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

    const unsubLanguage = quizLanguage.subscribe((l) => (language = l));
    const unsubCount = cardsCount.subscribe((c) => (count = c));

    return () => {
        unsubVocab();
        unsubIndex();
        unsubLanguage();
        unsubCount();
    };
});

const currentWord = $derived(words[wordIndex]);
const displayIndex = $derived(Math.min(wordIndex + 1, words.length));

const translation = $derived(() => {
    if (!currentWord) return '';
    const data = language === 'english' ? currentWord.en : currentWord.ru;
    return Array.isArray(data) ? data.join(', ') : data || '';
});

const languageLabel = $derived(language === 'english' ? 'English' : 'Russian');
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
