# PRISM Performance Tests

Performance and load tests using k6.

## Prerequisites

### Install k6

**macOS**:
```bash
brew install k6
```

**Linux**:
```bash
# Ubuntu/Debian
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C68802CB725F65
sudo echo "deb https://dl.k6.io/deb stable main" > /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# CentOS/RHEL
sudo yum install https://dl.k6.io/rpm/repo.rpm
sudo yum install k6
```

**Windows**:
```bash
choco install k6
```

**Docker**:
```bash
docker run --rm -v "${PWD}:/scripts" grafana/k6 run /scripts/tests/performance/api-load.js
```

## Test Files

- `api-load.js` - API load testing (REST endpoints)
- `websocket-stress.js` - WebSocket connection stress test
- `database-load.js` - Database query performance tests

## Running Tests

### Basic Test

```bash
# API Load Test
k6 run tests/performance/api-load.js

# WebSocket Stress Test
k6 run tests/performance/websocket-stress.js

# Database Load Test
k6 run tests/performance/database-load.js
```

### With Custom Configuration

```bash
# Set base URL
export BASE_URL=http://localhost:8080
export WS_URL=ws://localhost:8080/api/ws
export TEST_TOKEN=your-jwt-token

# Run with custom VUs and duration
k6 run --vus 100 --duration 30s tests/performance/api-load.js

# Run with specific stages
k6 run --vus 50 --duration 2m tests/performance/websocket-stress.js
```

### With Output

```bash
# Save results to JSON
k6 run --out json=results.json tests/performance/api-load.js

# Save results to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 tests/performance/api-load.js
```

## Test Scenarios

### API Load Test (`api-load.js`)

**Stages**:
1. Ramp up to 10 users (30s)
2. Stay at 10 users (1m)
3. Ramp up to 50 users (30s)
4. Stay at 50 users (2m)
5. Ramp up to 100 users (30s)
6. Stay at 100 users (2m) - Stress test
7. Ramp down to 0 (30s)

**Endpoints Tested**:
- `GET /api/health` - Health check
- `POST /api/login` - Authentication
- `GET /api/projects` - Get projects
- `POST /api/projects` - Create project
- `GET /api/servers` - Get servers
- `GET /api/accounts` - Get accounts
- `GET /api/logs` - Get activity logs

**Thresholds**:
- 95% of requests < 500ms
- Error rate < 10%
- API latency p95 < 300ms

---

### WebSocket Stress Test (`websocket-stress.js`)

**Stages**:
1. Ramp up to 10 connections (30s)
2. Stay at 10 connections (1m)
3. Ramp up to 50 connections (30s)
4. Stay at 50 connections (2m)
5. Ramp up to 100 connections (30s)
6. Stay at 100 connections (1m)
7. Ramp down to 0 (30s)

**Metrics**:
- Connection success rate
- Message success rate
- Active connections gauge

**Thresholds**:
- Connection success > 90%
- Message success > 95%
- Connection time p95 < 1000ms

---

### Database Load Test (`database-load.js`)

**Stages**:
1. Ramp up to 20 users (30s)
2. Stay at 20 users (1m)
3. Ramp up to 50 users (30s)
4. Stay at 50 users (2m)
5. Ramp down to 0 (30s)

**Queries Tested**:
- Get all projects
- Get all servers
- Get all accounts (with joins)
- Get activity logs (with pagination)
- Search projects (with filters)

**Thresholds**:
- Query latency p95 < 100ms
- Error rate < 5%

---

## Results Interpretation

### Key Metrics

**HTTP Request Duration**:
- `< 100ms`: Excellent
- `100-300ms`: Good
- `300-500ms`: Acceptable
- `> 500ms`: Needs optimization

**Error Rate**:
- `< 1%`: Excellent
- `1-5%`: Acceptable
- `> 5%`: Needs investigation

**Active Connections** (WebSocket):
- Monitor for connection leaks
- Should return to 0 after test completes

### Sample Output

```
     ✓ ws_connections...........: 99.5%  ✓ 99.5% of connections successful
     ✓ ws_messages..............: 99.8%  ✓ 99.8% of messages received
     ✓ http_req_duration........: avg=150ms min=50ms med=140ms max=500ms p(95)=450ms
     ✓ db_query_latency.........: avg=50ms min=10ms med=45ms max=200ms p(95)=95ms
     
     checks.....................: 99.2%  ✓ 5000/5040 checks passed
     data_received..............: 1.5 MB
     data_sent..................: 500 KB
     http_reqs..................: 10000
     iteration_duration.........: avg=2s min=1s max=5s
     iterations.................: 5000
     vus........................: 100
     vus_max....................: 100
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Performance Tests

on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    
    services:
      prism:
        image: prism-server:latest
        ports:
          - 8080:8080
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Install k6
        run: |
          curl https://k6.io/install | bash
      
      - name: Run API Load Test
        run: k6 run --out json=results.json tests/performance/api-load.js
        env:
          BASE_URL: http://localhost:8080
          TEST_TOKEN: ${{ secrets.TEST_TOKEN }}
      
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: results.json
```

## Best Practices

### Test Environment

- ✅ Use separate test environment (not production)
- ✅ Use realistic data volume
- ✅ Monitor server resources during tests
- ✅ Run tests at off-peak hours

### Test Design

- ✅ Start with low load, ramp up gradually
- ✅ Include think time (sleep) between requests
- ✅ Use realistic user scenarios
- ✅ Test edge cases and error conditions

### Analysis

- ✅ Look at percentiles (p95, p99), not just averages
- ✅ Check for memory leaks
- ✅ Monitor database connection pool
- ✅ Check for connection timeouts

## Troubleshooting

### Tests Fail Immediately

**Check if server is running**:
```bash
curl http://localhost:8080/api/health
```

**Update BASE_URL**:
```bash
export BASE_URL=http://your-server:8080
```

### Connection Refused

**Check firewall**:
```bash
sudo ufw status
sudo ufw allow 8080
```

### High Error Rate

**Check server logs**:
```bash
journalctl -u prism-server -f
```

**Check database connections**:
```bash
# SQLite
sqlite3 data/prism.db "SELECT COUNT(*) FROM connections;"
```

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 JavaScript API](https://k6.io/docs/javascript-api/)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/)

---

**Last Updated**: 2026-04-02  
**Version**: 1.0  
**Maintained By**: PRISM Development Team
