# Quick Start Guide

Get the Partner Reservation Automation workflow running in 15 minutes.

## Prerequisites

- Docker and Docker Compose installed
- Admin portal credentials
- Email account with IMAP access

## Step 1: Clone/Download Repository

```bash
# If you have the files
cd amt-automation

# Create required directories
mkdir -p data/{hotels,templates,output}
```

## Step 2: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```bash
# Required settings
PARTNER_EMAIL_DOMAIN=your-partner-domain.com
ADMIN_USER=your-admin-username
ADMIN_PASS=your-admin-password
```

## Step 3: Prepare Configuration Files

### Convert Sample CSV to Excel

The workflow requires Excel files. Convert the CSV samples:

**Option A: Using Excel/LibreOffice**
1. Open `data/hotels/hotel_master_sample.csv` in Excel
2. Save as `data/hotels/hotel_master.xlsx` with sheet name "Hotels"
3. Open `data/templates/reservation_template_sample.csv`
4. Save as `data/templates/reservation_template.xlsx` with sheet name "Reservations"

**Option B: Using Python (pandas)**

```python
import pandas as pd

# Hotel master
df = pd.read_csv('data/hotels/hotel_master_sample.csv')
df.to_excel('data/hotels/hotel_master.xlsx', sheet_name='Hotels', index=False)

# Reservation template
df = pd.read_csv('data/templates/reservation_template_sample.csv')
df.to_excel('data/templates/reservation_template.xlsx', sheet_name='Reservations', index=False)
```

**Option C: Using online converter**
- Visit: https://cloudconvert.com/csv-to-xlsx
- Upload CSV files and convert

## Step 4: Build Custom n8n Image

Build the Docker image with Playwright installed:

```bash
# Edit docker-compose.yml and uncomment the build section:
# Uncomment these lines:
#   build:
#     context: .
#     dockerfile: Dockerfile.n8n
# Comment out this line:
#   image: n8nio/n8n:latest

# Then build
docker-compose build
```

## Step 5: Start n8n

```bash
docker-compose up -d
```

Check logs:
```bash
docker-compose logs -f n8n
```

Access n8n at: http://localhost:5678

Default credentials (change these!):
- Username: `admin`
- Password: `changeme123`

## Step 6: Import Workflow

1. Open n8n: http://localhost:5678
2. Login with credentials from docker-compose.yml
3. Go to **Workflows** menu
4. Click **Import from File**
5. Select `n8n-workflow-partner-reservations.json`
6. Click **Import**

## Step 7: Configure Credentials

### Email IMAP Credentials

1. In n8n, go to **Credentials** (left sidebar)
2. Click **Add Credential**
3. Select **IMAP**
4. Fill in:
   - **Name**: Email IMAP Credentials
   - **User**: your-email@company.com
   - **Password**: your-app-password (for Gmail, generate from Google Account settings)
   - **Host**: imap.gmail.com
   - **Port**: 993
   - **Secure**: Yes
5. Click **Create**

### Gmail OAuth2 (for marking emails)

1. **Credentials** > **Add Credential** > **Gmail OAuth2**
2. Follow OAuth2 authorization flow
3. Name it: Gmail OAuth2 Credentials

### Slack API (optional)

1. Create Slack app: https://api.slack.com/apps
2. Add scopes: `chat:write`, `chat:write.public`
3. Install to workspace, copy Bot User OAuth Token
4. In n8n: **Credentials** > **Add Credential** > **Slack API**
5. Paste token
6. Name it: Slack API Credentials

## Step 8: Update Workflow Credentials

1. Open the imported workflow
2. Click on each node that requires credentials:
   - **IMAP Email Trigger**: Select "Email IMAP Credentials"
   - **Mark Email Processed**: Select "Gmail OAuth2 Credentials"
   - **Notify Success (Slack)**: Select "Slack API Credentials"
   - **Notify Manual Review (Slack)**: Select "Slack API Credentials"
3. Click **Save** (top right)

## Step 9: Test the Workflow

### Option A: Manual Test (Recommended First)

1. In the workflow editor, click **Execute Workflow** button
2. This will run a single execution
3. Check execution results in the right panel
4. Review any errors and adjust configuration

### Option B: Send Test Email

1. Send an email to your monitored inbox:
   - **From**: A partner email address (matching PARTNER_EMAIL_DOMAIN)
   - **Subject**: Must contain "Reservation Request"
   - **Body**: Include a link to a test PDF
2. Wait for IMAP trigger to poll (default: every minute)
3. Check workflow execution in n8n

### Create Test PDF

Sample PDF content:
```
Reservation Details

Customer: John Doe
Hotel: Grand Plaza Hotel Seoul
Check-in: 25/07/12
Rooms: 2
Nights: 3
Ordered: 2025/09/19 14:12
```

## Step 10: Activate Workflow

Once testing is successful:

1. In workflow editor, click **Active** toggle (top right)
2. Workflow will now run automatically on IMAP trigger schedule

## Step 11: Monitor

### Check Executions

1. Go to **Executions** in n8n left sidebar
2. View execution history, success/failure status
3. Click on executions to see detailed logs

### Check Output Files

```bash
# View generated Excel files
ls -lh data/output/

# View screenshots (if Playwright ran)
ls -lh data/output/*.png
```

### Check Slack Notifications

- Success messages in configured Slack channel
- Manual review alerts if hotel matching fails

## Troubleshooting Quick Fixes

### "No emails triggering workflow"

```bash
# Check IMAP credentials
docker-compose exec n8n n8n credentials:list

# Check environment variables
docker-compose exec n8n env | grep PARTNER_EMAIL
```

### "PDF parsing failed"

- Check if PDF is text-based (not scanned image)
- Review regex patterns in "Parse PDF Content" node
- Add logging: `console.log('PDF Text:', text);`

### "Hotel matching always fails"

- Lower threshold: `HOTEL_MATCH_THRESHOLD=0.75`
- Add more hotels to `hotel_master.xlsx`
- Check hotel names in master file match PDF format

### "Playwright timeout"

```bash
# Set headless=false for debugging
# In .env:
PLAYWRIGHT_HEADLESS=false

# Rebuild and restart
docker-compose down
docker-compose up -d

# Check screenshots in data/output/
```

### "Permission denied on file write"

```bash
# Fix permissions
sudo chown -R 1000:1000 data/
chmod -R 755 data/
```

## Production Checklist

Before going to production:

- [ ] Change n8n admin password in docker-compose.yml
- [ ] Use strong passwords for all credentials
- [ ] Set PLAYWRIGHT_HEADLESS=true
- [ ] Configure proper backup for n8n data volume
- [ ] Set up monitoring/alerting for failed executions
- [ ] Test with real partner emails (in staging environment)
- [ ] Document partner-specific PDF formats
- [ ] Train ops team on manual review process
- [ ] Set up log rotation for output directory
- [ ] Configure firewall rules for production server

## Next Steps

- Read full [README.md](README.md) for comprehensive documentation
- Customize PDF parsing patterns for your partner formats
- Adjust hotel matching threshold based on false positive rate
- Set up backup/restore procedures
- Create runbooks for common operational scenarios

## Support

For issues:
1. Check execution logs in n8n UI
2. Review screenshots in `data/output/`
3. Check Docker logs: `docker-compose logs -f n8n`
4. Refer to [README.md](README.md) Troubleshooting section

---

**Quick Start Version:** 1.0.0
**Last Updated:** 2025-10-21
