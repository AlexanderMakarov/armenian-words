export interface Word {
    am: string;
    ru: string[];
    en: string[];
    spell?: string;
    ogg_url?: string;
}

export interface Vocabulary {
    [level: string]: Word[];
}

export interface LevelStats {
    totalQuizzes: number;
    totalCorrect: number;
    totalQuestions: number;
}

export interface UserStats {
    [level: string]: LevelStats;
}

/** @deprecated Use QuizQuestion instead */
export interface QuizWord extends Word {
    options: Word[];
}

export interface QuizQuestion {
    word: Word; // The original word being tested
    translation: string; // The specific translation being tested
    options: Word[]; // Answer options (Armenian words to choose from)
}

export type QuizLanguage = 'english' | 'russian';
