/**
 * Hotel Fuzzy Matching Utilities
 *
 * Standalone script for testing and validating hotel name matching logic
 * using Levenshtein distance algorithm.
 *
 * Usage:
 *   node scripts/hotel-fuzzy-match.js
 */

/**
 * Calculate Levenshtein distance between two strings
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Levenshtein distance (number of edits required)
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  // Initialize first column
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score between two strings (0.0 to 1.0)
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (1.0 = exact match, 0.0 = completely different)
 */
function similarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Find the best matching hotel from a list of hotels
 *
 * @param {string} searchName - Hotel name to search for
 * @param {Array<Object>} hotelList - List of hotel objects with hotel_name_en property
 * @param {number} threshold - Minimum similarity threshold (default: 0.85)
 * @returns {Object} Match result with hotel, score, and status
 */
function findBestMatch(searchName, hotelList, threshold = 0.85) {
  let bestMatch = null;
  let bestScore = 0;

  // Normalize search name
  const normalizedSearch = searchName.toLowerCase().trim();

  for (const hotel of hotelList) {
    const normalizedHotel = hotel.hotel_name_en.toLowerCase().trim();
    const score = similarity(normalizedSearch, normalizedHotel);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = hotel;
    }
  }

  return {
    searchName: searchName,
    bestMatch: bestMatch,
    score: bestScore,
    status: bestScore >= threshold ? 'MATCHED' : 'NEEDS_REVIEW',
    threshold: threshold
  };
}

/**
 * Preprocess hotel name for better matching
 * Removes common suffixes, punctuation, and standardizes spacing
 *
 * @param {string} name - Hotel name to preprocess
 * @returns {string} Preprocessed name
 */
function preprocessHotelName(name) {
  return name
    .toLowerCase()
    .trim()
    // Remove common suffixes
    .replace(/\s+(hotel|resort|inn|suites?|motel)$/i, '')
    // Remove special characters
    .replace(/[^\w\s]/g, ' ')
    // Normalize spacing
    .replace(/\s+/g, ' ')
    .trim();
}

// Sample hotel master data
const sampleHotelMaster = [
  { hotel_name_en: 'Grand Plaza Hotel Seoul', hotel_code: 'GPL001', product_code: 'KR-SEOUL-GPL' },
  { hotel_name_en: 'Busan Beach Resort', hotel_code: 'BBR002', product_code: 'KR-BUSAN-BBR' },
  { hotel_name_en: 'Jeju Paradise Inn', hotel_code: 'JPI003', product_code: 'KR-JEJU-JPI' },
  { hotel_name_en: 'Incheon Airport Hotel', hotel_code: 'IAH004', product_code: 'KR-INCHEON-IAH' },
  { hotel_name_en: 'Gangnam Luxury Suites', hotel_code: 'GLS005', product_code: 'KR-SEOUL-GLS' },
];

// Test cases
const testCases = [
  // Exact matches
  { search: 'Grand Plaza Hotel Seoul', expectedMatch: 'Grand Plaza Hotel Seoul', shouldMatch: true },
  { search: 'Busan Beach Resort', expectedMatch: 'Busan Beach Resort', shouldMatch: true },

  // Minor typos
  { search: 'Grand Plaza Hotel Seol', expectedMatch: 'Grand Plaza Hotel Seoul', shouldMatch: true },
  { search: 'Busan Beach Resor', expectedMatch: 'Busan Beach Resort', shouldMatch: true },

  // Missing words
  { search: 'Grand Plaza Seoul', expectedMatch: 'Grand Plaza Hotel Seoul', shouldMatch: true },
  { search: 'Jeju Paradise', expectedMatch: 'Jeju Paradise Inn', shouldMatch: true },

  // Different ordering
  { search: 'Hotel Grand Plaza Seoul', expectedMatch: 'Grand Plaza Hotel Seoul', shouldMatch: false },

  // Case variations
  { search: 'BUSAN BEACH RESORT', expectedMatch: 'Busan Beach Resort', shouldMatch: true },
  { search: 'gangnam luxury suites', expectedMatch: 'Gangnam Luxury Suites', shouldMatch: true },

  // Completely different
  { search: 'Tokyo Bay Hotel', expectedMatch: null, shouldMatch: false },
  { search: 'Random Hotel Name', expectedMatch: null, shouldMatch: false },
];

// Run tests if executed directly
if (require.main === module) {
  console.log('Running hotel fuzzy matching tests...\n');
  console.log(`Threshold: 0.85\n`);

  let passed = 0;
  let failed = 0;

  testCases.forEach((test, index) => {
    const result = findBestMatch(test.search, sampleHotelMaster, 0.85);

    const matchStatus = result.status === 'MATCHED' ? '✓' : '✗';
    const expectedStatus = test.shouldMatch ? 'MATCH' : 'NO_MATCH';
    const actualStatus = result.status === 'MATCHED' ? 'MATCH' : 'NO_MATCH';

    const testPassed = (test.shouldMatch && result.status === 'MATCHED') ||
                       (!test.shouldMatch && result.status === 'NEEDS_REVIEW');

    if (testPassed) {
      passed++;
    } else {
      failed++;
    }

    console.log(`${testPassed ? '✓' : '✗'} Test ${index + 1}:`);
    console.log(`  Search: "${test.search}"`);
    console.log(`  Best Match: "${result.bestMatch?.hotel_name_en || 'NONE'}"`);
    console.log(`  Score: ${result.score.toFixed(3)}`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Expected: ${expectedStatus}, Actual: ${actualStatus}`);
    console.log('');
  });

  console.log(`Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests\n`);

  // Detailed similarity matrix
  console.log('Similarity Matrix (for debugging):');
  console.log('='.repeat(80));

  const testSearches = [
    'Grand Plaza Seoul',
    'Busan Beach Resor',
    'Jeju Paradise',
    'Tokyo Bay Hotel'
  ];

  testSearches.forEach(search => {
    console.log(`\nSearch: "${search}"`);
    console.log('-'.repeat(80));

    const scores = sampleHotelMaster.map(hotel => ({
      name: hotel.hotel_name_en,
      score: similarity(search.toLowerCase(), hotel.hotel_name_en.toLowerCase())
    }));

    scores.sort((a, b) => b.score - a.score);

    scores.forEach(({ name, score }) => {
      const bar = '█'.repeat(Math.round(score * 50));
      console.log(`  ${score.toFixed(3)} ${bar} ${name}`);
    });
  });

  if (failed > 0) {
    process.exit(1);
  }
}

// Export functions
module.exports = {
  levenshteinDistance,
  similarity,
  findBestMatch,
  preprocessHotelName
};
