# Partner Reservation Automation - n8n Workflow

## Overview

This production-grade n8n workflow automates the complete end-to-end process of extracting partner reservation requests from email, parsing PDF documents, mapping hotel information, filling Excel templates, and uploading to the company admin portal.

## Architecture

### Workflow Components

1. **Email Monitoring** - IMAP trigger for partner emails
2. **Link Extraction** - Parse HTML email body for reservation URLs
3. **PDF Processing** - Download and extract reservation data
4. **Date Normalization** - Convert various date formats to ISO standards
5. **Hotel Matching** - Fuzzy matching against hotel master database
6. **Excel Generation** - Fill reservation template with mapped data
7. **Admin Upload** - Playwright-based browser automation
8. **Notifications** - Slack alerts for success/failure/manual review

### Technology Stack

- **n8n** - Workflow orchestration
- **Playwright** - Browser automation for admin portal
- **pdf-parse** - PDF text extraction (Node.js library)
- **Node.js** - Code node runtime
- **IMAP/Gmail** - Email integration
- **Excel (XLSX)** - Spreadsheet processing

## Prerequisites

### System Requirements

- n8n (v1.0.0+)
- Node.js (v18+)
- npm packages (install in n8n environment):
  ```bash
  npm install playwright
  npm install pdf-parse
  ```

### Access Requirements

- Email account with IMAP access (Gmail recommended)
- Admin portal credentials (`https://adm.allmytour.com`)
- Slack workspace (optional, for notifications)
- File system access for Excel files

## Installation

### 1. Import Workflow

1. Open n8n web interface
2. Go to **Workflows** > **Import from File**
3. Select `n8n-workflow-partner-reservations.json`
4. Click **Import**

### 2. Install Node Dependencies

If running n8n locally, install required packages:

```bash
# In your n8n installation directory
npm install playwright pdf-parse

# Install Playwright browsers
npx playwright install chromium
```

For Docker-based n8n:

```dockerfile
FROM n8nio/n8n:latest

USER root

# Install Playwright and dependencies
RUN npm install -g playwright pdf-parse && \
    npx playwright install-deps chromium && \
    npx playwright install chromium

USER node
```

### 3. Configure Credentials

#### Email IMAP Credentials

1. Navigate to **Credentials** > **New**
2. Select **IMAP**
3. Enter:
   - **User**: `your-email@company.com`
   - **Password**: `your-app-password`
   - **Host**: `imap.gmail.com` (for Gmail)
   - **Port**: `993`
   - **SSL/TLS**: Enabled

For Gmail, generate an App Password:
- Go to Google Account > Security > 2-Step Verification > App Passwords
- Generate password for "Mail" application

#### Gmail OAuth2 (for marking emails)

1. Create credentials at: **Credentials** > **New** > **Gmail OAuth2**
2. Follow OAuth2 flow to authorize n8n
3. Grant permissions: `gmail.modify` scope

#### Slack API Credentials (optional)

1. Create Slack app at https://api.slack.com/apps
2. Add Bot Token Scopes: `chat:write`, `chat:write.public`
3. Install app to workspace
4. Copy Bot User OAuth Token
5. In n8n: **Credentials** > **New** > **Slack API**
6. Paste token

### 4. Configure Environment Variables

Set the following environment variables in n8n:

```bash
# Email Configuration
PARTNER_EMAIL_DOMAIN=partner.com  # Filter emails from this domain

# File Paths
HOTEL_MASTER_PATH=/data/hotels/hotel_master.xlsx
RESERVATION_TEMPLATE_PATH=/data/templates/reservation_template.xlsx
OUTPUT_DIR=/data/output

# Admin Portal Credentials
ADMIN_USER=your-admin-username
ADMIN_PASS=your-admin-password

# Matching Configuration
HOTEL_MATCH_THRESHOLD=0.85  # Similarity score threshold (0.0-1.0)

# Slack Configuration (optional)
SLACK_CHANNEL=#reservations

# Playwright Configuration
PLAYWRIGHT_HEADLESS=true  # Set to 'false' for debugging
```

For n8n environment variables:
- **Docker**: Use `-e` flags or `docker-compose.yml`
- **Local**: Export in shell or use `.env` file with `dotenv`

## Configuration Files

### Hotel Master Excel (`hotel_master.xlsx`)

**Sheet Name:** `Hotels`

**Columns:**

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| hotel_name_en | String | English hotel name | `Grand Plaza Hotel Seoul` |
| hotel_code | String | Internal hotel code | `GPL001` |
| product_code | String | Product/booking code | `KR-SEOUL-GPL` |

