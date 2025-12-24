// Armenian Language Learning App - Main JavaScript

// Global vocabulary data (loaded from JSON)
let vocabulary = null;

// Function to get words by level
function getWordsByLevel(level) {
    return vocabulary && vocabulary[level] ? vocabulary[level] : [];
}

// Function to get random words from a specific level
function getRandomWords(level, count = 10) {
    const words = getWordsByLevel(level);
    const shuffled = [...words].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, words.length));
}

// Function to get all words from all levels (for quiz options)
function getAllWords() {
    if (!vocabulary) return [];
    const allWords = [];
    Object.values(vocabulary).forEach(levelWords => {
        allWords.push(...levelWords);
    });
    return allWords;
}

class ArmenianLearningApp {
    constructor() {
        this.currentLevel = null;
        this.quizLanguage = 'english'; // Default to English
        this.cardsCount = 10; // Default number of cards
        this.learningWords = [];
        this.currentWordIndex = 0;
        this.quizWords = [];
        this.currentQuizIndex = 0;
        this.quizScore = 0;
        this.userStats = this.loadUserStats();
        this.learntWords = this.loadLearntWords();
        
        this.loadVocabulary();
    }

    async loadVocabulary() {
        try {
            const response = await fetch('vocabulary.json');
            if (!response.ok) {
                throw new Error(`Failed to load vocabulary: ${response.status} ${response.statusText}`);
            }
            vocabulary = await response.json();
            this.initializeApp();
        } catch (error) {
            console.error('Error loading vocabulary:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = 'container';
            errorDiv.innerHTML = '<h1>Error</h1><p>Failed to load vocabulary data. Please refresh the page.</p><p style="color: red;">' + error.message + '</p>';
            document.body.innerHTML = '';
            document.body.appendChild(errorDiv);
        }
    }

    initializeApp() {
        this.loadQuizLanguage();
        this.loadCardsCount();
        this.bindEvents();
        this.showLevelSelection();
        this.displayUserStats();
    }

    loadQuizLanguage() {
        const savedLanguage = localStorage.getItem('armenianApp_quizLanguage');
        if (savedLanguage) {
            this.quizLanguage = savedLanguage;
        }
    }

    loadCardsCount() {
        const savedCount = localStorage.getItem('armenianApp_cardsCount');
        if (savedCount) {
            this.cardsCount = parseInt(savedCount, 10);
        }
    }

    saveCardsCount() {
        localStorage.setItem('armenianApp_cardsCount', this.cardsCount.toString());
    }

    bindEvents() {
        // Level selection
        const levelButtons = document.querySelectorAll('.level-btn');
        levelButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const level = e.currentTarget.dataset.level;
                if (level) {
                    this.selectLevel(level);
                }
            });
        });

        // Language selection
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectQuizLanguage(e.target.dataset.language);
            });
        });

        // Cards count selection
        const cardsCountInput = document.getElementById('cards-count');
        if (cardsCountInput) {
            cardsCountInput.value = this.cardsCount.toString();
            cardsCountInput.addEventListener('change', (e) => {
                const value = parseInt(e.target.value, 10);
                if (value > 0 && value <= 100) {
                    this.cardsCount = value;
                    this.saveCardsCount();
                } else {
                    e.target.value = this.cardsCount.toString();
                }
            });
            cardsCountInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value, 10);
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
    loadUserStats() {
        const stats = localStorage.getItem('armenianLearningStats');
        return stats ? JSON.parse(stats) : {};
    }

    saveUserStats() {
        localStorage.setItem('armenianLearningStats', JSON.stringify(this.userStats));
    }

    loadLearntWords() {
        const learnt = localStorage.getItem('armenianApp_learntWords');
        if (!learnt) return [];
        return learnt.split(',').map(w => w.trim()).filter(Boolean);
    }

    saveLearntWords() {
        localStorage.setItem('armenianApp_learntWords', this.learntWords.join(','));
    }

    isWordLearnt(word) {
        return this.learntWords.includes(word.am);
    }

    markWordAsLearnt(word) {
        const wordText = word.am;
        if (!this.learntWords.includes(wordText)) {
            this.learntWords.push(wordText);
            this.saveLearntWords();
        }
    }

    updateUserStats(level, score, total) {
        if (!this.userStats[level]) {
            this.userStats[level] = { totalQuizzes: 0, totalCorrect: 0, totalQuestions: 0 };
        }
        
        this.userStats[level].totalQuizzes++;
        this.userStats[level].totalCorrect += score;
        this.userStats[level].totalQuestions += total;
        
        this.saveUserStats();
    }

    displayUserStats() {
        const statsContainer = document.getElementById('user-stats');
        
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
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const screen = document.getElementById(screenId);
        if (!screen) {
            console.error('Screen not found:', screenId);
            return;
        }
        screen.classList.add('active');
    }

    showLevelSelection() {
        this.showScreen('level-selection');
        this.displayUserStats();
        // Reset screens to initial visibility
        const wordCard = document.querySelector('.word-card');
        if (wordCard) wordCard.style.display = 'block';
        const learningComplete = document.getElementById('learning-complete');
        if (learningComplete) learningComplete.style.display = 'none';
        const quizCard = document.querySelector('.quiz-card');
        if (quizCard) quizCard.style.display = 'block';
        const quizComplete = document.getElementById('quiz-complete');
        if (quizComplete) quizComplete.style.display = 'none';
        
        // Set the correct active language button
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-language="${this.quizLanguage}"]`).classList.add('active');
        
        // Set the correct cards count
        const cardsCountInput = document.getElementById('cards-count');
        if (cardsCountInput) {
            cardsCountInput.value = this.cardsCount.toString();
        }
    }

    // Level Selection
    selectLevel(level) {
        this.currentLevel = level;
        this.startLearning();
    }

    // Language Selection for Quiz
    selectQuizLanguage(language) {
        this.quizLanguage = language;
        
        // Update active button
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-language="${language}"]`).classList.add('active');
        
        // Save to localStorage
        localStorage.setItem('armenianApp_quizLanguage', language);
    }

    // Learning Mode
    startLearning() {
        const allWords = getWordsByLevel(this.currentLevel);
        const unlearntWords = allWords.filter(word => !this.isWordLearnt(word));
        const combined = [...unlearntWords, ...allWords];
        const uniqueByWord = [];
        const seen = new Set();
        combined.forEach(w => {
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

    displayCurrentWord() {
        if (this.currentWordIndex >= this.learningWords.length) {
            this.showLearningComplete();
            return;
        }

        const word = this.learningWords[this.currentWordIndex];
        document.getElementById('armenian-word').textContent = word.am;
        
        // Show ALL translations in learning mode (based on saved language preference)
        const translationData = this.quizLanguage === 'english' ? word.en : word.ru;
        let translationText;
        if (Array.isArray(translationData)) {
            translationText = translationData.join(', ');
        } else {
            translationText = translationData || '';
        }
        
        const languageLabel = this.quizLanguage === 'english' ? 'English' : 'Russian';
        document.getElementById('translation').textContent = `${translationText} (${languageLabel})`;
    }

    nextWord() {
        this.currentWordIndex++;
        this.displayCurrentWord();
        this.updateLearningProgress();
    }

    updateLearningProgress() {
        const current = Math.min(this.currentWordIndex + 1, this.learningWords.length);
        const progress = (current / this.learningWords.length) * 100;
        document.getElementById('learning-progress').style.width = `${progress}%`;
        document.getElementById('learning-progress-text').textContent = 
            `${current} / ${this.learningWords.length}`;
        const learningCount = document.getElementById('learning-count');
        if (learningCount) {
            learningCount.textContent = `${current} / ${this.learningWords.length}`;
        }
    }

    showLearningComplete() {
        document.querySelector('.word-card').style.display = 'none';
        const completeText = document.getElementById('learning-complete-text');
        completeText.textContent = `You've studied ${this.learningWords.length} words. Ready for the quiz?`;
        document.getElementById('learning-complete').style.display = 'block';
    }

    // Quiz Mode
    startQuiz() {
        // Create quiz questions from learned words
        this.quizWords = this.createQuizQuestions();
        this.currentQuizIndex = 0;
        this.quizScore = 0;
        
        this.showScreen('quiz-mode');
        this.displayQuizQuestion();
        this.updateQuizProgress();
    }

    createQuizQuestions() {
        return this.learningWords.map(word => ({
            ...word,
            options: this.generateQuizOptions(word)
        }));
    }

    generateQuizOptions(correctWord) {
        const allWords = getAllWords();
        const options = [correctWord];
        
        // Add random incorrect options
        while (options.length < Math.min(10, allWords.length)) {
            const randomWord = allWords[Math.floor(Math.random() * allWords.length)];
            if (!options.find(opt => opt.am === randomWord.am)) {
                options.push(randomWord);
            }
        }
        
        // Shuffle options
        return options.sort(() => 0.5 - Math.random());
    }

    displayQuizQuestion() {
        if (this.currentQuizIndex >= this.quizWords.length) {
            this.showQuizComplete();
            return;
        }

        const question = this.quizWords[this.currentQuizIndex];
        const translationData = this.quizLanguage === 'english' ? question.en : question.ru;
        
        // For quiz, use only ONE translation (randomly pick from array)
        let translation;
        if (Array.isArray(translationData) && translationData.length > 0) {
            translation = translationData[Math.floor(Math.random() * translationData.length)];
        } else if (translationData) {
            translation = translationData;
        } else {
            translation = '';
        }
        
        document.getElementById('translation-question').textContent = translation;
        
        const optionsContainer = document.getElementById('quiz-options');
        optionsContainer.innerHTML = '';
        
        question.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option.am;
            button.addEventListener('click', () => {
                this.selectQuizOption(option, question, button);
            });
            optionsContainer.appendChild(button);
        });
    }

    selectQuizOption(selectedOption, correctQuestion, clickedButton) {
        const isCorrect = selectedOption.am === correctQuestion.am;
        
        // Disable all buttons
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.add('disabled');
            btn.disabled = true;
        });
        
        // Highlight correct and incorrect answers
        document.querySelectorAll('.option-btn').forEach(btn => {
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
        
        // Auto-advance to next question after 2 seconds
        setTimeout(() => {
            this.currentQuizIndex++;
            this.displayQuizQuestion();
            this.updateQuizProgress();
        }, 1000);
    }

    updateQuizProgress() {
        const progress = (this.currentQuizIndex / this.quizWords.length) * 100;
        document.getElementById('quiz-progress').style.width = `${progress}%`;
        document.getElementById('quiz-progress-text').textContent = 
            `${this.currentQuizIndex + 1} / ${this.quizWords.length}`;
        const quizCorrect = document.getElementById('quiz-correct-count');
        if (quizCorrect) {
            quizCorrect.textContent = `${this.quizScore} / ${this.quizWords.length}`;
        }
    }

    showQuizComplete() {
        document.querySelector('.quiz-card').style.display = 'none';
        document.getElementById('quiz-complete').style.display = 'block';
        
        const percentage = Math.round((this.quizScore / this.quizWords.length) * 100);
        document.getElementById('final-score').textContent = 
            `Score: ${this.quizScore}/${this.quizWords.length} (${percentage}%)`;
        
        // Update user statistics
        this.updateUserStats(this.currentLevel, this.quizScore, this.quizWords.length);
    }

    resetProgress() {
        if (confirm('Are you sure you want to reset all progress? This will clear all learnt words and statistics.')) {
            localStorage.removeItem('armenianApp_learntWords');
            localStorage.removeItem('armenianLearningStats');
            this.learntWords = [];
            this.userStats = {};
            this.showLevelSelection();
        }
    }

    // App Navigation
    restartApp() {
        // Reset learning state
        this.currentWordIndex = 0;
        this.currentQuizIndex = 0;
        this.quizScore = 0;
        
        // Reset UI elements
        document.querySelector('.word-card').style.display = 'block';
        document.getElementById('learning-complete').style.display = 'none';
        document.querySelector('.quiz-card').style.display = 'block';
        document.getElementById('quiz-complete').style.display = 'none';
        
        // Start new learning session with same level
        this.startLearning();
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ArmenianLearningApp();
});