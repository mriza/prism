#!/bin/bash

# PRISM Comprehensive Test Runner
# Usage: ./run_tests.sh [server|agent|frontend|all]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((TESTS_PASSED++)) || true
}

print_failure() {
    echo -e "${RED}✗ $1${NC}"
    ((TESTS_FAILED++)) || true
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

run_server_tests() {
    print_header "Running Server Tests"
    
    if [ ! -d "server" ]; then
        print_failure "Server directory not found"
        return 1
    fi
    
    cd server
    
    # Check if Go is available
    if ! command -v go &> /dev/null; then
        print_failure "Go is not installed. Skipping server tests."
        cd ..
        return 1
    fi
    
    print_info "Running all server tests..."
    if go test -v ./... 2>&1 | tee /tmp/server_test_output.txt; then
        print_success "Server tests completed"
    else
        print_failure "Some server tests failed"
    fi
    
    cd ..
}

run_agent_tests() {
    print_header "Running Agent Tests"
    
    if [ ! -d "agent" ]; then
        print_failure "Agent directory not found"
        return 1
    fi
    
    cd agent
    
    # Check if Go is available
    if ! command -v go &> /dev/null; then
        print_failure "Go is not installed. Skipping agent tests."
        cd ..
        return 1
    fi
    
    print_info "Running all agent tests..."
    if go test -v ./... 2>&1 | tee /tmp/agent_test_output.txt; then
        print_success "Agent tests completed"
    else
        print_failure "Some agent tests failed"
    fi
    
    cd ..
}

run_frontend_tests() {
    print_header "Running Frontend Tests"
    
    if [ ! -d "frontend" ]; then
        print_failure "Frontend directory not found"
        return 1
    fi
    
    cd frontend
    
    # Check if Node.js is available
    if ! command -v node &> /dev/null; then
        print_failure "Node.js is not installed. Skipping frontend tests."
        cd ..
        return 1
    fi
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        npm install --silent
    fi
    
    print_info "Running Vitest..."
    if npm test -- --run 2>&1 | tee /tmp/frontend_test_output.txt; then
        print_success "Frontend tests completed"
    else
        print_failure "Some frontend tests failed"
        print_info "Check /tmp/frontend_test_output.txt for details"
    fi
    
    cd ..
}

run_build_tests() {
    print_header "Running Build Tests"
    
    # Test Server Build
    print_info "Building server..."
    if [ -d "server" ]; then
        cd server
        if go build -o /tmp/prism-server-test ./cmd/server/main.go 2>&1; then
            print_success "Server build successful"
            rm -f /tmp/prism-server-test
        else
            print_failure "Server build failed"
        fi
        cd ..
    fi
    
    # Test Agent Build
    print_info "Building agent..."
    if [ -d "agent" ]; then
        cd agent
        if go build -o /tmp/prism-agent-test ./cmd/agent/*.go 2>&1; then
            print_success "Agent build successful"
            rm -f /tmp/prism-agent-test
        else
            print_failure "Agent build failed"
        fi
        cd ..
    fi
    
    # Test Frontend Build
    print_info "Building frontend..."
    if [ -d "frontend" ]; then
        cd frontend
        if npm run build --silent 2>&1; then
            print_success "Frontend build successful"
        else
            print_failure "Frontend build failed"
        fi
        cd ..
    fi
}

print_summary() {
    print_header "Test Summary"
    
    echo -e "Tests Passed:  ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed:  ${RED}$TESTS_FAILED${NC}"
    echo -e "Tests Skipped: ${YELLOW}$TESTS_SKIPPED${NC}"
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}All tests passed! ✓${NC}"
        return 0
    else
        echo -e "${RED}Some tests failed. Please review the output above.${NC}"
        echo ""
        echo "For detailed results, see BUG.md or TESTING.md"
        return 1
    fi
}

show_help() {
    echo "PRISM Test Runner"
    echo ""
    echo "Usage: ./run_tests.sh [command]"
    echo ""
    echo "Commands:"
    echo "  server    Run server tests only"
    echo "  agent     Run agent tests only"
    echo "  frontend  Run frontend tests only"
    echo "  build     Run build tests (compilation check)"
    echo "  all       Run all tests (default)"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./run_tests.sh          # Run all tests"
    echo "  ./run_tests.sh server   # Run server tests only"
    echo "  ./run_tests.sh all      # Run all tests"
}

# Main execution
case "${1:-all}" in
    server)
        run_server_tests
        print_summary
        ;;
    agent)
        run_agent_tests
        print_summary
        ;;
    frontend)
        run_frontend_tests
        print_summary
        ;;
    build)
        run_build_tests
        print_summary
        ;;
    all)
        run_server_tests
        run_agent_tests
        run_frontend_tests
        run_build_tests
        print_summary
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
