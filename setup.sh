#!/bin/bash

# ===================================
# n8n Reservation Automation Setup
# ===================================
#
# This script automates the initial setup of the Partner Reservation Automation workflow.
# It creates necessary directories, copies configuration files, and validates the environment.
#
# Usage: ./setup.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

print_header() {
    echo ""
    echo "========================================="
    echo "$1"
    echo "========================================="
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_error "Please do not run this script as root"
    exit 1
fi

print_header "n8n Reservation Automation - Setup Script"

# Step 1: Check prerequisites
print_info "Checking prerequisites..."

# Check Docker
if command -v docker &> /dev/null; then
    print_success "Docker is installed ($(docker --version))"
else
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    print_success "Docker Compose is installed ($(docker-compose --version))"
else
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Step 2: Create directory structure
print_header "Creating Directory Structure"

directories=(
    "data/hotels"
    "data/templates"
    "data/output"
    "scripts"
    "backups"
)

for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        print_success "Created directory: $dir"
    else
        print_info "Directory already exists: $dir"
    fi
done

# Set proper permissions
chmod -R 755 data/
print_success "Set permissions on data directories"

# Step 3: Copy environment configuration
print_header "Configuring Environment"

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success "Created .env from .env.example"
        print_info "⚠️  Please edit .env file with your actual credentials"
    else
        print_error ".env.example not found"
    fi
else
    print_info ".env already exists, skipping"
fi

# Step 4: Check workflow file
print_header "Checking Workflow Files"

if [ -f "n8n-workflow-partner-reservations.json" ]; then
    print_success "Workflow file found"
else
    print_error "Workflow file not found: n8n-workflow-partner-reservations.json"
    exit 1
fi

# Step 5: Check sample data files
print_header "Checking Sample Data Files"

if [ -f "data/hotels/hotel_master_sample.csv" ]; then
    print_success "Hotel master sample found"
else
    print_error "Hotel master sample not found"
fi

if [ -f "data/templates/reservation_template_sample.csv" ]; then
    print_success "Reservation template sample found"
else
    print_error "Reservation template sample not found"
fi

# Step 6: Check for Excel conversion
print_header "Excel File Configuration"

if [ -f "data/hotels/hotel_master.xlsx" ]; then
    print_success "hotel_master.xlsx found"
else
    print_info "hotel_master.xlsx not found"
    print_info "Please convert data/hotels/hotel_master_sample.csv to Excel format"
    print_info "Sheet name must be: Hotels"
fi

if [ -f "data/templates/reservation_template.xlsx" ]; then
    print_success "reservation_template.xlsx found"
else
    print_info "reservation_template.xlsx not found"
    print_info "Please convert data/templates/reservation_template_sample.csv to Excel format"
    print_info "Sheet name must be: Reservations"
fi

# Step 7: Validate .env configuration
print_header "Validating Configuration"

if [ -f ".env" ]; then
    # Check for required variables
    required_vars=(
        "PARTNER_EMAIL_DOMAIN"
        "HOTEL_MASTER_PATH"
        "RESERVATION_TEMPLATE_PATH"
        "OUTPUT_DIR"
        "ADMIN_USER"
        "ADMIN_PASS"
    )

    missing_vars=()

    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" .env || grep -q "^${var}=$" .env || grep -q "^${var}=your-" .env; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -eq 0 ]; then
        print_success "All required environment variables are configured"
    else
        print_error "The following environment variables need to be configured:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
    fi
else
    print_error ".env file not found"
fi

# Step 8: Docker Compose configuration check
print_header "Checking Docker Configuration"

if [ -f "docker-compose.yml" ]; then
    print_success "docker-compose.yml found"

    # Check if custom build is enabled
    if grep -q "^[[:space:]]*#[[:space:]]*build:" docker-compose.yml; then
        print_info "Custom Dockerfile build is commented out"
        print_info "To use Playwright, uncomment the build section in docker-compose.yml"
    else
        print_success "Custom build configuration detected"
    fi
else
    print_error "docker-compose.yml not found"
    exit 1
fi

# Step 9: Check Dockerfile
if [ -f "Dockerfile.n8n" ]; then
    print_success "Dockerfile.n8n found"
else
    print_error "Dockerfile.n8n not found"
fi

# Step 10: Network connectivity test
print_header "Testing Network Connectivity"

# Test admin portal
print_info "Testing connection to admin portal..."
if curl -s --max-time 5 https://adm.allmytour.com > /dev/null; then
    print_success "Admin portal is reachable"
else
    print_error "Cannot reach admin portal (https://adm.allmytour.com)"
    print_info "This may be a network/firewall issue"
fi

# Summary
print_header "Setup Summary"

echo ""
echo "Setup completed! Next steps:"
echo ""
echo "1. Edit .env file with your credentials:"
echo "   nano .env"
echo ""
echo "2. Convert CSV samples to Excel format (see QUICKSTART.md)"
echo ""
echo "3. Build the Docker image:"
echo "   docker-compose build"
echo ""
echo "4. Start n8n:"
echo "   docker-compose up -d"
echo ""
echo "5. Access n8n at http://localhost:5678"
echo "   Default credentials: admin / changeme123"
echo ""
echo "6. Import the workflow:"
echo "   n8n-workflow-partner-reservations.json"
echo ""
echo "7. Configure credentials in n8n UI"
echo ""
echo "For detailed instructions, see:"
echo "  - QUICKSTART.md (15-minute guide)"
echo "  - README.md (comprehensive documentation)"
echo ""

print_success "Setup script completed successfully!"
