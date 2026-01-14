// Armenian Language Learning App - Main TypeScript

interface Word {
    am: string;
    ru: string[];
    en: string[];
    spell?: string;
}

interface Vocabulary {
    [level: string]: Word[];
}

interface LevelStats {
    totalQuizzes: number;
    totalCorrect: number;
    totalQuestions: number;
}

interface UserStats {
    [level: string]: LevelStats;
}

interface QuizWord extends Word {
    options: Word[];
}

interface PostHog {
    identify: (id: string) => void;
    capture: (event: string, properties?: Record<string, unknown>) => void;
}

declare const posthog: PostHog | undefined;

// Global vocabulary data (loaded from JSON)
let vocabulary: Vocabulary | null = null;

// Function to get words by level
function getWordsByLevel(level: string): Word[] {
    return vocabulary?.[level] ? vocabulary[level] : [];
}

// Function to get random words from a specific level
function getRandomWords(level: string, count = 10): Word[] {
    const words = getWordsByLevel(level);
    const shuffled = [...words].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, words.length));
}

// Function to get all words from all levels (for quiz options)
function getAllWords(): Word[] {
    if (!vocabulary) return [];
    const allWords: Word[] = [];
    Object.values(vocabulary).forEach((levelWords) => {
        allWords.push(...levelWords);
    });
    return allWords;
}

class ArmenianLearningApp {
    currentLevel: string | null;
    quizLanguage: 'english' | 'russian';
    cardsCount: number;
    learningWords: Word[];
    currentWordIndex: number;
    quizWords: QuizWord[];
    currentQuizIndex: number;
    quizScore: number;
    userStats: UserStats;
    learntWords: string[];

    constructor() {
        this.currentLevel = null;
        this.quizLanguage = 'english';
        this.cardsCount = 10;
        this.learningWords = [];
        this.currentWordIndex = 0;
        this.quizWords = [];
        this.currentQuizIndex = 0;
        this.quizScore = 0;
        this.userStats = this.loadUserStats();
        this.learntWords = this.loadLearntWords();

        this.loadVocabulary();
    }

