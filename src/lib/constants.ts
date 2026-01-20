/**
 * Storage key constants for localStorage.
 */
export const STORAGE_PREFIX = 'armenianApp_';

export const STORAGE_KEYS = {
    LEARNT_TRANSLATIONS: `${STORAGE_PREFIX}learntTranslations`,
    LEARNT_WORDS: `${STORAGE_PREFIX}learntWords`, // Deprecated, kept for migration
    QUIZ_LANGUAGE: `${STORAGE_PREFIX}quizLanguage`,
    CARDS_COUNT: `${STORAGE_PREFIX}cardsCount`,
    USER_ID: `${STORAGE_PREFIX}userID`,
    FIRST_VISIT_TRACKED: `${STORAGE_PREFIX}firstVisitTracked`,
    LEARNING_STATS: 'armenianLearningStats',
} as const;

/**
 * Quiz configuration constants.
 */
export const QUIZ_CONFIG = {
    /** Maximum number of answer options shown per question */
    MAX_OPTIONS: 10,
    /** Delay in ms before auto-advancing to next question after answering */
    AUTO_ADVANCE_DELAY_MS: 1000,
} as const;

/**
 * Level descriptions for UI display.
 */
export const LEVEL_DESCRIPTIONS: Record<string, string> = {
    A1: 'Beginner',
    A2: 'Elementary',
    B1: 'Intermediate',
    B2: 'Upper Intermediate',
};
