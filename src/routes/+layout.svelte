<script lang="ts">
import { onMount } from 'svelte';
import { get } from 'svelte/store';
import { base } from '$app/paths';
import { page } from '$app/state';
import { initAnalytics } from '$lib/analytics.js';
import {
    cardsCount,
    currentLevel,
    learntTranslations,
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

    // Use get() to read store values synchronously
    const language = get(quizLanguage);
    const cards = get(cardsCount);
    const level = get(currentLevel);
    const learntCount = get(learntTranslations).length;
    const stats = get(userStats);

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

// Generate browse URL with current page as return path
function getBrowseUrl(): string {
    const currentPath = page.url.pathname;
    const fromParam = encodeURIComponent(currentPath);
    return `${base}/browse?from=${fromParam}`;
}

// Check if we're currently on a browse page (don't show link there)
const isOnBrowsePage = $derived(page.url.pathname.startsWith(`${base}/browse`));
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
		{#if !isOnBrowsePage}
			<a href={getBrowseUrl()} class="footer-link">Browse Vocabulary</a>
			<span class="footer-separator">|</span>
		{/if}
		<button type="button" class="link-button" onclick={handleReportClick}>Report an Issue</button>
	</footer>
</div>
