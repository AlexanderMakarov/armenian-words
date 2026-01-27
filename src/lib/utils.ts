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

/**
 * Part of speech abbreviation mappings for English and Russian.
 */
const posLabels: Record<string, { english: string; russian: string }> = {
    adj: { english: 'adjective', russian: 'прилагательное' },
    adv: { english: 'adverb', russian: 'наречие' },
    conj: { english: 'conjunction', russian: 'союз' },
    det: { english: 'determiner', russian: 'определитель' },
    intj: { english: 'interjection', russian: 'междометие' },
    noun: { english: 'noun', russian: 'существительное' },
    num: { english: 'numeral', russian: 'числительное' },
    part: { english: 'particle', russian: 'частица' },
    prep: { english: 'preposition', russian: 'предлог' },
    pron: { english: 'pronoun', russian: 'местоимение' },
    verb: { english: 'verb', russian: 'глагол' },
};

/**
 * Expands a part of speech abbreviation to its full form in the specified language.
 * Returns the original abbreviation if no mapping exists.
 */
export function expandPos(pos: string, language: QuizLanguage): string {
    const mapping = posLabels[pos.toLowerCase()];
    if (!mapping) {
        return pos;
    }
    return mapping[language];
}
