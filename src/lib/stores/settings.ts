import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { PartOfSpeech, QuizLanguage, UILanguage } from '$lib/types.js';

const STORAGE_PREFIX = 'armenianApp_';

function createPersistentStore<T>(key: string, initial: T) {
    const fullKey = `${STORAGE_PREFIX}${key}`;
    const stored = browser ? localStorage.getItem(fullKey) : null;
    let data = initial;
    if (stored) {
        try {
            data = JSON.parse(stored) as T;
        } catch {
            // Invalid JSON in localStorage, use initial value and clear the invalid data
            console.warn(`Invalid JSON in localStorage for key "${fullKey}", resetting to default`);
            if (browser) {
                localStorage.removeItem(fullKey);
            }
        }
    }
    const store = writable<T>(data);

    if (browser) {
        store.subscribe((value) => {
            localStorage.setItem(fullKey, JSON.stringify(value));
        });
    }

    return store;
}

export const quizLanguage = createPersistentStore<QuizLanguage>('quizLanguage', 'english');
export const cardsCount = createPersistentStore<number>('cardsCount', 10);
export const autoPlaySound = createPersistentStore<boolean>('autoPlaySound', true);
export const partOfSpeech = createPersistentStore<PartOfSpeech>('partOfSpeech', 'all');

/** UI language for interface translation (separate from vocabulary quiz language) */
export const uiLanguage = createPersistentStore<UILanguage>('uiLanguage', 'en');