**Sample Data:**

```
hotel_name_en              | hotel_code | product_code
---------------------------|------------|-------------
Grand Plaza Hotel Seoul    | GPL001     | KR-SEOUL-GPL
Busan Beach Resort         | BBR002     | KR-BUSAN-BBR
Jeju Paradise Inn          | JPI003     | KR-JEJU-JPI
```

### Reservation Template Excel (`reservation_template.xlsx`)

**Sheet Name:** `Reservations`

**Headers (Row 1):**

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| customer_name | checkin | rooms | nights | ordered_at | hotel_name_en | hotel_code | product_code |

The workflow will append reservation data starting from Row 2.

## Workflow Execution Flow

### Normal Flow (Success Path)

```
1. IMAP Trigger
   ↓
2. Filter: Unread emails from partners with "Reservation Request"
   ↓
3. Extract Link: Parse HTML body for reservation URL
   ↓
4. Fetch Page: Download reservation page/PDF
   ↓
5. Extract PDF URL: If HTML page, extract final PDF link
   ↓
6. Download PDF: Fetch PDF as binary
   ↓
7. Parse PDF: Extract fields using pdf-parse
   - customer_name
   - checkin_raw (25/07/12 or 2025/07/12)
   - rooms (integer)
   - nights (integer)
   - ordered_at_raw (2025/09/19 14:12)
   - hotel_name_en_raw (optional)
   ↓
8. Normalize Dates: Convert to ISO format
   - 25/07/12 → 2025-07-12
   - 2025/09/19 14:12 → 2025-09-19 14:12
   ↓
9. Load Hotel Master: Read hotel_master.xlsx
   ↓
10. Fuzzy Match Hotel: Levenshtein distance matching
    ↓
11. Route by Match Status
    ├─ MATCHED (score >= 0.85)
    │  ↓
    │  12a. Prepare Excel Data
    │  ↓
    │  13a. Write Excel Upload File
    │  ↓
    │  14a. Admin Upload (Playwright)
    │      - Login to adm.allmytour.com
    │      - Navigate: 판매관리 > 예약목록
    │      - Upload file
    │      - Click 예약등록
    │      - Handle modal: Click 취소
    │  ↓
    │  15a. Mark Email as Processed
    │  ↓
    │  16a. Slack Notification: Success
    │
    └─ NEEDS_REVIEW (score < 0.85)
       ↓
       12b. Write Manual Review File
       ↓
       13b. Slack Notification: Manual Review Required
```

### Error Handling

| Error Type | Handling | Retry | Notification |
|------------|----------|-------|--------------|
| Email fetch failed | Continue to next email | Auto (n8n) | None |
| Link extraction failed | Log, store email | No | Error node |
| PDF download failed | Retry 3x | Yes (2s delay) | Slack alert |
| PDF parsing failed | Save PDF, manual queue | No | Slack alert |
| Hotel matching < threshold | Route to manual review | No | Slack alert |
| Admin upload failed | Retry 2x, screenshot | Yes (5s delay) | Slack alert |

## PDF Parsing Details

### Expected PDF Format

The workflow expects PDFs containing the following fields (labels can be in English or Korean):

**Field Patterns:**

```
Customer/Name/고객명/예약자: John Doe
Check-in/체크인/입실: 25/07/12
Rooms/객실: 2
Nights/박: 3
Ordered/Reserved/예약일시/신청일: 2025/09/19 14:12
Hotel/호텔명: Grand Plaza Hotel Seoul
```

### Date Format Handling

| Input Format | Example | Output Format | Example |
|--------------|---------|---------------|---------|
| YY/MM/DD | `25/07/12` | YYYY-MM-DD | `2025-07-12` |
| YYYY/MM/DD | `2025/07/12` | YYYY-MM-DD | `2025-07-12` |
| YYYY/MM/DD HH:mm | `2025/09/19 14:12` | YYYY-MM-DD HH:mm | `2025-09-19 14:12` |

**Century Rule for YY format:**
- `00-69` → `20XX` (e.g., `25` → `2025`)
- `70-99` → `19XX` (e.g., `85` → `1985`)

### Parsing Robustness

The Code node handles:
- Extra whitespace
- Various colon characters (`:`, `：`)
- Case-insensitive labels
- Multiple regex patterns per field
- Missing optional fields (hotel_name_en_raw)

## Hotel Fuzzy Matching

### Algorithm

