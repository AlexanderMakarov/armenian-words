import type { QuizLanguage, Word } from './types.js';

/**
 * Fisher-Yates shuffle for unbiased randomization.
 * Returns a new shuffled array (doesn't mutate original).
 */
export function shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Gets the translation(s) for a word in the specified language.
 */
export function getTranslations(word: Word, language: QuizLanguage): string[] {
    return language === 'english' ? word.en : word.ru;
}

/**
 * Gets the translation string for display (comma-separated if multiple).
 */
export function getTranslationDisplay(word: Word, language: QuizLanguage): string {
    const translations = getTranslations(word, language);
    return translations.join(', ');
}

/**
 * Gets the human-readable label for a language.
 */
export function getLanguageLabel(language: QuizLanguage): string {
    return language === 'english' ? 'English' : 'Russian';
}

/**
 * Removes duplicate words by Armenian text, preserving first occurrence order.
 */
export function uniqueByArmenian(words: Word[]): Word[] {
    const seen = new Set<string>();
    return words.filter((word) => {
        if (seen.has(word.am)) {
            return false;
        }
        seen.add(word.am);
        return true;
    });
}

/**
 * Plays pronunciation audio for a word if ogg_url is available.
 * Fails silently if playback isn't possible (e.g., no user interaction yet).
 */
export function playSound(url: string | undefined): void {
    if (!url) return;
    const audio = new Audio(url);
    audio.play().catch(() => {
        // Silently ignore playback errors (autoplay restrictions, network issues)
    });
}
