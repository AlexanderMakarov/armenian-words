<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { StatsDisplay } from '$lib/components/index.js';
import { LEVEL_DESCRIPTIONS } from '$lib/constants.js';
import {
    autoPlaySound,
    cardsCount,
    getAvailableLevels,
    learntTranslations,
    quizLanguage,
    userStats,
    vocabulary,
} from '$lib/stores/index.js';
import type { QuizLanguage, Vocabulary } from '$lib/types.js';

let currentCardsCount = $state(10);
let currentLanguage = $state<QuizLanguage>('english');
let soundEnabled = $state(true);

// Subscribe to stores
$effect(() => {
    const unsubCardsCount = cardsCount.subscribe((v) => (currentCardsCount = v));
    const unsubLanguage = quizLanguage.subscribe((v) => (currentLanguage = v));
    const unsubSound = autoPlaySound.subscribe((v) => (soundEnabled = v));
    return () => {
        unsubCardsCount();
        unsubLanguage();
        unsubSound();
    };
});

let stats = $state<
    Record<string, { totalQuizzes: number; totalCorrect: number; totalQuestions: number }>
>({});
$effect(() => {
    const unsub = userStats.subscribe((v) => (stats = v));
    return unsub;
});

let vocab = $state<Vocabulary | null>(null);
$effect(() => {
    const unsub = vocabulary.subscribe((v) => (vocab = v));
    return unsub;
});

const levels = $derived(getAvailableLevels(vocab));

function selectLevel(level: string) {
    goto(`${base}/learn/${level}`);
}

function selectLanguage(language: QuizLanguage) {
    quizLanguage.set(language);
}

function toggleSound() {
    autoPlaySound.update((v) => !v);
}

function handleCardsCountChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseInt(target.value, 10);
    if (value > 0 && value <= 100) {
        cardsCount.set(value);
    } else {
        target.value = currentCardsCount.toString();
    }
}

function resetProgress() {
    if (
        confirm(
            'Are you sure you want to reset all progress? This will clear all learnt words and statistics.'
        )
    ) {
        learntTranslations.reset();
        userStats.reset();
    }
}
</script>

<div id="level-selection" class="screen active">
	<p class="app-description">
		App would show given number of words to learn translation of and after this show quiz for
		translating it back. Your preferences and progress stay saved on this device.
	</p>
	<h2>Select Your Armenian Level</h2>
	<div class="level-buttons">
		{#each levels as level}
			<button class="level-btn" onclick={() => selectLevel(level)}>
				{level}
				{#if LEVEL_DESCRIPTIONS[level]}
					- {LEVEL_DESCRIPTIONS[level]}
				{/if}
			</button>
		{/each}
	</div>

	<div class="cards-count-selection">
		<p>Choose how many words to learn:</p>
		<input
			type="number"
			id="cards-count"
			class="cards-count-input"
			min="1"
			max="100"
			value={currentCardsCount}
			onchange={handleCardsCountChange}
			oninput={handleCardsCountChange}
		/>
	</div>

	<div class="quiz-language-selection">
		<p>Your language:</p>
		<div class="language-buttons">
			<button
				class="language-btn"
				class:active={currentLanguage === 'english'}
				onclick={() => selectLanguage('english')}
			>
				English
			</button>
			<button
				class="language-btn"
				class:active={currentLanguage === 'russian'}
				onclick={() => selectLanguage('russian')}
			>
				Русский
			</button>
		</div>
	</div>

	<div class="sound-toggle-selection">
		<p>Auto-play pronunciation:</p>
		<button
			class="toggle-btn"
			class:active={soundEnabled}
			onclick={toggleSound}
			aria-pressed={soundEnabled}
		>
			{soundEnabled ? 'On' : 'Off'}
		</button>
	</div>

	<StatsDisplay {stats} />

	<div class="reset-section">
		<button id="reset-progress" class="btn secondary" onclick={resetProgress}>
			Reset Progress
		</button>
	</div>
</div>