Uses **Levenshtein Distance** to calculate similarity score:

```
similarity = (max_length - edit_distance) / max_length
```

### Configuration

- **Threshold**: `HOTEL_MATCH_THRESHOLD` (default: `0.85`)
- **Range**: `0.0` (no match) to `1.0` (exact match)

### Examples

| PDF Name | Master Name | Score | Status |
|----------|-------------|-------|--------|
| `Grand Plaza Hotel Seoul` | `Grand Plaza Hotel Seoul` | 1.00 | MATCHED |
| `Grand Plaza Seoul` | `Grand Plaza Hotel Seoul` | 0.88 | MATCHED |
| `Busan Beach Resor` | `Busan Beach Resort` | 0.95 | MATCHED |
| `Jeju Paradise` | `Grand Plaza Hotel Seoul` | 0.42 | NEEDS_REVIEW |

### Manual Review Process

When `match_score < threshold`:
1. Workflow writes to `mapping_required_YYYYMMDD_HHmmss.xlsx`
2. Slack notification sent with details
3. Operations team reviews and updates hotel master
4. Email can be re-processed or manually uploaded

## Admin Portal Automation

### Playwright Script Breakdown

#### Steps Automated:

1. **Launch Browser**: Headless Chromium
2. **Navigate**: `https://adm.allmytour.com`
3. **Login**: Fill username/password, click 로그인
4. **Navigate Menu**: Click 판매관리 → 예약목록
5. **Scroll**: To bottom for upload section
6. **File Selection**: Populate `input[type="file"]`
7. **Upload**: Click 예약등록 button
8. **Modal Handling**: Click 취소 in confirmation popup
9. **Cleanup**: Close browser

#### Screenshots Captured:

For debugging, screenshots are saved to `OUTPUT_DIR`:
- `01_login_page.png`
- `02_after_login.png`
- `03_sales_menu.png`
- `04_reservation_list.png`
- `05_scroll_bottom.png`
- `06_file_selected.png`
- `07_modal_appeared.png`
- `08_final_state.png`
- `error_screenshot.png` (on failure)

#### Selectors Used:

The script tries multiple selectors for resilience:

```javascript
// Login button
['button:has-text("로그인")', 'button[type="submit"]', 'input[type="submit"]']

// Navigation
['text=판매관리', 'text=예약목록']

// File input
['input[type="file"]']

// Register button
['button:has-text("예약등록")', 'button.register-btn']

// Modal cancel
['button:has-text("취소")', '.modal button:has-text("취소")']
```

### Troubleshooting Playwright

**Issue**: Playwright hangs on page load

**Solution**: Reduce `waitUntil` timeout or use `domcontentloaded` instead of `networkidle`

---

**Issue**: Selectors not found

**Solution**:
1. Set `PLAYWRIGHT_HEADLESS=false` for visual debugging
2. Review screenshots in `OUTPUT_DIR`
3. Update selectors in Code node based on actual DOM

---

**Issue**: Modal doesn't appear

**Solution**: Check workflow logic - modal may be auto-closed or conditional. Script includes try/catch for optional modal handling.

---

**Issue**: Upload fails silently

**Solution**: Enable browser console logging (already included in script) and check n8n execution logs.

## Monitoring and Alerts

### Slack Notifications

#### Success Message:

```
✅ Reservation Upload Success

Customer: John Doe
Check-in: 2025-07-12
Hotel: Grand Plaza Hotel Seoul
File: /data/output/reservation_upload_20251021_143022.xlsx
Timestamp: 2025-10-21T14:30:22.000Z
```

#### Manual Review Required:

```
⚠️ Manual Review Required

Customer: Jane Smith
Hotel Searched: Busan Beach Resor
Best Match: Busan Beach Resort (score: 0.82)
Status: NEEDS_REVIEW
File: /data/output/mapping_required_20251021_143045.xlsx
```

#### Error Alert:

```
🚨 Reservation Automation Error

Step: Admin Upload (Playwright)
Error: Could not find register button
Email ID: 12345
Timestamp: 2025-10-21T14:30:55.000Z
Screenshot: /data/output/error_screenshot.png
```

### Logging Best Practices

1. **Enable Execution Logging** in n8n settings
2. **Set Log Level** to `info` for production, `debug` for troubleshooting
3. **Retain Execution History** for at least 30 days
4. **Monitor Workflow Metrics**:
   - Execution count per day
   - Success rate
   - Average execution time
   - Error frequency by node

## Performance Optimization

