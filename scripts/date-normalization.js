/**
 * Date Normalization Utilities
 *
 * Standalone script for testing and validating date normalization logic
 * outside of the n8n workflow.
 *
 * Usage:
 *   node scripts/date-normalization.js
 */

/**
 * Normalize check-in date from various formats to YYYY-MM-DD
 *
 * Supported formats:
 * - YY/MM/DD (e.g., 25/07/12 -> 2025-07-12)
 * - YYYY/MM/DD (e.g., 2025/07/12 -> 2025-07-12)
 *
 * @param {string} rawDate - Raw date string
 * @returns {string} Normalized date in YYYY-MM-DD format
 */
function normalizeCheckin(rawDate) {
  // Pattern: YY/MM/DD (e.g., 25/07/12)
  const yyPattern = /^(\d{2})\/(\d{2})\/(\d{2})$/;
  // Pattern: YYYY/MM/DD (e.g., 2025/07/12)
  const yyyyPattern = /^(\d{4})\/(\d{2})\/(\d{2})$/;

  if (yyPattern.test(rawDate)) {
    const [, yy, mm, dd] = rawDate.match(yyPattern);
    // Assume 20XX for years < 70, 19XX for years >= 70
    const yyyy = parseInt(yy, 10) < 70 ? `20${yy}` : `19${yy}`;
    return `${yyyy}-${mm}-${dd}`;
  }

  if (yyyyPattern.test(rawDate)) {
    const [, yyyy, mm, dd] = rawDate.match(yyyyPattern);
    return `${yyyy}-${mm}-${dd}`;
  }

  throw new Error(`Unsupported check-in date format: ${rawDate}`);
}

/**
 * Normalize ordered_at timestamp from YYYY/MM/DD HH:mm to YYYY-MM-DD HH:mm
 *
 * @param {string} rawDateTime - Raw datetime string
 * @returns {string} Normalized datetime in YYYY-MM-DD HH:mm format
 */
function normalizeOrderedAt(rawDateTime) {
  // Pattern: YYYY/MM/DD HH:mm (e.g., 2025/09/19 14:12)
  const pattern = /^(\d{4})\/(\d{2})\/(\d{2})([\s]+\d{2}:\d{2})$/;

  if (pattern.test(rawDateTime)) {
    return rawDateTime.replace(/\//g, '-');
  }

  throw new Error(`Unsupported ordered_at format: ${rawDateTime}`);
}

/**
 * Validate if a date string is in ISO format (YYYY-MM-DD)
 *
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid ISO date
 */
function isValidISODate(dateStr) {
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoPattern.test(dateStr)) {
    return false;
  }

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validate if a datetime string is in ISO-like format (YYYY-MM-DD HH:mm)
 *
 * @param {string} dateTimeStr - Datetime string to validate
 * @returns {boolean} True if valid format
 */
function isValidISODateTime(dateTimeStr) {
  const pattern = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/;
  return pattern.test(dateTimeStr);
}

// Test cases
const testCases = [
  // Check-in date tests
  { type: 'checkin', input: '25/07/12', expected: '2025-07-12' },
  { type: 'checkin', input: '85/07/12', expected: '1985-07-12' },
  { type: 'checkin', input: '00/01/01', expected: '2000-01-01' },
  { type: 'checkin', input: '69/12/31', expected: '2069-12-31' },
  { type: 'checkin', input: '70/01/01', expected: '1970-01-01' },
  { type: 'checkin', input: '2025/07/12', expected: '2025-07-12' },
  { type: 'checkin', input: '2024/12/31', expected: '2024-12-31' },

  // Ordered_at tests
  { type: 'ordered_at', input: '2025/09/19 14:12', expected: '2025-09-19 14:12' },
  { type: 'ordered_at', input: '2024/01/01 00:00', expected: '2024-01-01 00:00' },
  { type: 'ordered_at', input: '2025/12/31 23:59', expected: '2025-12-31 23:59' },
];

// Run tests if executed directly
if (require.main === module) {
  console.log('Running date normalization tests...\n');

  let passed = 0;
  let failed = 0;

  testCases.forEach((test, index) => {
    try {
      const result = test.type === 'checkin'
        ? normalizeCheckin(test.input)
        : normalizeOrderedAt(test.input);

      if (result === test.expected) {
        console.log(`✓ Test ${index + 1}: ${test.input} → ${result}`);
        passed++;
      } else {
        console.log(`✗ Test ${index + 1}: ${test.input} → ${result} (expected: ${test.expected})`);
        failed++;
      }
    } catch (error) {
      console.log(`✗ Test ${index + 1}: ${test.input} → ERROR: ${error.message}`);
      failed++;
    }
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Export functions for use in n8n Code nodes or other scripts
module.exports = {
  normalizeCheckin,
  normalizeOrderedAt,
  isValidISODate,
  isValidISODateTime
};
