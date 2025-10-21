# Project Summary: Partner Reservation Automation

## Overview

This project provides a complete, production-ready n8n workflow that automates the end-to-end process of handling partner reservation requests from email to admin portal upload.

## What's Included

### 1. Core Workflow Files

- **`n8n-workflow-partner-reservations.json`** (18 nodes, 880+ lines)
  - Complete n8n workflow with all automation logic
  - Embedded JavaScript/Playwright code in Code nodes
  - Credential placeholders for easy configuration
  - Error handling and retry logic built-in

### 2. Documentation

- **`README.md`** (800+ lines)
  - Comprehensive documentation covering all aspects
  - Architecture overview
  - Installation instructions
  - Configuration guide
  - Troubleshooting section
  - Security best practices
  - Maintenance procedures

- **`QUICKSTART.md`**
  - 15-minute setup guide
  - Step-by-step instructions
  - Quick troubleshooting tips
  - Production checklist

- **`PROJECT_SUMMARY.md`** (this file)
  - High-level overview
  - File inventory
  - Key features summary

### 3. Configuration Files

- **`.env.example`**
  - Environment variable template
  - All required settings documented
  - Default values provided

- **`docker-compose.yml`**
  - Docker Compose configuration for n8n
  - Volume mounts for data directories
  - Environment variable bindings
  - Health checks configured

- **`Dockerfile.n8n`**
  - Custom n8n image with Playwright + pdf-parse
  - Optimized for the workflow requirements
  - Chromium browser installed

### 4. Sample Data

- **`data/hotels/hotel_master_sample.csv`**
  - Sample hotel master data with 10 hotels
  - Demonstrates required columns and format

- **`data/templates/reservation_template_sample.csv`**
  - Sample reservation template
  - Shows expected column headers

### 5. Helper Scripts

- **`setup.sh`**
  - Automated setup script
  - Creates directories
  - Validates configuration
  - Checks prerequisites

- **`scripts/date-normalization.js`**
  - Standalone date normalization tester
  - Validates YY/MM/DD and YYYY/MM/DD parsing
  - Includes test cases

- **`scripts/hotel-fuzzy-match.js`**
  - Hotel fuzzy matching tester
  - Levenshtein distance implementation
  - Similarity scoring
  - Test cases with sample data

- **`scripts/csv-to-excel.js`**
  - Converts CSV samples to Excel format
  - Handles both xlsx package and fallback method
  - Automates Excel file creation

## Key Features

### Workflow Capabilities

1. **Email Monitoring**
   - IMAP/Gmail integration
   - Filters by domain and subject
   - Processes unread emails only

2. **PDF Processing**
   - Downloads PDFs from email links
   - Handles both direct PDFs and HTML pages with PDF links
   - Robust text extraction using pdf-parse
   - Multi-pattern field extraction (English + Korean labels)

3. **Date Normalization**
   - Converts YY/MM/DD to YYYY-MM-DD (with century logic)
   - Converts YYYY/MM/DD to YYYY-MM-DD
   - Converts YYYY/MM/DD HH:mm to YYYY-MM-DD HH:mm
   - Handles edge cases (00-69 = 20XX, 70-99 = 19XX)

4. **Hotel Fuzzy Matching**
   - Levenshtein distance algorithm
   - Configurable threshold (default: 0.85)
   - Handles typos and minor variations
   - Manual review queue for low-confidence matches

5. **Excel Generation**
   - Fills reservation template with extracted data
   - Maps hotel codes and product codes
   - Timestamped output files

6. **Admin Portal Upload**
   - Full Playwright browser automation
   - Navigates Korean admin portal
   - Handles file upload and modal dialogs
   - Screenshots for debugging
   - Retry logic on failure

7. **Notifications**
   - Slack integration for success/failure/review alerts
   - Email marking as processed
   - Detailed error reporting

### Technical Highlights

- **Resilient Parsing**: Multiple regex patterns per field
- **Error Handling**: Try/catch blocks throughout, retry mechanisms
- **Logging**: Comprehensive logging with screenshots
- **Scalability**: Configurable for high-volume scenarios
- **Security**: Credential management via n8n, no hardcoded secrets
- **Maintainability**: Well-documented, modular code

## Workflow Architecture

```
Email → Link Extract → PDF Download → Parse PDF → Normalize Dates
   ↓                                                      ↓
Manual Review ← Hotel Matching ← Load Hotel Master ←─────┘
   ↓                    ↓
Slack Alert      Excel Generation
                       ↓
                 Playwright Upload
                       ↓
                 Mark Email + Notify
```

## Data Flow