### Recommended Settings

- **Polling Interval**: 5 minutes (adjust based on email volume)
- **Max Executions**: 10 concurrent (n8n settings)
- **Execution Timeout**: 600 seconds (10 minutes)
- **Binary Data Storage**: File system (for large PDFs)

### Scaling Considerations

For high-volume scenarios (>100 emails/day):

1. **Use Queue**: Add Redis-backed queue for email processing
2. **Separate Upload**: Run upload automation as separate workflow triggered by webhook
3. **Batch Processing**: Group multiple reservations into single Excel file
4. **Caching**: Cache hotel master data in n8n static data

## Security Best Practices

### Credentials Management

- ✅ Use n8n Credentials store (encrypted at rest)
- ✅ Rotate passwords every 90 days
- ✅ Use OAuth2 for Gmail where possible
- ✅ Limit Slack bot permissions to required scopes
- ❌ Never hardcode credentials in workflow JSON

### Data Privacy

- Email content contains PII (names, booking details)
- Ensure n8n instance meets compliance requirements (GDPR, etc.)
- Configure execution data retention policy
- Mask customer names in logs if required:

```javascript
// Example: Mask customer name in logs
const maskedName = customerName.replace(/(?<=.).(?=.)/g, '*');
console.log('Processing reservation for:', maskedName);
```

### Network Security

- Run n8n behind VPN or firewall
- Use HTTPS for admin portal
- Whitelist IP addresses for IMAP access
- Enable 2FA on email accounts

## Troubleshooting Guide

### Common Issues

#### 1. No Emails Triggering Workflow

**Symptoms**: IMAP trigger never fires

**Diagnosis**:
- Check IMAP credentials
- Verify email filter settings (`PARTNER_EMAIL_DOMAIN`)
- Confirm unread emails exist matching filter
- Test IMAP connection manually:
  ```bash
  openssl s_client -connect imap.gmail.com:993
  ```

**Solution**: Update IMAP credentials, adjust filter logic

---

#### 2. PDF Parsing Returns Empty Fields

**Symptoms**: `parsedData` has `null` values

**Diagnosis**:
- Examine `pdfText` in execution data
- Check if PDF is scanned image (requires OCR)
- Verify regex patterns match actual PDF format

**Solution**:
- Add logging to Code node:
  ```javascript
  console.log('PDF Text:', text);
  ```
- Update regex patterns based on actual format
- For image PDFs, add Tesseract OCR step before parsing

---

#### 3. Hotel Matching Always Fails

**Symptoms**: All reservations route to manual review

**Diagnosis**:
- Check `hotel_name_en_raw` extraction
- Verify `hotel_master.xlsx` path and format
- Review match scores in execution logs

**Solution**:
- Lower `HOTEL_MATCH_THRESHOLD` (e.g., to `0.75`)
- Add hotel name variations to master file
- Implement preprocessing (trim, lowercase, remove punctuation)

---

#### 4. Admin Upload Timeout

**Symptoms**: Playwright node exceeds timeout

**Diagnosis**:
- Check `adm.allmytour.com` availability
- Review screenshots for stuck page
- Verify admin credentials

**Solution**:
- Increase timeout in Code node
- Add explicit waits: `await page.waitForSelector(...)`
- Check for CAPTCHA or additional auth steps

---

#### 5. Excel File Write Fails

**Symptoms**: "Permission denied" or "File not found"

**Diagnosis**:
- Verify `OUTPUT_DIR` exists and is writable
- Check `RESERVATION_TEMPLATE_PATH` is valid
- Confirm n8n process has file system permissions

**Solution**:
- Create output directory: `mkdir -p /data/output`
- Set permissions: `chmod 755 /data/output`
- For Docker, mount volume correctly:
  ```yaml
  volumes:
    - /host/data:/data
  ```

## Testing

### Unit Testing Individual Nodes

#### Test PDF Parsing:

1. Download sample PDF manually
2. Trigger workflow with test email
3. Inspect `parsedData` in execution view
4. Verify all fields extracted correctly

#### Test Date Normalization:

Create test input in Code node:

```javascript
const testCases = [
  { input: '25/07/12', expected: '2025-07-12' },
  { input: '2025/07/12', expected: '2025-07-12' },
  { input: '2025/09/19 14:12', expected: '2025-09-19 14:12' }
];

for (const test of testCases) {
  const result = normalizeCheckin(test.input);
  console.log(`${test.input} → ${result} (expected: ${test.expected})`);
  if (result !== test.expected) {
    throw new Error(`Test failed for ${test.input}`);
  }
}
```

