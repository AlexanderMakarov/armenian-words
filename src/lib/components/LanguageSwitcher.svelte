<script lang="ts">
import { uiLanguage } from '$lib/stores/settings.js';
import type { UILanguage } from '$lib/types.js';

let currentLang = $state<UILanguage>('en');

$effect(() => {
    const unsub = uiLanguage.subscribe((v) => (currentLang = v));
    return unsub;
});

function selectLanguage(lang: UILanguage) {
    uiLanguage.set(lang);
}
</script>

<div class="language-switcher">
    <button
        class="lang-btn"
        class:active={currentLang === 'ru'}
        onclick={() => selectLanguage('ru')}
        aria-label="Русский"
    >
        🇷🇺 Русский
    </button>
    <button
        class="lang-btn"
        class:active={currentLang === 'en'}
        onclick={() => selectLanguage('en')}
        aria-label="English"
    >
        🇺🇸 English
    </button>
</div>

<style>
    .language-switcher {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
        margin-bottom: 1rem;
    }

    .lang-btn {
        padding: 0.4rem 0.8rem;
        border: 1px solid var(--border-color, #ccc);
        border-radius: 4px;
        background: var(--bg-secondary, #f5f5f5);
        cursor: pointer;
        font-size: 0.9rem;
        transition: all 0.2s ease;
    }

    .lang-btn:hover {
        background: var(--bg-hover, #e8e8e8);
    }

    .lang-btn.active {
        background: var(--primary-color, #4a90d9);
        color: white;
        border-color: var(--primary-color, #4a90d9);
    }
</style>
