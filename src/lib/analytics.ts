import posthog, { DisplaySurveyType } from 'posthog-js';
import { browser } from '$app/environment';

const POSTHOG_KEY = 'phc_INrsG7cXvOhizqKzRnJaj1nx1wG7Y6MfzMRnuh0sBLs';
const POSTHOG_HOST = 'https://eu.i.posthog.com';
const STORAGE_PREFIX = 'armenianApp_';

let initialized = false;

export function initAnalytics(): void {
    if (!browser || initialized) return;

    posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        defaults: '2025-11-30',
    });

    const userID = getUserID();
    posthog.identify(userID);

    const isFirstVisit = !localStorage.getItem(`${STORAGE_PREFIX}firstVisitTracked`);
    if (isFirstVisit) {
        posthog.capture('app_opened', {});
        localStorage.setItem(`${STORAGE_PREFIX}firstVisitTracked`, 'true');
    }

    initialized = true;
}

function getUserID(): string {
    const key = `${STORAGE_PREFIX}userID`;
    let userID = localStorage.getItem(key);
    if (!userID) {
        userID = new Date().toISOString();
        localStorage.setItem(key, userID);
    }
    return userID;
}

export function trackQuizComplete(
    level: string,
    progressByLevel: Record<string, { quizzes: number; accuracy: number }>,
    learntWordsCount: number,
    language: string,
    cardsCount: number
): void {
    if (!browser || !initialized) return;

    posthog.capture('quiz_completed', {
        level,
        progress_by_level: progressByLevel,
        learnt_words: learntWordsCount,
        language,
        cards_count: cardsCount,
    });
}

// Survey ID - create this survey in PostHog dashboard
const FEEDBACK_SURVEY_ID = 'feedback-survey';

export interface FeedbackContext {
    pageUrl: string;
    pagePath: string;
    word?: string;
    level?: string;
    quizLanguage: string;
    cardsCount: number;
    learntWordsCount: number;
}

export function showFeedbackSurvey(context: FeedbackContext): void {
    if (!browser || !initialized) return;

    // Register context as properties so they're included with survey responses
    posthog.register({
        feedback_page_url: context.pageUrl,
        feedback_page_path: context.pagePath,
        feedback_word: context.word || null,
        feedback_level: context.level || null,
        feedback_quiz_language: context.quizLanguage,
        feedback_cards_count: context.cardsCount,
        feedback_learnt_words_count: context.learntWordsCount,
    });

    // Display the survey popover
    posthog.displaySurvey(FEEDBACK_SURVEY_ID, {
        displayType: DisplaySurveyType.Popover,
        ignoreConditions: true,
        ignoreDelay: true,
    });
}