1. **Input**: Partner email with PDF link
2. **Processing**:
   - Extract customer_name, checkin, rooms, nights, ordered_at, hotel_name
   - Normalize dates to ISO format
   - Match hotel to master database
   - Generate Excel upload file
3. **Output**: Uploaded reservation in admin portal

## File Structure

```
amt-automation/
├── n8n-workflow-partner-reservations.json  # Main workflow
├── README.md                               # Full documentation
├── QUICKSTART.md                           # Quick start guide
├── PROJECT_SUMMARY.md                      # This file
├── .env.example                            # Environment template
├── docker-compose.yml                      # Docker Compose config
├── Dockerfile.n8n                          # Custom n8n image
├── setup.sh                                # Setup script
├── data/
│   ├── hotels/
│   │   └── hotel_master_sample.csv        # Sample hotel data
│   ├── templates/
│   │   └── reservation_template_sample.csv # Sample template
│   └── output/                            # Generated files (created at runtime)
└── scripts/
    ├── date-normalization.js              # Date testing utility
    ├── hotel-fuzzy-match.js               # Matching testing utility
    └── csv-to-excel.js                    # CSV to Excel converter
```

## Technology Stack

- **n8n**: Workflow orchestration engine
- **Playwright**: Browser automation (admin upload)
- **pdf-parse**: PDF text extraction
- **Node.js**: Code node runtime
- **IMAP/Gmail**: Email integration
- **Slack**: Notifications
- **Excel (XLSX)**: Data format
- **Docker**: Containerization

## Setup Time Estimate

- **Quick Setup**: 15-30 minutes (with QUICKSTART.md)
- **Full Setup with Testing**: 1-2 hours
- **Production Deployment**: 2-4 hours (including security review)

## Requirements

### System
- Docker & Docker Compose
- 2GB RAM minimum (4GB recommended)
- 10GB disk space

### Access
- Email account with IMAP enabled
- Admin portal credentials
- Slack workspace (optional)

### Skills
- Basic Docker knowledge
- n8n familiarity (beginner-friendly)
- Basic command line usage

## Testing

All code includes test cases:

- **Date Normalization**: 7 test cases covering all formats
- **Hotel Fuzzy Matching**: 10+ test cases with similarity matrix
- **CSV to Excel**: Conversion validation

Run tests:

```bash
node scripts/date-normalization.js
node scripts/hotel-fuzzy-match.js
node scripts/csv-to-excel.js
```

## Deployment Options

### Option 1: Docker Compose (Recommended)
- Simple deployment
- Persistent data
- Easy configuration

### Option 2: n8n Cloud
- Hosted solution
- Requires manual Playwright setup
- Environment variable configuration

### Option 3: Standalone n8n
- Install n8n globally
- Install Playwright and pdf-parse manually
- Import workflow

## Customization Points

1. **PDF Parsing**
   - Edit regex patterns in "Parse PDF Content" node
   - Add new fields as needed
   - Support multiple partner formats

2. **Hotel Matching**
   - Adjust threshold via HOTEL_MATCH_THRESHOLD
   - Add preprocessing logic
   - Implement alternative matching algorithms

3. **Admin Upload**
   - Modify Playwright selectors if portal changes
   - Add additional steps
   - Switch to API if available

4. **Notifications**
   - Add email notifications
   - Integrate with other systems (Teams, PagerDuty)
   - Custom message formatting

## Production Considerations

- **Security**: Rotate credentials, use OAuth2, enable 2FA
- **Monitoring**: Set up alerting for failed executions
- **Backup**: Regular backups of n8n data and hotel master
- **Scaling**: Use queue for high volume (>100 emails/day)
- **Compliance**: Ensure GDPR/privacy compliance for PII

## Support

- **Documentation**: README.md (comprehensive)
- **Quick Start**: QUICKSTART.md
- **Testing**: Helper scripts in scripts/
- **Community**: n8n community forum

## License

Internal use only - Company Proprietary

## Version

**Version**: 1.0.0
**Release Date**: 2025-10-21
**Status**: Production Ready

## Contributors

- RPA Team
- n8n Workflow Engineer

---

## Quick Commands

### Setup
```bash
./setup.sh                          # Run setup script
docker-compose build                # Build custom image
docker-compose up -d                # Start n8n
```

### Testing
```bash
node scripts/date-normalization.js  # Test date parsing
node scripts/hotel-fuzzy-match.js   # Test hotel matching
node scripts/csv-to-excel.js        # Convert CSV to Excel
```

### Monitoring
```bash
docker-compose logs -f n8n          # View logs
ls -lh data/output/                 # Check output files
```

### Maintenance
```bash
docker-compose down                 # Stop n8n
docker-compose restart              # Restart n8n
docker-compose exec n8n bash        # Access container
```

---

**End of Project Summary**
