<script lang="ts">
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { LanguageSwitcher, StatsDisplay } from '$lib/components/index.js';
import { LEVEL_DESCRIPTIONS } from '$lib/constants.js';
import { tStore } from '$lib/i18n/index.js';
import {
    autoPlaySound,
    cardsCount,
    getAvailableLevels,
    learntTranslations,
    MAX_CARDS_COUNT,
    MIN_CARDS_COUNT,
    parseCardsCount,
    partOfSpeech,
    userStats,
    vocabulary,
} from '$lib/stores/index.js';
import type { PartOfSpeech, Vocabulary } from '$lib/types.js';

let currentCardsCount = $state(10);
let cardsCountDraft = $state('10');
let cardsCountDraftTouched = $state(false);
let currentPartOfSpeech = $state<PartOfSpeech>('all');
let soundEnabled = $state(true);
let t = $state((key: string) => key);

const parsedCardsCount = $derived(parseCardsCount(cardsCountDraft));
const isCardsCountValid = $derived(parsedCardsCount !== null);

// Subscribe to stores
$effect(() => {
    const unsubCardsCount = cardsCount.subscribe((v) => {
        currentCardsCount = v;
        if (!cardsCountDraftTouched) {
            cardsCountDraft = String(v);
        }
    });
    const unsubPos = partOfSpeech.subscribe((v) => (currentPartOfSpeech = v));
    const unsubSound = autoPlaySound.subscribe((v) => (soundEnabled = v));
    const unsubT = tStore.subscribe((v) => (t = v));
    return () => {
        unsubCardsCount();
        unsubPos();
        unsubSound();
        unsubT();
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
    if (!isCardsCountValid) return;
    goto(`${base}/learn/${level}`);
}

function toggleSound() {
    autoPlaySound.update((v) => !v);
}

function handleCardsCountInput() {
    cardsCountDraftTouched = true;
    const parsed = parseCardsCount(cardsCountDraft);
    if (parsed !== null) {
        cardsCount.set(parsed);
    }
}

function adjustCardsCount(delta: number) {
    const current = parsedCardsCount ?? currentCardsCount;
    const next = Math.min(MAX_CARDS_COUNT, Math.max(MIN_CARDS_COUNT, current + delta));
    cardsCountDraftTouched = true;
    cardsCountDraft = String(next);
    cardsCount.set(next);
}

function handlePartOfSpeechChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    partOfSpeech.set(target.value as PartOfSpeech);
}

function resetProgress() {
    if (
        confirm(
            t(
                'Are you sure you want to reset all progress? This will clear all learnt words and statistics.'
            )
        )
    ) {
        learntTranslations.reset();
        userStats.reset();
    }
}
</script>

<div id="level-selection" class="screen active">
	<LanguageSwitcher />
	<p class="app-description">
		{t('App would show given number of words to learn translation of and after this show quiz for translating it back. Your preferences and progress stay saved on this device.')}
	</p>
	<h2>{t('Select Your Armenian Level')}</h2>
	<div class="level-buttons">
		{#each levels as level}
			<button
				class="level-btn"
				disabled={!isCardsCountValid}
				onclick={() => selectLevel(level)}
			>
				{level}
				{#if LEVEL_DESCRIPTIONS[level]}
					- {t(LEVEL_DESCRIPTIONS[level])}
				{/if}
			</button>
		{/each}
	</div>

	<div class="settings-row">
		<div class="setting-item horizontal">
			<label for="cards-count">{t('Number of words to learn:')}</label>
			<span class="cards-count-control">
				<button
					type="button"
					class="cards-count-step"
					aria-label={t('Decrease number of words')}
					onclick={() => adjustCardsCount(-1)}
					disabled={parsedCardsCount === MIN_CARDS_COUNT}
				>
					−
				</button>
				<input
					type="text"
					inputmode="numeric"
					pattern="[0-9]*"
					id="cards-count"
					class="cards-count-input"
					class:invalid={!isCardsCountValid}
					autocomplete="off"
					bind:value={cardsCountDraft}
					oninput={handleCardsCountInput}
				/>
				<button
					type="button"
					class="cards-count-step"
					aria-label={t('Increase number of words')}
					onclick={() => adjustCardsCount(1)}
					disabled={parsedCardsCount === MAX_CARDS_COUNT}
				>
					+
				</button>
			</span>
		</div>

		<div class="setting-item">
			<label for="part-of-speech">{t('Part of speech:')}</label>
			<select
				id="part-of-speech"
				class="pos-select"
				value={currentPartOfSpeech}
				onchange={handlePartOfSpeechChange}
			>
				<option value="all">{t('All')}</option>
				<option value="noun">{t('Nouns')}</option>
				<option value="verb">{t('Verbs')}</option>
				<option value="adj">{t('Adjectives')}</option>
				<option value="adv">{t('Adverbs')}</option>
				<option value="other">{t('Other')}</option>
			</select>
		</div>

		<div class="setting-item">
			<label class="checkbox-label">
				<input
					type="checkbox"
					checked={soundEnabled}
					onchange={toggleSound}
				/>
				{t('Auto-play pronunciation')}
			</label>
		</div>
	</div>

	<StatsDisplay {stats} {t} />

	<div class="reset-section">
		<button id="reset-progress" class="btn secondary" onclick={resetProgress}>
			{t('Reset Progress')}
		</button>
	</div>
</div>
