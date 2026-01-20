<script lang="ts">
import { onMount } from 'svelte';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { trackQuizComplete } from '$lib/analytics.js';
import { ProgressBar, QuizOption } from '$lib/components/index.js';
import { QUIZ_CONFIG } from '$lib/constants.js';
import {
    cardsCount,
    createQuizQuestions,
    currentLevel,
    currentQuizIndex,
    learningWords,
    learntTranslations,
    quizLanguage,
    quizQuestions,
    quizScore,
    resetQuizSession,
    userStats,
} from '$lib/stores/index.js';
import type { QuizLanguage, QuizQuestion, Word } from '$lib/types.js';

let words = $state<Word[]>([]);
let questions = $state<QuizQuestion[]>([]);
let questionIndex = $state(0);
let score = $state(0);
let level = $state<string | null>(null);
let language = $state<QuizLanguage>('english');
let count = $state(10);
let selectedOption = $state<Word | null>(null);
let answered = $state(false);
let showComplete = $state(false);

onMount(() => {
    // Get language first (needed for creating questions)
    const currentLanguage = get(quizLanguage);
    language = currentLanguage;

    // Check if we have learning words
    const unsubLearning = learningWords.subscribe((w) => {
        words = w;
        if (w.length === 0) {
            goto('/');
            return;
        }
        // Create translation-based quiz questions
        const qs = createQuizQuestions(w, language);
        questions = qs;
        quizQuestions.set(qs);
        resetQuizSession();
    });

    const unsubLevel = currentLevel.subscribe((l) => (level = l));
    const unsubIndex = currentQuizIndex.subscribe((i) => {
        questionIndex = i;
        answered = false;
        selectedOption = null;
        showComplete = i >= questions.length && questions.length > 0;
    });
    const unsubScore = quizScore.subscribe((s) => (score = s));
    const unsubLanguage = quizLanguage.subscribe((l) => (language = l));
    const unsubCount = cardsCount.subscribe((c) => (count = c));

    return () => {
        unsubLearning();
        unsubLevel();
        unsubIndex();
        unsubScore();
        unsubLanguage();
        unsubCount();
    };
});

const currentQuestion = $derived(questions[questionIndex]);
const displayIndex = $derived(questionIndex + 1);

const percentage = $derived(
    questions.length > 0 ? Math.round((score / questions.length) * 100) : 0
);

function selectOption(option: Word) {
    if (answered) return;

    selectedOption = option;
    answered = true;

    const isCorrect = option.am === currentQuestion.word.am;
    if (isCorrect) {
        quizScore.update((s) => s + 1);
        learntTranslations.markAsLearnt(currentQuestion);
    }

    // Auto-advance after delay
    setTimeout(() => {
        currentQuizIndex.update((i) => i + 1);
    }, QUIZ_CONFIG.AUTO_ADVANCE_DELAY_MS);
}

function handleQuizComplete() {
    if (!level) return;

    // Update stats
    userStats.update(level, score, questions.length);

    // Track analytics - use get() to read store value synchronously
    const stats = get(userStats);
    const progressByLevel: Record<string, { quizzes: number; accuracy: number }> = {};
    for (const lvl of Object.keys(stats)) {
        const levelStats = stats[lvl];
        const accuracy =
            levelStats.totalQuestions > 0
                ? Math.round((levelStats.totalCorrect / levelStats.totalQuestions) * 100)
                : 0;
        progressByLevel[lvl] = {
            quizzes: levelStats.totalQuizzes,
            accuracy,
        };
    }

    const learntCount = get(learntTranslations).length;

    trackQuizComplete(level, progressByLevel, learntCount, language, count);
}

$effect(() => {
    if (showComplete && level) {
        handleQuizComplete();
    }
});

function restartApp() {
    if (level) {
        goto(`/learn/${level}`);
    } else {
        goto('/');
    }
}

function changeLevel() {
    goto('/');
}
</script>

<div id="quiz-mode" class="screen active">
	<div class="quiz-correct" id="quiz-correct-count">{score} / {questions.length}</div>
	<ProgressBar current={questionIndex} total={questions.length} />

	{#if !showComplete && currentQuestion}
		<div class="quiz-card">
			<div class="quiz-question">
				<p>Select the Armenian word for:</p>
				<div class="translation-question" id="translation-question">{currentQuestion.translation}</div>
			</div>
			<div class="options" id="quiz-options">
				{#each currentQuestion.options as option}
					<QuizOption
						word={option}
						isCorrect={option.am === currentQuestion.word.am}
						isSelected={selectedOption?.am === option.am}
						disabled={answered}
						onclick={() => selectOption(option)}
					/>
				{/each}
			</div>
		</div>
	{/if}

	{#if showComplete}
		<div class="quiz-complete" id="quiz-complete">
			<h3>Quiz Complete!</h3>
			<div class="score" id="final-score">Score: {score}/{questions.length} ({percentage}%)</div>
			<div class="actions">
				<button id="restart-app" class="btn primary" onclick={restartApp}>One More Time</button>
				<button id="change-level" class="btn secondary" onclick={changeLevel}
					>Change Settings</button
				>
			</div>
		</div>
	{/if}
</div>
