import autocannon from "autocannon";

const baseUrl = process.env.LOAD_BASE_URL ?? "http://localhost:4000";
const email = process.env.LOAD_EMAIL ?? "admin@northstar.test";
const password = process.env.LOAD_PASSWORD ?? "StudioOS-dev-2026!";
const connections = Number(process.env.LOAD_CONNECTIONS ?? 50);
const duration = Number(process.env.LOAD_DURATION_SECONDS ?? 10);
const p95BudgetMs = Number(process.env.LOAD_P95_BUDGET_MS ?? 500);

function cookieHeader(setCookies) {
  return setCookies
    .map((value) => value.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function authenticatedDashboardUrl() {
  const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
  if (!csrfResponse.ok) {
    throw new Error(`CSRF bootstrap failed: ${csrfResponse.status}`);
  }
  const csrfBody = await csrfResponse.json();
  const csrfCookies = cookieHeader(csrfResponse.headers.getSetCookie());
  const csrfToken = csrfBody.csrfToken;

  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: csrfCookies,
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!loginResponse.ok) {
    throw new Error(`Login failed: ${loginResponse.status} ${await loginResponse.text()}`);
  }
  const loginCookies = cookieHeader(loginResponse.headers.getSetCookie());
  const body = await loginResponse.json();
  const organizationId = body.memberships?.[0]?.organization?.id;
  if (!organizationId) {
    throw new Error("Login response did not include an internal membership.");
  }

  return {
    url: `${baseUrl}/api/v1/organizations/${organizationId}/dashboard`,
    cookie: [csrfCookies, loginCookies].filter(Boolean).join("; "),
  };
}

const target = await authenticatedDashboardUrl();
console.log(
  `Load target: dashboard, ${connections} connections, ${duration}s, p95 budget ${p95BudgetMs} ms`,
);

const result = await autocannon({
  url: target.url,
  connections,
  duration,
  headers: { cookie: target.cookie },
  timeout: 10,
  pipelining: 1,
});

const summary = {
  url: result.url,
  connections,
  durationSeconds: duration,
  requests: result.requests,
  latencyMs: {
    p50: result.latency.p50,
    p95Conservative: result.latency.p97_5,
    p97_5: result.latency.p97_5,
    p99: result.latency.p99,
    max: result.latency.max,
  },
  throughput: result.throughput,
  errors: result.errors,
  timeouts: result.timeouts,
  non2xx: result.non2xx,
};

console.log(JSON.stringify(summary, null, 2));

if (result.errors > 0 || result.timeouts > 0 || result.non2xx > 0) {
  console.error("Load smoke failed: requests errored or returned non-2xx responses.");
  process.exitCode = 1;
} else if (result.latency.p97_5 > p95BudgetMs) {
  console.error(
    `Load smoke failed: conservative p95 (p97.5) ${result.latency.p97_5} ms exceeded ${p95BudgetMs} ms.`,
  );
  process.exitCode = 1;
}
