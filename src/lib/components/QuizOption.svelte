<script lang="ts">
import type { Word } from '$lib/types.js';

interface Props {
    word: Word;
    isCorrect: boolean;
    isSelected: boolean;
    disabled: boolean;
    onclick: () => void;
}

const { word, isCorrect, isSelected, disabled, onclick }: Props = $props();

const buttonClass = $derived(() => {
    let cls = 'option-btn';
    if (disabled) cls += ' disabled';
    if (isCorrect && disabled) cls += ' correct';
    if (isSelected && !isCorrect && disabled) cls += ' incorrect';
    return cls;
});
</script>

<button class={buttonClass()} {disabled} onclick={onclick}>
	{word.am}
</button>
