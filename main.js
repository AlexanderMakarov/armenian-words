// Armenian Language Learning App - Main JavaScript

class ArmenianLearningApp {
    constructor() {
        this.currentLevel = null;
        this.quizLanguage = 'english'; // Default to English
        this.learningWords = [];
        this.currentWordIndex = 0;
        this.quizWords = [];
        this.currentQuizIndex = 0;
        this.quizScore = 0;
        this.userStats = this.loadUserStats();
        
        this.initializeApp();
    }

    initializeApp() {
        this.loadQuizLanguage();
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

    bindEvents() {
        // Level selection
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectLevel(e.target.dataset.level);
            });
        });

        // Language selection
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectQuizLanguage(e.target.dataset.language);
            });
        });

        // Learning mode
        document.getElementById('next-word').addEventListener('click', () => {
            this.nextWord();
        });

        document.getElementById('start-quiz').addEventListener('click', () => {
            this.startQuiz();
        });

        // Quiz mode
        document.getElementById('restart-app').addEventListener('click', () => {
            this.restartApp();
        });

        document.getElementById('change-level').addEventListener('click', () => {
            this.showLevelSelection();
        });
    }

    // Local Storage Management
    loadUserStats() {
        const stats = localStorage.getItem('armenianLearningStats');
        return stats ? JSON.parse(stats) : {};
    }

    saveUserStats() {
        localStorage.setItem('armenianLearningStats', JSON.stringify(this.userStats));
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
        document.getElementById(screenId).classList.add('active');
    }

    showLevelSelection() {
        this.showScreen('level-selection');
        this.displayUserStats();
        
        // Set the correct active language button
        document.querySelectorAll('.language-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-language="${this.quizLanguage}"]`).classList.add('active');
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
        this.learningWords = getRandomWords(this.currentLevel, 10);
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
        document.getElementById('armenian-word').textContent = word.armenian;
        
        // Handle both string and array translations
        const englishText = Array.isArray(word.english) ? word.english.join(', ') : word.english;
        const russianText = Array.isArray(word.russian) ? word.russian.join(', ') : word.russian;
        
        document.getElementById('translation').textContent = 
            `${englishText} (English) / ${russianText} (Russian)`;
    }

    nextWord() {
        this.currentWordIndex++;
        this.displayCurrentWord();
        this.updateLearningProgress();
    }

    updateLearningProgress() {
        const progress = ((this.currentWordIndex + 1) / this.learningWords.length) * 100;
        document.getElementById('learning-progress').style.width = `${progress}%`;
        document.getElementById('learning-progress-text').textContent = 
            `${this.currentWordIndex + 1} / ${this.learningWords.length}`;
    }

    showLearningComplete() {
        document.querySelector('.word-card').style.display = 'none';
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
        // Filter words that have unique definitions to avoid ambiguity
        const uniqueWords = this.learningWords.filter((word, index, arr) => {
            return arr.findIndex(w => w.definition === word.definition) === index;
        });
        
        return uniqueWords.map(word => ({
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
            if (!options.find(opt => opt.armenian === randomWord.armenian)) {
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
        const translationData = this.quizLanguage === 'english' ? question.english : question.russian;
        
        // Handle both string and array translations
        let translation;
        if (Array.isArray(translationData)) {
            // For quiz, randomly pick one translation from the array
            translation = translationData[Math.floor(Math.random() * translationData.length)];
        } else {
            translation = translationData;
        }
        
        document.getElementById('translation-question').textContent = translation;
        
        const optionsContainer = document.getElementById('quiz-options');
        optionsContainer.innerHTML = '';
        
        question.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            button.textContent = option.armenian;
            button.addEventListener('click', () => {
                this.selectQuizOption(option, question, button);
            });
            optionsContainer.appendChild(button);
        });
    }

    selectQuizOption(selectedOption, correctQuestion, clickedButton) {
        const isCorrect = selectedOption.armenian === correctQuestion.armenian;
        
        // Disable all buttons
        document.querySelectorAll('.option-btn').forEach(btn => {
            btn.classList.add('disabled');
            btn.disabled = true;
        });
        
        // Highlight correct and incorrect answers
        document.querySelectorAll('.option-btn').forEach(btn => {
            if (btn.textContent === correctQuestion.armenian) {
                btn.classList.add('correct');
            } else if (btn === clickedButton && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });
        
        if (isCorrect) {
            this.quizScore++;
        }
        
        // Auto-advance to next question after 2 seconds
        setTimeout(() => {
            this.currentQuizIndex++;
            this.displayQuizQuestion();
            this.updateQuizProgress();
        }, 2000);
    }

    updateQuizProgress() {
        const progress = (this.currentQuizIndex / this.quizWords.length) * 100;
        document.getElementById('quiz-progress').style.width = `${progress}%`;
        document.getElementById('quiz-progress-text').textContent = 
            `${this.currentQuizIndex + 1} / ${this.quizWords.length}`;
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