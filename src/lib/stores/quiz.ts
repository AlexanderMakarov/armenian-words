import { get, writable } from 'svelte/store';
import type { QuizWord, Word } from '$lib/types.js';

// Session state - not persisted to localStorage
export const currentLevel = writable<string | null>(null);
export const learningWords = writable<Word[]>([]);
export const currentWordIndex = writable<number>(0);

// Quiz state
export const quizWords = writable<QuizWord[]>([]);
export const currentQuizIndex = writable<number>(0);
export const quizScore = writable<number>(0);

export function resetLearningSession() {
    currentWordIndex.set(0);
}

export function resetQuizSession() {
    quizWords.set([]);
    currentQuizIndex.set(0);
    quizScore.set(0);
}

export function generateQuizOptions(correctWord: Word, allWords: Word[]): Word[] {
    const options: Word[] = [correctWord];

    // Add random incorrect options from learning words
    while (options.length < Math.min(10, allWords.length)) {
        const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
        if (!options.find((opt) => opt.am === randomWord.am)) {
            options.push(randomWord);
        }
    }

    // Shuffle options
    return options.sort(() => 0.5 - Math.random());
}

export function createQuizQuestions(words: Word[]): QuizWord[] {
    return words.map((word) => ({
        ...word,
        options: generateQuizOptions(word, words),
    }));
}
