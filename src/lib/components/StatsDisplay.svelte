<script lang="ts">
import type { UserStats } from '$lib/types.js';

interface Props {
    stats: UserStats;
    t: (key: string) => string;
}

const { stats, t }: Props = $props();

const hasStats = $derived(Object.keys(stats).length > 0);

function getAccuracy(level: string): string {
    const levelStats = stats[level];
    if (!levelStats || levelStats.totalQuestions === 0) return '0.0';
    return ((levelStats.totalCorrect / levelStats.totalQuestions) * 100).toFixed(1);
}
</script>

<div class="stats">
	{#if hasStats}
		<h4>{t('Your Learning Progress')}</h4>
		{#each Object.entries(stats) as [level, levelStats]}
			<p>
				<strong>{level}:</strong>
				{levelStats.totalQuizzes} {t('quizzes')}, {getAccuracy(level)}% {t('accuracy')}
			</p>
		{/each}
	{:else}
		<p>{t('No previous learning history')}</p>
	{/if}
</div>
