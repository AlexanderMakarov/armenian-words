import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { QuizLanguage } from '$lib/types.js';

const STORAGE_PREFIX = 'armenianApp_';

function createPersistentStore<T>(key: string, initial: T) {
    const fullKey = `${STORAGE_PREFIX}${key}`;
    const stored = browser ? localStorage.getItem(fullKey) : null;
    const data = stored ? (JSON.parse(stored) as T) : initial;
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
