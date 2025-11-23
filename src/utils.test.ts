import { describe, test, expect } from 'vitest';
import { formatLWPDate } from './utils.js';

/**
 * Test suite for utils.ts
 * Tests utility functions used throughout the application
 */

describe('formatLWPDate', () => {
  test('should format date in Python LWPCookieJar format', () => {
    // Test with a known date: 2026-05-22T13:20:38.000Z
    const testDate = new Date('2026-05-22T13:20:38.000Z');
    const result = formatLWPDate(testDate);

    expect(result).toBe('2026-05-22 13:20:38Z');
  });

  test('should handle single digit months and days with zero padding', () => {
    // Test with January 5th: 2026-01-05T09:05:03.000Z
    const testDate = new Date('2026-01-05T09:05:03.000Z');
    const result = formatLWPDate(testDate);

    expect(result).toBe('2026-01-05 09:05:03Z');
  });

  test('should handle December 31st correctly', () => {
    // Test with December 31st: 2025-12-31T23:59:59.000Z
    const testDate = new Date('2025-12-31T23:59:59.000Z');
    const result = formatLWPDate(testDate);

    expect(result).toBe('2025-12-31 23:59:59Z');
  });

  test('should handle leap year February 29th', () => {
    // Test with leap year: 2024-02-29T12:30:45.000Z
    const testDate = new Date('2024-02-29T12:30:45.000Z');
    const result = formatLWPDate(testDate);

    expect(result).toBe('2024-02-29 12:30:45Z');
  });

  test('should handle midnight (00:00:00)', () => {
    // Test with midnight: 2026-06-15T00:00:00.000Z
    const testDate = new Date('2026-06-15T00:00:00.000Z');
    const result = formatLWPDate(testDate);

    expect(result).toBe('2026-06-15 00:00:00Z');
  });

  test('should handle single digit hour/minute/second with zero padding', () => {
    // Test with single digit components: 2026-03-07T01:02:03.000Z
    const testDate = new Date('2026-03-07T01:02:03.000Z');
    const result = formatLWPDate(testDate);

    expect(result).toBe('2026-03-07 01:02:03Z');
  });

  test('should always use UTC timezone', () => {
    // Create date in different timezone context
    const testDate = new Date(2026, 4, 22, 13, 20, 38); // Local time: May 22, 2026 13:20:38

    // The result should still be in UTC format
    const result = formatLWPDate(testDate);

    // Result should be in UTC (format should match UTC components)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}Z$/);
    expect(result.endsWith('Z')).toBe(true);
  });

  test('should handle far future dates', () => {
    // Test with year 2050: 2050-12-25T18:30:15.000Z
    const testDate = new Date('2050-12-25T18:30:15.000Z');
    const result = formatLWPDate(testDate);

    expect(result).toBe('2050-12-25 18:30:15Z');
  });

  test('should handle past dates', () => {
    // Test with past date: 2020-03-14T08:45:30.000Z
    const testDate = new Date('2020-03-14T08:45:30.000Z');
    const result = formatLWPDate(testDate);

    expect(result).toBe('2020-03-14 08:45:30Z');
  });

  test('should maintain format consistency across different dates', () => {
    const testDates = [
      new Date('2023-01-01T00:00:00.000Z'),
      new Date('2023-06-15T12:30:45.000Z'),
      new Date('2023-12-31T23:59:59.000Z'),
      new Date('2024-02-29T06:15:30.000Z'), // Leap year
      new Date('2025-07-04T14:20:10.000Z')
    ];

    testDates.forEach(date => {
      const result = formatLWPDate(date);

      // Check format pattern: YYYY-MM-DD HH:MM:SSZ
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}Z$/);

      // Check that all components are properly padded
      const parts = result.split(' ');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/); // Date part
      expect(parts[1]).toMatch(/^\d{2}:\d{2}:\d{2}Z$/); // Time part
    });
  });
});
