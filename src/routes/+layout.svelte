<script lang="ts">
import { onMount } from 'svelte';
import { initAnalytics } from '$lib/analytics.js';
import {
    cardsCount,
    currentLevel,
    learntWords,
    quizLanguage,
    userStats,
    vocabulary,
} from '$lib/stores/index.js';
import '../app.scss';

const { children } = $props();

let error = $state<string | null>(null);
let loading = $state(true);

onMount(async () => {
    try {
        await vocabulary.load();
        initAnalytics();
    } catch (e) {
        error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
        loading = false;
    }
});

function generateIssueUrl(): string {
    const repoUrl = 'https://github.com/AlexanderMakarov/armenian-words';
    const title = encodeURIComponent('Issue Report');

    let language = 'english';
    let cards = 10;
    let level: string | null = null;
    let learntCount = 0;
    let stats: Record<
        string,
        { totalQuizzes: number; totalCorrect: number; totalQuestions: number }
    > = {};

    quizLanguage.subscribe((v) => (language = v))();
    cardsCount.subscribe((v) => (cards = v))();
    currentLevel.subscribe((v) => (level = v))();
    learntWords.subscribe((v) => (learntCount = v.length))();
    userStats.subscribe((v) => (stats = v))();

    let statsText = 'Cache Settings:\n';
    statsText += `- Quiz Language: ${language}\n`;
    statsText += `- Cards Count: ${cards}\n`;
    statsText += `- Current Level: ${level || 'not set'}\n`;
    statsText += `- Learnt Words Count: ${learntCount}\n`;

    if (Object.keys(stats).length > 0) {
        statsText += '- User Statistics:\n';
        Object.entries(stats).forEach(([lvl, s]) => {
            const accuracy =
                s.totalQuestions > 0
                    ? ((s.totalCorrect / s.totalQuestions) * 100).toFixed(1)
                    : '0.0';
            statsText += `  * ${lvl}: ${s.totalQuizzes} quizzes, ${accuracy}% accuracy\n`;
        });
    }

    const body = encodeURIComponent(`## Problem Description
<!-- Please explain the problem you encountered: -->

---

## Translation Issue (if applicable)

- **Armenian word:**
- **Correct translation (English):**
- **Correct translation (Russian):**
- **Pronunciation:**

---

## Settings (don't edit this section)

\`\`\`
${statsText}
\`\`\`
`);

    return `${repoUrl}/issues/new?title=${title}&body=${body}`;
}

function handleReportClick(event: MouseEvent) {
    event.preventDefault();
    const url = generateIssueUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
}
</script>

<div class="container">
	<header>
		<h1>Armenian Language Learning</h1>
	</header>

	{#if loading}
		<div class="loading">Loading vocabulary...</div>
	{:else if error}
		<div class="error">
			<h2>Error</h2>
			<p>Failed to load vocabulary data. Please refresh the page.</p>
			<p class="error-details">{error}</p>
		</div>
	{:else}
		{@render children()}
	{/if}

	<footer>
		<button type="button" class="link-button" onclick={handleReportClick}>Report an Issue</button>
	</footer>
</div>
