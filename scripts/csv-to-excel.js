/**
 * CSV to Excel Converter
 *
 * Converts CSV sample files to Excel format for use in the workflow.
 * This script uses the 'xlsx' npm package which must be installed first.
 *
 * Installation:
 *   npm install xlsx
 *
 * Usage:
 *   node scripts/csv-to-excel.js
 */

const fs = require('fs');
const path = require('path');

/**
 * Convert CSV to Excel using basic parsing
 * (Fallback if xlsx package is not available)
 *
 * @param {string} csvPath - Path to CSV file
 * @param {string} xlsxPath - Path to output Excel file
 * @param {string} sheetName - Sheet name in Excel
 */
function convertCSVToExcelFallback(csvPath, xlsxPath, sheetName) {
  console.log('Note: Using basic CSV parsing. Install "xlsx" package for better compatibility.');
  console.log('Run: npm install xlsx');

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const rows = csvContent.trim().split('\n').map(row => row.split(','));

  // Create a simple Excel XML format
  let xml = '<?xml version="1.0"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
  xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:html="http://www.w3.org/TR/REC-html40">\n';
  xml += ` <Worksheet ss:Name="${sheetName}">\n`;
  xml += '  <Table>\n';

  rows.forEach(row => {
    xml += '   <Row>\n';
    row.forEach(cell => {
      xml += `    <Cell><Data ss:Type="String">${cell.trim()}</Data></Cell>\n`;
    });
    xml += '   </Row>\n';
  });

  xml += '  </Table>\n';
  xml += ' </Worksheet>\n';
  xml += '</Workbook>';

  fs.writeFileSync(xlsxPath, xml);
  console.log(`✓ Created: ${xlsxPath} (Excel XML format)`);
}

/**
 * Convert CSV to Excel using xlsx package
 *
 * @param {string} csvPath - Path to CSV file
 * @param {string} xlsxPath - Path to output Excel file
 * @param {string} sheetName - Sheet name in Excel
 */
function convertCSVToExcel(csvPath, xlsxPath, sheetName) {
  try {
    // Try to load xlsx package
    const XLSX = require('xlsx');

    // Read CSV
    const workbook = XLSX.readFile(csvPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    // Create new workbook with proper sheet name
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, worksheet, sheetName);

    // Write Excel file
    XLSX.writeFile(newWorkbook, xlsxPath);
    console.log(`✓ Created: ${xlsxPath}`);

  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      // xlsx package not installed, use fallback
      convertCSVToExcelFallback(csvPath, xlsxPath, sheetName);
    } else {
      throw error;
    }
  }
}

/**
 * Main conversion function
 */
function main() {
  console.log('CSV to Excel Converter for n8n Reservation Automation\n');

  const conversions = [
    {
      csvPath: path.join(__dirname, '../data/hotels/hotel_master_sample.csv'),
      xlsxPath: path.join(__dirname, '../data/hotels/hotel_master.xlsx'),
      sheetName: 'Hotels'
    },
    {
      csvPath: path.join(__dirname, '../data/templates/reservation_template_sample.csv'),
      xlsxPath: path.join(__dirname, '../data/templates/reservation_template.xlsx'),
      sheetName: 'Reservations'
    }
  ];

  let successCount = 0;
  let errorCount = 0;

  conversions.forEach(({ csvPath, xlsxPath, sheetName }) => {
    try {
      console.log(`\nConverting: ${path.basename(csvPath)}`);
      console.log(`Output: ${xlsxPath}`);
      console.log(`Sheet name: ${sheetName}`);

      if (!fs.existsSync(csvPath)) {
        console.log(`✗ CSV file not found: ${csvPath}`);
        errorCount++;
        return;
      }

      // Check if Excel file already exists
      if (fs.existsSync(xlsxPath)) {
        console.log(`⚠️  Warning: ${xlsxPath} already exists. Overwriting...`);
      }

      convertCSVToExcel(csvPath, xlsxPath, sheetName);
      successCount++;

    } catch (error) {
      console.log(`✗ Error converting ${path.basename(csvPath)}: ${error.message}`);
      errorCount++;
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Conversion completed: ${successCount} succeeded, ${errorCount} failed`);

  if (errorCount === 0) {
    console.log('\n✓ All files converted successfully!');
    console.log('\nNext steps:');
    console.log('1. Verify the Excel files have correct data');
    console.log('2. Update .env file paths if needed');
    console.log('3. Import workflow into n8n');
  } else {
    console.log('\n⚠️  Some conversions failed. Please check errors above.');
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  convertCSVToExcel,
  convertCSVToExcelFallback
};