#### Test Hotel Matching:

Add debug logging to fuzzy match node:

```javascript
console.log(`Matching "${searchName}" against ${hotelMasterItems.length} hotels`);
console.log(`Best match: ${bestMatch.hotel_name_en} (score: ${bestScore})`);
```

### End-to-End Testing

1. **Prepare Test Email**:
   - Send email to monitored inbox
   - From: `test@partner.com`
   - Subject: `Reservation Request - TEST`
   - Body: Include test PDF link

2. **Prepare Test PDF**:
   - Create PDF with known values
   - Upload to accessible URL

3. **Execute Workflow**:
   - Trigger manually or wait for poll
   - Monitor execution in n8n UI

4. **Verify Results**:
   - Check Excel file generated in `OUTPUT_DIR`
   - Verify upload in admin portal
   - Confirm Slack notification received

## Maintenance

### Regular Tasks

| Task | Frequency | Description |
|------|-----------|-------------|
| Update hotel master | Weekly | Add new hotels, update codes |
| Review manual queue | Daily | Process `mapping_required_*.xlsx` files |
| Check error logs | Daily | Investigate failed executions |
| Rotate credentials | Quarterly | Update passwords, OAuth tokens |
| Update Playwright | Monthly | `npm update playwright` |
| Review match threshold | Monthly | Adjust based on false positive/negative rate |

### Workflow Updates

When updating the workflow:

1. **Export Current Version**:
   ```
   Workflows > [...] > Export > Download
   ```

2. **Test in Development**:
   - Clone workflow
   - Update nodes
   - Test with sample data

3. **Backup Execution Data**:
   - Export last 100 executions
   - Store in version control

4. **Deploy to Production**:
   - Deactivate old workflow
   - Import new version
   - Activate and monitor

5. **Rollback Plan**:
   - Keep previous version available
   - Document changes in changelog

## Advanced Configuration

### Custom Parsing Rules

To add custom field extraction, modify the "Parse PDF Content" Code node:

```javascript
// Example: Extract booking reference
const bookingRefPatterns = [
  /(?:Booking Ref|예약번호)[\\s:：]+([A-Z0-9-]+)/i
];
let bookingRef = null;
for (const pattern of bookingRefPatterns) {
  const match = text.match(pattern);
  if (match) {
    bookingRef = match[1].trim();
    break;
  }
}

// Add to parsed data
parsedData: {
  ...
  booking_ref: bookingRef
}
```

### API-Based Upload (Alternative to Playwright)

If admin portal provides REST API:

1. Replace "Admin Upload (Playwright)" node with HTTP Request nodes
2. Configure authentication (login endpoint)
3. POST multipart/form-data to upload endpoint

Example:

```json
{
  "url": "https://adm.allmytour.com/api/reservations/upload",
  "method": "POST",
  "authentication": "genericCredentialType",
  "sendBinaryData": true,
  "binaryPropertyName": "file",
  "options": {
    "multipart": true
  }
}
```

### Multi-Partner Support

To handle multiple partners with different PDF formats:

1. Add "Switch" node after email filter
2. Route by sender domain or email subject pattern
3. Use separate parsing Code nodes per partner
4. Merge before hotel matching

## Support and Resources

### Documentation

- n8n Official Docs: https://docs.n8n.io/
- Playwright API: https://playwright.dev/docs/api/class-playwright
- pdf-parse NPM: https://www.npmjs.com/package/pdf-parse

### Troubleshooting Assistance

For issues with this workflow:

1. Check execution logs in n8n UI
2. Review error screenshots in `OUTPUT_DIR`
3. Test individual nodes with sample data
4. Consult n8n community forum

### Feature Requests

To request enhancements:
- Document requirement with examples
- Provide sample PDFs (anonymized)
- Describe expected behavior

## Changelog

### Version 1.0.0 (2025-10-21)

- Initial production release
- Full automation: email → PDF → Excel → admin upload
- Fuzzy hotel matching with Levenshtein algorithm
- Playwright-based browser automation
- Comprehensive error handling and retry logic
- Slack notifications for all workflow outcomes
- Multi-format date normalization (YY/MM/DD, YYYY/MM/DD)
- Manual review queue for low-confidence matches
- Detailed logging and screenshot capture

## License

Internal use only - Company Proprietary

---

**Document Version:** 1.0.0
**Last Updated:** 2025-10-21
**Maintained By:** RPA Team
