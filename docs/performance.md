# Performance smoke measurement

Date: 2026-11-22
Status: initial local measurement, not a production capacity certification.

## Target and method

- Endpoint: authenticated `GET /api/v1/organizations/:orgId/dashboard`
- Why: heavier than a simple read; it runs scoped project/content aggregation, task queries,
  approval lists, and notification counts.
- Load: 100 connections, 10 seconds, HTTP/1.1, no pipelining.
- Client: `autocannon` via `npm run load:smoke`.
- Server: local development API (Node 24) against Docker PostgreSQL 17, Redis 8, and the S3 mock.
  This host also ran the worker, Vite, and the test suite during the day. Results are conservative.
- Authentication is established once with a real login; the dashboard read itself was measured.

```bash
LOAD_CONNECTIONS=100 LOAD_DURATION_SECONDS=10 npm run load:smoke
```

## Results

| Metric | Result |
|---|---:|
| Total requests | 5,213 |
| Throughput | 521 requests/sec |
| Latency p50 | 185 ms |
| Conservative p95 (autocannon p97.5) | 256 ms |
| Latency p99 | 273 ms |
| Latency max | 356 ms |
| Errors / timeouts / non-2xx | 0 / 0 / 0 |

The 100-connection run meets the initial NFR target of p95 under 500 ms for normal API requests and
the dashboard target of under 2 seconds on this development host. No file-transfer traffic was
included, consistent with the requirement that transfers bypass API workers.

## Limitations

- This is a single-host development measurement, not a multi-instance production benchmark.
- Expected production load includes browser assets, concurrent uploads, worker activity, and
  Postgres/Redis network latency; measure again on production-like infrastructure.
- In-memory rate limiting means API horizontal scaling needs the Redis limiter first.
- Record future results here with date, hardware, endpoint mix, and any regressions.
