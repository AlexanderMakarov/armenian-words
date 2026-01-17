<script lang="ts">
interface Props {
    current: number;
    total: number;
}

const { current, total }: Props = $props();

const progress = $derived((current / total) * 100);
</script>

<div class="progress-bar">
	<div class="progress" style="width: {progress}%"></div>
	<span class="progress-text">{current} / {total}</span>
</div>
