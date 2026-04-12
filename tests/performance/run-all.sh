#!/bin/bash

# PRISM Performance Test Runner
# Runs all k6 performance tests and generates reports

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results/$(date +%Y%m%d_%H%M%S)"

# Default configuration
BASE_URL="${BASE_URL:-http://localhost:8080}"
WS_URL="${WS_URL:-ws://localhost:8080/api/ws}"
TEST_TOKEN="${TEST_TOKEN:-}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}  PRISM Performance Test Suite${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed.${NC}"
    echo ""
    echo "Install k6: https://k6.io/docs/getting-started/installation/"
    echo ""
    echo "  macOS:     brew install k6"
    echo "  Ubuntu:    sudo apt-get install k6"
    echo "  Windows:   choco install k6"
    exit 1
fi

# Create results directory
mkdir -p "$RESULTS_DIR"

echo "Configuration:"
echo "  BASE_URL:  $BASE_URL"
echo "  WS_URL:    $WS_URL"
echo "  RESULTS:   $RESULTS_DIR"
echo ""

# Function to run a single test
run_test() {
    local test_name="$1"
    local test_file="$2"
    local duration="${3:-5m}"

    echo -e "${YELLOW}Running: $test_name${NC}"
    echo "  Duration: $duration"
    echo ""

    if k6 run \
        --out json="$RESULTS_DIR/${test_name}.json" \
        "$test_file" \
        2>&1 | tee "$RESULTS_DIR/${test_name}.log"; then
        echo -e "${GREEN}  ✓ $test_name completed${NC}"
    else
        echo -e "${RED}  ✗ $test_name failed${NC}"
    fi

    echo ""
}

# Run tests
echo "Starting performance tests..."
echo ""

# 1. API Load Test
run_test "api-load" "$SCRIPT_DIR/api-load.js" "5m"

# 2. Database Load Test
run_test "database-load" "$SCRIPT_DIR/database-load.js" "5m"

# 3. WebSocket Stress Test (shorter duration for stress test)
run_test "websocket-stress" "$SCRIPT_DIR/websocket-stress.js" "5m"

# Summary
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}  Performance Tests Complete${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo "Results saved to: $RESULTS_DIR"
echo ""
echo "Files:"
ls -la "$RESULTS_DIR"/*.json 2>/dev/null || echo "  No JSON results found"
echo ""
echo "To analyze results:"
echo "  k6 analyze $RESULTS_DIR/api-load.json"
echo "  k6 summary $RESULTS_DIR/api-load.json"
echo ""
