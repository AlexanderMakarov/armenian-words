export interface Word {
    am: string;
    ru: string[];
    en: string[];
    spell?: string;
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

export interface QuizWord extends Word {
    options: Word[];
}

export type QuizLanguage = 'english' | 'russian';
