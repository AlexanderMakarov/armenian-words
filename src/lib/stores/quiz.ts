import { writable } from 'svelte/store';
import { QUIZ_CONFIG } from '$lib/constants.js';
import type { QuizLanguage, QuizQuestion, QuizWord, Word } from '$lib/types.js';
import { getTranslations, shuffle } from '$lib/utils.js';

// Session state - not persisted to localStorage
export const currentLevel = writable<string | null>(null);
export const learningWords = writable<Word[]>([]);
export const currentWordIndex = writable<number>(0);

// Quiz state
export const quizQuestions = writable<QuizQuestion[]>([]);
export const currentQuizIndex = writable<number>(0);
export const quizScore = writable<number>(0);

/** @deprecated Use quizQuestions instead */
export const quizWords = writable<QuizWord[]>([]);

export function resetLearningSession() {
    currentWordIndex.set(0);
}

export function resetQuizSession() {
    quizQuestions.set([]);
    quizWords.set([]);
    currentQuizIndex.set(0);
    quizScore.set(0);
}

export function generateQuizOptions(correctWord: Word, allWords: Word[]): Word[] {
    const options: Word[] = [correctWord];

    // Add random incorrect options from learning words
    const maxOptions = Math.min(QUIZ_CONFIG.MAX_OPTIONS, allWords.length);
    while (options.length < maxOptions) {
        const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
        if (!options.find((opt) => opt.am === randomWord.am)) {
            options.push(randomWord);
        }
    }

    return shuffle(options);
}

/**
 * Creates translation-based quiz questions.
 * Each translation of a word becomes a separate question.
 * For example, if a word has 3 English translations, it creates 3 questions.
 */
export function createQuizQuestions(words: Word[], language: QuizLanguage): QuizQuestion[] {
    const questions: QuizQuestion[] = [];

    for (const word of words) {
        const translations = getTranslations(word, language);

        // Create a question for each translation
        for (const translation of translations) {
            questions.push({
                word,
                translation,
                options: generateQuizOptions(word, words),
            });
        }
    }

    // Shuffle questions so same word's translations aren't consecutive
    return shuffle(questions);
}
