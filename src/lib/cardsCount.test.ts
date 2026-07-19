import { describe, expect, test } from 'bun:test';
import { MAX_CARDS_COUNT, MIN_CARDS_COUNT, parseCardsCount } from './cardsCount.js';

describe('parseCardsCount', () => {
    test('accepts integers in range', () => {
        expect(parseCardsCount('1')).toBe(MIN_CARDS_COUNT);
        expect(parseCardsCount('10')).toBe(10);
        expect(parseCardsCount('100')).toBe(MAX_CARDS_COUNT);
        expect(parseCardsCount(' 7 ')).toBe(7);
    });

    test('rejects empty and non-numeric values', () => {
        expect(parseCardsCount('')).toBeNull();
        expect(parseCardsCount('   ')).toBeNull();
        expect(parseCardsCount('abc')).toBeNull();
        expect(parseCardsCount('1.5')).toBeNull();
        expect(parseCardsCount('-1')).toBeNull();
        expect(parseCardsCount('+3')).toBeNull();
        expect(parseCardsCount('3e1')).toBeNull();
    });

    test('rejects zero and out-of-range values', () => {
        expect(parseCardsCount('0')).toBeNull();
        expect(parseCardsCount('101')).toBeNull();
        expect(parseCardsCount('999')).toBeNull();
    });

    test('rejects leading zeros that are not a plain positive integer string path', () => {
        // "01" is still a valid decimal integer 1
        expect(parseCardsCount('01')).toBe(1);
        expect(parseCardsCount('00')).toBeNull();
    });
});
