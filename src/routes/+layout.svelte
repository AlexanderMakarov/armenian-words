<script lang="ts">
import { onMount } from 'svelte';
import { get } from 'svelte/store';
import { base } from '$app/paths';
import { page } from '$app/state';
import { initAnalytics, showFeedbackSurvey } from '$lib/analytics.js';
import {
    cardsCount,
    currentLevel,
    learntTranslations,
    quizLanguage,
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

function handleReportClick(event: MouseEvent) {
    event.preventDefault();

    // Gather context for the feedback
    const language = get(quizLanguage);
    const cards = get(cardsCount);
    const level = get(currentLevel);
    const learntCount = get(learntTranslations).length;

    // Extract word from URL if on a word detail page (e.g., /browse/word)
    const pathParts = page.url.pathname.split('/');
    const browseIndex = pathParts.indexOf('browse');
    const word =
        browseIndex !== -1 && pathParts[browseIndex + 1]
            ? decodeURIComponent(pathParts[browseIndex + 1])
            : undefined;

    showFeedbackSurvey({
        pageUrl: page.url.href,
        pagePath: page.url.pathname,
        word,
        level: level || undefined,
        quizLanguage: language,
        cardsCount: cards,
        learntWordsCount: learntCount,
    });
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