    async loadVocabulary(): Promise<void> {
        try {
            const response = await fetch('/static/vocabulary.json');
            if (!response.ok) {
                throw new Error(
                    `Failed to load vocabulary: ${response.status} ${response.statusText}`
                );
            }
            vocabulary = (await response.json()) as Vocabulary;
            this.initializeApp();
        } catch (error) {
            console.error('Error loading vocabulary:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'container';
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errorDiv.innerHTML = `<h1>Error</h1><p>Failed to load vocabulary data. Please refresh the page.</p><p style="color: red;">${errorMessage}</p>`;
            document.body.innerHTML = '';
            document.body.appendChild(errorDiv);
        }
    }

    initializeApp(): void {
        this.loadQuizLanguage();
        this.loadCardsCount();
        this.bindEvents();
        this.showLevelSelection();
        this.displayUserStats();
        this.setupIssueLink();
        this.initializeAnalytics();
    }

    loadQuizLanguage(): void {
        const savedLanguage = localStorage.getItem('armenianApp_quizLanguage');
        if (savedLanguage === 'english' || savedLanguage === 'russian') {
            this.quizLanguage = savedLanguage;
        }
    }

    loadCardsCount(): void {
        const savedCount = localStorage.getItem('armenianApp_cardsCount');
        if (savedCount) {
            const count = Number.parseInt(savedCount, 10);
            if (count > 0 && count <= 100) {
                this.cardsCount = count;
            }
        }
    }

    saveCardsCount(): void {
        localStorage.setItem('armenianApp_cardsCount', this.cardsCount.toString());
    }

    bindEvents(): void {
        // Level selection
        const levelButtons = document.querySelectorAll('.level-btn');
        levelButtons.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const level = (e.currentTarget as HTMLElement).dataset.level;
                if (level) {
                    this.selectLevel(level);
                }
            });
        });

        // Language selection
        document.querySelectorAll('.language-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const language = (e.target as HTMLElement).dataset.language;
                if (language === 'english' || language === 'russian') {
                    this.selectQuizLanguage(language);
                }
            });
        });

        // Cards count selection
        const cardsCountInput = document.getElementById('cards-count') as HTMLInputElement | null;
        if (cardsCountInput) {
            cardsCountInput.value = this.cardsCount.toString();
            cardsCountInput.addEventListener('change', (e) => {
                const value = Number.parseInt((e.target as HTMLInputElement).value, 10);
                if (value > 0 && value <= 100) {
                    this.cardsCount = value;
                    this.saveCardsCount();
                } else {
                    (e.target as HTMLInputElement).value = this.cardsCount.toString();
                }
            });
            cardsCountInput.addEventListener('input', (e) => {
                const value = Number.parseInt((e.target as HTMLInputElement).value, 10);
                if (value > 0 && value <= 100) {
                    this.cardsCount = value;
                    this.saveCardsCount();
                }
            });
        }

        // Reset progress button
        const resetBtn = document.getElementById('reset-progress');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetProgress();
            });
        }

        // Learning mode
        const nextWordBtn = document.getElementById('next-word');
        if (nextWordBtn) {
            nextWordBtn.addEventListener('click', () => {
                this.nextWord();
            });
        }

        const previousWordBtn = document.getElementById('previous-word');
        if (previousWordBtn) {
            previousWordBtn.addEventListener('click', () => {
                this.previousWord();
            });
        }

        const startQuizBtn = document.getElementById('start-quiz');
        if (startQuizBtn) {
            startQuizBtn.addEventListener('click', () => {
                this.startQuiz();
            });
        }

        // Quiz mode
        const restartBtn = document.getElementById('restart-app');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.restartApp();
            });
        }

        const changeLevelBtn = document.getElementById('change-level');
        if (changeLevelBtn) {
            changeLevelBtn.addEventListener('click', () => {
                this.showLevelSelection();
            });
        }
    }

    // Local Storage Management
    loadUserStats(): UserStats {
        const stats = localStorage.getItem('armenianLearningStats');
        return stats ? (JSON.parse(stats) as UserStats) : {};
    }

    saveUserStats(): void {
        localStorage.setItem('armenianLearningStats', JSON.stringify(this.userStats));
    }

    loadLearntWords(): string[] {
        const learnt = localStorage.getItem('armenianApp_learntWords');
        if (!learnt) return [];
        return learnt
            .split(',')
            .map((w) => w.trim())
            .filter(Boolean);
    }

    saveLearntWords(): void {
        localStorage.setItem('armenianApp_learntWords', this.learntWords.join(','));
    }

    isWordLearnt(word: Word): boolean {
        return this.learntWords.includes(word.am);
    }

    markWordAsLearnt(word: Word): void {
        const wordText = word.am;
        if (!this.learntWords.includes(wordText)) {
            this.learntWords.push(wordText);
            this.saveLearntWords();
        }
    }

    updateUserStats(level: string, score: number, total: number): void {
        if (!this.userStats[level]) {
            this.userStats[level] = { totalQuizzes: 0, totalCorrect: 0, totalQuestions: 0 };
        }

        this.userStats[level].totalQuizzes++;
        this.userStats[level].totalCorrect += score;
        this.userStats[level].totalQuestions += total;

        this.saveUserStats();
    }

    displayUserStats(): void {
        const statsContainer = document.getElementById('user-stats');
        if (!statsContainer) return;

        if (Object.keys(this.userStats).length === 0) {
            statsContainer.innerHTML = '<p>No previous learning history</p>';
            return;
        }

        let statsHTML = '<h4>Your Learning Progress</h4>';

        Object.entries(this.userStats).forEach(([level, stats]) => {
            const accuracy = ((stats.totalCorrect / stats.totalQuestions) * 100).toFixed(1);
            statsHTML += `
                <p><strong>${level}:</strong> ${stats.totalQuizzes} quizzes, ${accuracy}% accuracy</p>
            `;
        });

        statsContainer.innerHTML = statsHTML;
    }

    // Screen Management
    showScreen(screenId: string): void {
        document.querySelectorAll('.screen').forEach((screen) => {
            screen.classList.remove('active');
        });
        const screen = document.getElementById(screenId);
        if (!screen) {
            console.error('Screen not found:', screenId);
            return;
        }
        screen.classList.add('active');
    }

    showLevelSelection(): void {
        this.showScreen('level-selection');
        this.displayUserStats();
        // Reset screens to initial visibility
        const wordCard = document.querySelector('.word-card') as HTMLElement | null;
        if (wordCard) wordCard.style.display = 'block';
        const learningComplete = document.getElementById('learning-complete') as HTMLElement | null;
        if (learningComplete) learningComplete.style.display = 'none';
        const quizCard = document.querySelector('.quiz-card') as HTMLElement | null;
        if (quizCard) quizCard.style.display = 'block';
        const quizComplete = document.getElementById('quiz-complete') as HTMLElement | null;
        if (quizComplete) quizComplete.style.display = 'none';

        // Set the correct active language button
        document.querySelectorAll('.language-btn').forEach((btn) => {
            btn.classList.remove('active');
        });
        const activeLanguageBtn = document.querySelector(`[data-language="${this.quizLanguage}"]`);
        if (activeLanguageBtn) {
            activeLanguageBtn.classList.add('active');
        }

        // Set the correct cards count
        const cardsCountInput = document.getElementById('cards-count') as HTMLInputElement | null;
        if (cardsCountInput) {
            cardsCountInput.value = this.cardsCount.toString();
        }
    }

    // Level Selection
    selectLevel(level: string): void {
        this.currentLevel = level;
        this.startLearning();
    }

    // Language Selection for Quiz
    selectQuizLanguage(language: 'english' | 'russian'): void {
        this.quizLanguage = language;

        // Update active button
        document.querySelectorAll('.language-btn').forEach((btn) => {
            btn.classList.remove('active');
        });
        const activeBtn = document.querySelector(`[data-language="${language}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Save to localStorage
        localStorage.setItem('armenianApp_quizLanguage', language);
    }

    // Learning Mode
    startLearning(): void {
        if (!this.currentLevel) return;
        const allWords = getWordsByLevel(this.currentLevel);
        const unlearntWords = allWords.filter((word) => !this.isWordLearnt(word));
        const combined = [...unlearntWords, ...allWords];
        const uniqueByWord: Word[] = [];
        const seen = new Set<string>();
        combined.forEach((w) => {
            if (!seen.has(w.am)) {
                seen.add(w.am);
                uniqueByWord.push(w);
            }
        });
        const shuffled = [...uniqueByWord].sort(() => 0.5 - Math.random());
        this.learningWords = shuffled.slice(0, Math.min(this.cardsCount, shuffled.length));

        this.currentWordIndex = 0;
        this.showScreen('learning-mode');
        this.displayCurrentWord();
        this.updateLearningProgress();
    }

    displayCurrentWord(): void {
        if (this.currentWordIndex >= this.learningWords.length) {
            this.showLearningComplete();
            return;
        }

        const word = this.learningWords[this.currentWordIndex];
        const armenianWordEl = document.getElementById('armenian-word');
        if (armenianWordEl) {
            armenianWordEl.textContent = word.am;
        }

        const pronunciationElement = document.getElementById('pronunciation') as HTMLElement | null;
        if (pronunciationElement) {
            if (word.spell) {
                pronunciationElement.textContent = word.spell;
                pronunciationElement.style.display = 'block';
            } else {
                pronunciationElement.style.display = 'none';
            }
        }

        // Show ALL translations in learning mode (based on saved language preference)
        const translationData = this.quizLanguage === 'english' ? word.en : word.ru;
        let translationText: string;
        if (Array.isArray(translationData)) {
            translationText = translationData.join(', ');
        } else {
            translationText = translationData || '';
        }

        const languageLabel = this.quizLanguage === 'english' ? 'English' : 'Russian';
        const translationEl = document.getElementById('translation');
        if (translationEl) {
            translationEl.textContent = `${translationText} (${languageLabel})`;
        }

        this.updateNavigationButtons();
    }

    nextWord(): void {
        this.currentWordIndex++;
        this.displayCurrentWord();
        this.updateLearningProgress();
    }

    previousWord(): void {
        if (this.currentWordIndex > 0) {
            this.currentWordIndex--;
            this.displayCurrentWord();
            this.updateLearningProgress();
        }
    }

    updateNavigationButtons(): void {
        const previousBtn = document.getElementById('previous-word') as HTMLButtonElement | null;
        const nextBtn = document.getElementById('next-word') as HTMLButtonElement | null;

        if (previousBtn) {
            if (this.currentWordIndex === 0) {
                previousBtn.disabled = true;
                previousBtn.classList.add('disabled');
            } else {
                previousBtn.disabled = false;
                previousBtn.classList.remove('disabled');
            }
        }

        if (nextBtn) {
            if (this.currentWordIndex >= this.learningWords.length) {
                nextBtn.disabled = true;
                nextBtn.classList.add('disabled');
            } else {
                nextBtn.disabled = false;
                nextBtn.classList.remove('disabled');
            }
        }
    }

    updateLearningProgress(): void {
        const current = Math.min(this.currentWordIndex + 1, this.learningWords.length);
        const progress = (current / this.learningWords.length) * 100;
        const progressEl = document.getElementById('learning-progress') as HTMLElement | null;
        if (progressEl) {
            progressEl.style.width = `${progress}%`;
        }
        const progressTextEl = document.getElementById('learning-progress-text');
        if (progressTextEl) {
            progressTextEl.textContent = `${current} / ${this.learningWords.length}`;
        }
        const learningCount = document.getElementById('learning-count');
        if (learningCount) {
            learningCount.textContent = `${current} / ${this.learningWords.length}`;
        }
        this.updateNavigationButtons();
    }

    showLearningComplete(): void {
        const wordCard = document.querySelector('.word-card') as HTMLElement | null;
        if (wordCard) wordCard.style.display = 'none';
        const completeText = document.getElementById('learning-complete-text');
        if (completeText) {
            completeText.textContent = `You've studied ${this.learningWords.length} words. Ready for the quiz?`;
        }
        const learningComplete = document.getElementById('learning-complete') as HTMLElement | null;
        if (learningComplete) learningComplete.style.display = 'block';
    }

    // Quiz Mode
    startQuiz(): void {
        // Create quiz questions from learned words
        this.quizWords = this.createQuizQuestions();
        this.currentQuizIndex = 0;
        this.quizScore = 0;

        this.showScreen('quiz-mode');
        this.displayQuizQuestion();
        this.updateQuizProgress();
    }

    createQuizQuestions(): QuizWord[] {
        return this.learningWords.map((word) => ({
            ...word,
            options: this.generateQuizOptions(word),
        }));
    }

    generateQuizOptions(correctWord: Word): Word[] {
        const allWords = getAllWords();
        const options: Word[] = [correctWord];

        // Add random incorrect options
        while (options.length < Math.min(10, allWords.length)) {
            const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
            if (!options.find((opt) => opt.am === randomWord.am)) {
                options.push(randomWord);
            }
        }

        // Shuffle options
        return options.sort(() => 0.5 - Math.random());
    }

    displayQuizQuestion(): void {
        if (this.currentQuizIndex >= this.quizWords.length) {
            this.showQuizComplete();
            return;
        }

        const question = this.quizWords[this.currentQuizIndex];
        const translationData = this.quizLanguage === 'english' ? question.en : question.ru;

        // For quiz, use only ONE translation (randomly pick from array)
        let translation: string;
        if (Array.isArray(translationData) && translationData.length > 0) {
            translation = translationData[Math.floor(Math.random() * translationData.length)];
        } else {
            translation = '';
        }

        const translationQuestionEl = document.getElementById('translation-question');
        if (translationQuestionEl) {
            translationQuestionEl.textContent = translation;
        }

        const optionsContainer = document.getElementById('quiz-options');
        if (!optionsContainer) return;
        optionsContainer.innerHTML = '';

        question.options.forEach((option) => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option.am;
            button.addEventListener('click', () => {
                this.selectQuizOption(option, question, button);
            });
            optionsContainer.appendChild(button);
        });
    }

    selectQuizOption(
        selectedOption: Word,
        correctQuestion: QuizWord,
        clickedButton: HTMLButtonElement
    ): void {
        const isCorrect = selectedOption.am === correctQuestion.am;

        // Disable all buttons
        document.querySelectorAll('.option-btn').forEach((btn) => {
            btn.classList.add('disabled');
            (btn as HTMLButtonElement).disabled = true;
        });

        // Highlight correct and incorrect answers
        document.querySelectorAll('.option-btn').forEach((btn) => {
            if (btn.textContent === correctQuestion.am) {
                btn.classList.add('correct');
            } else if (btn === clickedButton && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });

        if (isCorrect) {
            this.quizScore++;
            this.markWordAsLearnt(correctQuestion);
        }

        // Auto-advance to next question after 1 second
        setTimeout(() => {
            this.currentQuizIndex++;
            this.displayQuizQuestion();
            this.updateQuizProgress();
        }, 1000);
    }

    updateQuizProgress(): void {
        const progress = (this.currentQuizIndex / this.quizWords.length) * 100;
        const progressEl = document.getElementById('quiz-progress') as HTMLElement | null;
        if (progressEl) {
            progressEl.style.width = `${progress}%`;
        }
        const progressTextEl = document.getElementById('quiz-progress-text');
        if (progressTextEl) {
            progressTextEl.textContent = `${this.currentQuizIndex + 1} / ${this.quizWords.length}`;
        }
        const quizCorrect = document.getElementById('quiz-correct-count');
        if (quizCorrect) {
            quizCorrect.textContent = `${this.quizScore} / ${this.quizWords.length}`;
        }
    }

    showQuizComplete(): void {
        const quizCard = document.querySelector('.quiz-card') as HTMLElement | null;
        if (quizCard) quizCard.style.display = 'none';
        const quizComplete = document.getElementById('quiz-complete') as HTMLElement | null;
        if (quizComplete) quizComplete.style.display = 'block';

        const percentage = Math.round((this.quizScore / this.quizWords.length) * 100);
        const finalScoreEl = document.getElementById('final-score');
        if (finalScoreEl) {
            finalScoreEl.textContent = `Score: ${this.quizScore}/${this.quizWords.length} (${percentage}%)`;
        }

        // Update user statistics
        if (this.currentLevel) {
            this.updateUserStats(this.currentLevel, this.quizScore, this.quizWords.length);
        }

        // Track quiz completion event
        if (this.currentLevel) {
            this.trackQuizComplete(
                this.currentLevel,
                this.quizScore,
                this.quizWords.length,
                percentage
            );
        }
    }

    resetProgress(): void {
        if (
            confirm(
                'Are you sure you want to reset all progress? This will clear all learnt words and statistics.'
            )
        ) {
            localStorage.removeItem('armenianApp_learntWords');
            localStorage.removeItem('armenianLearningStats');
            this.learntWords = [];
            this.userStats = {};
            this.showLevelSelection();
        }
    }

    // App Navigation
    restartApp(): void {
        // Reset learning state
        this.currentWordIndex = 0;
        this.currentQuizIndex = 0;
        this.quizScore = 0;

        // Reset UI elements
        const wordCard = document.querySelector('.word-card') as HTMLElement | null;
        if (wordCard) wordCard.style.display = 'block';
        const learningComplete = document.getElementById('learning-complete') as HTMLElement | null;
        if (learningComplete) learningComplete.style.display = 'none';
        const quizCard = document.querySelector('.quiz-card') as HTMLElement | null;
        if (quizCard) quizCard.style.display = 'block';
        const quizComplete = document.getElementById('quiz-complete') as HTMLElement | null;
        if (quizComplete) quizComplete.style.display = 'none';

        // Start new learning session with same level
        this.startLearning();
    }

    // GitHub Issue Reporting
    setupIssueLink(): void {
        const issueLink = document.getElementById('report-issue-link');
        if (issueLink) {
            issueLink.addEventListener('click', (e) => {
                e.preventDefault();
                const issueUrl = this.generateIssueUrl();
                window.open(issueUrl, '_blank', 'noopener,noreferrer');
            });
        }
    }

    generateIssueUrl(): string {
        const repoUrl = 'https://github.com/AlexanderMakarov/armenian-words';
        const title = encodeURIComponent('Issue Report');

        // Collect cache settings
        const cacheSettings = this.getCacheSettings();
        const cacheSettingsText = this.formatCacheSettings(cacheSettings);

        const body = encodeURIComponent(`## Problem Description
<!-- Please explain the problem you encountered (опишите проблему): -->

---

## Translation Issue (if applicable)

- **Armenian word (армянский слово):** 
- **Correct translation (English):** 
- **Верный перевод (Russian):** 
- **Pronunciation (произношение):** 

---

## Settings (don't edit this section)

\`\`\`
${cacheSettingsText}
\`\`\`
`);

        return `${repoUrl}/issues/new?title=${title}&body=${body}`;
    }

    getCacheSettings(): Record<string, unknown> {
        const settings: Record<string, unknown> = {};

        // Quiz language preference
        const quizLanguage = localStorage.getItem('armenianApp_quizLanguage');
        if (quizLanguage) {
            settings.quizLanguage = quizLanguage;
        }

        // Cards count
        const cardsCount = localStorage.getItem('armenianApp_cardsCount');
        if (cardsCount) {
            settings.cardsCount = cardsCount;
        }

        // User statistics
        const stats = localStorage.getItem('armenianLearningStats');
        if (stats) {
            try {
                settings.userStats = JSON.parse(stats);
            } catch (e) {
                settings.userStats = 'Error parsing stats';
            }
        }

        // Learnt words count
        const learntWords = localStorage.getItem('armenianApp_learntWords');
        if (learntWords) {
            const wordsArray = learntWords.split(',').filter((w) => w.trim());
            settings.learntWordsCount = wordsArray.length;
        }

        // Current level (if available)
        if (this.currentLevel) {
            settings.currentLevel = this.currentLevel;
        }

        return settings;
    }

    formatCacheSettings(settings: Record<string, unknown>): string {
        let text = 'Cache Settings:\n';
        text += `- Quiz Language: ${settings.quizLanguage || 'not set'}\n`;
        text += `- Cards Count: ${settings.cardsCount || 'not set'}\n`;
        text += `- Current Level: ${settings.currentLevel || 'not set'}\n`;
        text += `- Learnt Words Count: ${settings.learntWordsCount || 0}\n`;

        if (settings.userStats && typeof settings.userStats === 'object') {
            text += '- User Statistics:\n';
            Object.entries(settings.userStats as Record<string, LevelStats>).forEach(
                ([level, stats]) => {
                    const accuracy =
                        stats.totalQuestions > 0
                            ? ((stats.totalCorrect / stats.totalQuestions) * 100).toFixed(1)
                            : '0.0';
                    text += `  * ${level}: ${stats.totalQuizzes} quizzes, ${accuracy}% accuracy\n`;
                }
            );
        }

        return text;
    }

    // Analytics Methods
    getUserID(): string {
        let userID = localStorage.getItem('armenianApp_userID');
        if (!userID) {
            userID = new Date().toISOString();
            localStorage.setItem('armenianApp_userID', userID);
        }
        return userID;
    }

    initializeAnalytics(): void {
        if (typeof posthog === 'undefined') {
            console.warn('PostHog not loaded - analytics disabled');
            return;
        }

        const userID = this.getUserID();
        const isFirstVisit = !localStorage.getItem('armenianApp_firstVisitTracked');

        posthog.identify(userID);

        if (isFirstVisit) {
            posthog.capture('app_opened', {});
            localStorage.setItem('armenianApp_firstVisitTracked', 'true');
        }
    }

    trackQuizComplete(level: string, score: number, total: number, percentage: number): void {
        if (typeof posthog === 'undefined') {
            return;
        }

        const progressByLevel: Record<string, { quizzes: number; accuracy: number }> = {};
        Object.keys(this.userStats).forEach((lvl) => {
            const stats = this.userStats[lvl];
            const accuracy =
                stats.totalQuestions > 0
                    ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100)
                    : 0;
            progressByLevel[lvl] = {
                quizzes: stats.totalQuizzes,
                accuracy: accuracy,
            };
        });

        posthog.capture('quiz_completed', {
            level: level,
            progress_by_level: progressByLevel,
            learnt_words: this.learntWords.length,
            language: this.quizLanguage,
            cards_count: this.cardsCount,
        });
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ArmenianLearningApp();
});
