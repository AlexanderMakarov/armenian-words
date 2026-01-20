<script lang="ts">
import type { QuizLanguage, Word } from '$lib/types.js';
import { getLanguageLabel, getTranslationDisplay } from '$lib/utils.js';

interface Props {
    word: Word;
    language: QuizLanguage;
}

const { word, language }: Props = $props();

const translation = $derived(getTranslationDisplay(word, language));
const languageLabel = $derived(getLanguageLabel(language));
</script>

<div class="word-card">
	<div class="armenian-word">{word.am}</div>
	{#if word.spell}
		<div class="pronunciation">{word.spell}</div>
	{/if}
	<div class="translation">{translation()} ({languageLabel})</div>
</div>
