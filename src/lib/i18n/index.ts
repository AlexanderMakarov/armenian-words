import { derived, get } from 'svelte/store';
import { uiLanguage } from '$lib/stores/settings.js';
import { en } from './translations/en.js';
import { ru } from './translations/ru.js';

export type UILanguage = 'en' | 'ru';

const translations: Record<UILanguage, Record<string, string>> = {
    en,
    ru,
};

/**
 * Translate a key to the current UI language.
 * Falls back to the key itself if translation not found (key is English text).
 */
export function t(key: string): string {
    const lang = get(uiLanguage);
    return translations[lang]?.[key] ?? key;
}

/**
 * Reactive translation store - use in Svelte components with $t(key).
 * Re-evaluates when uiLanguage changes.
 */
export const tStore = derived(uiLanguage, ($lang) => {
    return (key: string): string => {
        return translations[$lang]?.[key] ?? key;
    };
});

/**
 * Get translated level description.
 */
export function getTranslatedLevelDescription(description: string): string {
    return t(description);
}
