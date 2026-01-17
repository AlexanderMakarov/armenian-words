<script lang="ts">
import type { QuizLanguage, Word } from '$lib/types.js';

interface Props {
    word: Word;
    language: QuizLanguage;
}

const { word, language }: Props = $props();

const translation = $derived(() => {
    const data = language === 'english' ? word.en : word.ru;
    return Array.isArray(data) ? data.join(', ') : data || '';
});

const languageLabel = $derived(language === 'english' ? 'English' : 'Russian');
</script>

<div class="word-card">
	<div class="armenian-word">{word.am}</div>
	{#if word.spell}
		<div class="pronunciation">{word.spell}</div>
	{/if}
	<div class="translation">{translation()} ({languageLabel})</div>
</div>
