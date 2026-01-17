import { get, writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { LevelStats, UserStats, Word } from '$lib/types.js';

const STORAGE_PREFIX = 'armenianApp_';

// User stats store
function createUserStatsStore() {
    const key = 'armenianLearningStats';
    const stored = browser ? localStorage.getItem(key) : null;
    const data = stored ? (JSON.parse(stored) as UserStats) : {};
    const store = writable<UserStats>(data);

    if (browser) {
        store.subscribe((value) => {
            localStorage.setItem(key, JSON.stringify(value));
        });
    }

    return {
        subscribe: store.subscribe,
        update: (level: string, score: number, total: number) => {
            store.update((stats) => {
                if (!stats[level]) {
                    stats[level] = { totalQuizzes: 0, totalCorrect: 0, totalQuestions: 0 };
                }
                stats[level].totalQuizzes++;
                stats[level].totalCorrect += score;
                stats[level].totalQuestions += total;
                return stats;
            });
        },
        reset: () => {
            store.set({});
            if (browser) {
                localStorage.removeItem(key);
            }
        },
    };
}

// Learnt words store - stored as comma-separated string for backwards compatibility
function createLearntWordsStore() {
    const key = `${STORAGE_PREFIX}learntWords`;
    const stored = browser ? localStorage.getItem(key) : null;
    const data = stored
        ? stored
              .split(',')
              .map((w) => w.trim())
              .filter(Boolean)
        : [];
    const store = writable<string[]>(data);

    if (browser) {
        store.subscribe((value) => {
            localStorage.setItem(key, value.join(','));
        });
    }

    return {
        subscribe: store.subscribe,
        markAsLearnt: (word: Word) => {
            store.update((words) => {
                if (!words.includes(word.am)) {
                    return [...words, word.am];
                }
                return words;
            });
        },
        isLearnt: (word: Word): boolean => {
            return get(store).includes(word.am);
        },
        reset: () => {
            store.set([]);
            if (browser) {
                localStorage.removeItem(key);
            }
        },
    };
}

export const userStats = createUserStatsStore();
export const learntWords = createLearntWordsStore();
