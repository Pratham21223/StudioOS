// End-to-end API smoke test against a running StudioOS API.
//
// It exercises the same cookie + CSRF flow the web app uses, then checks the
// internal workspace and client portal read paths. It creates no records.
//
// Usage:
//   npm run api:smoke
//   API_SMOKE_BASE_URL=https://app.example.com/api/v1 npm run api:smoke

const baseUrl = (process.env.API_SMOKE_BASE_URL ?? "http://localhost:4000/api/v1").replace(
  /\/$/,
  "",
);
const healthBaseUrl = baseUrl.replace(/\/api\/v1$/, "");
const adminEmail = process.env.API_SMOKE_ADMIN_EMAIL ?? "admin@figuringout.test";
const adminPassword = process.env.API_SMOKE_ADMIN_PASSWORD ?? process.env.SEED_PASSWORD ?? "";
const clientEmail = process.env.API_SMOKE_CLIENT_EMAIL ?? "client@figuringout.test";
const clientPassword =
  process.env.API_SMOKE_CLIENT_PASSWORD ?? process.env.API_SMOKE_ADMIN_PASSWORD ?? adminPassword;

const checks = [];

function check(name, ok, detail = "") {
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

function createClient() {
  const jar = new Map();

  function cookieHeader() {
    return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  function storeCookies(response) {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const pair = raw.split(";")[0];
      const separator = pair.indexOf("=");
      if (separator > 0) {
        jar.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
    }
  }

  async function call(path, { method = "GET", body, csrfToken } = {}) {
    const headers = {};
    const cookies = cookieHeader();
    if (cookies) headers.Cookie = cookies;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    storeCookies(response);

    const text = await response.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    return { status: response.status, body: parsed, headers: response.headers };
  }

  async function login(email, password) {
    const csrf = await call("/auth/csrf");
    if (csrf.status !== 200 || !csrf.body?.csrfToken) {
      throw new Error(`CSRF bootstrap failed for ${email}: HTTP ${csrf.status}`);
    }

    const result = await call("/auth/login", {
      method: "POST",
      body: { email, password },
      csrfToken: csrf.body.csrfToken,
    });
    return { ...result, csrfToken: csrf.body.csrfToken };
  }

  return { call, login };
}

function describe(body) {
  if (body === null || body === undefined) return "empty body";
  if (typeof body === "string") return body.slice(0, 120);
  if (body.error) return JSON.stringify(body.error).slice(0, 120);
  return Object.keys(body).join(", ");
}

async function main() {
  if (!adminPassword) {
    throw new Error(
      "Set SEED_PASSWORD or API_SMOKE_ADMIN_PASSWORD before running the API smoke test.",
    );
  }

  // --- Liveness and readiness -------------------------------------------------
  for (const path of ["/health", "/health/ready"]) {
    const response = await fetch(`${healthBaseUrl}${path}`);
    const body = await response.json().catch(() => null);
    check(
      `GET ${path}`,
      response.ok && body?.status === (path === "/health" ? "ok" : "ready"),
      `HTTP ${response.status}`,
    );
  }

  // --- Anonymous access is rejected -----------------------------------------
  const anonymous = createClient();
  const anonymousMe = await anonymous.call("/auth/me");
  check(
    "GET /auth/me without a session returns 401",
    anonymousMe.status === 401,
    `HTTP ${anonymousMe.status}`,
  );

  // --- Internal workspace ---------------------------------------------------
  const admin = createClient();
  const adminLogin = await admin.login(adminEmail, adminPassword);
  check(
    `POST /auth/login as ${adminEmail}`,
    adminLogin.status === 200 && adminLogin.body?.user?.email === adminEmail,
    `HTTP ${adminLogin.status}`,
  );

  const me = await admin.call("/auth/me");
  check(
    "GET /auth/me returns the signed-in user",
    me.status === 200 && me.body?.user?.email === adminEmail,
  );

  const organizations = await admin.call("/organizations");
  check(
    "GET /organizations returns an internal membership",
    organizations.status === 200 &&
      Array.isArray(organizations.body?.organizations) &&
      organizations.body.organizations.length > 0,
    describe(organizations.body),
  );

  const organizationId = organizations.body?.organizations?.[0]?.organization?.id;
  if (!organizationId) {
    throw new Error("No organization found for the admin account; run `npm run db:seed` first.");
  }

  const workspaceChecks = [
    ["clients", "clients"],
    ["projects", "projects"],
    ["content-items", "content"],
    ["tasks", "tasks"],
    ["reviews", "reviews"],
  ];
  for (const [path, key] of workspaceChecks) {
    const result = await admin.call(`/organizations/${organizationId}/${path}`);
    check(
      `GET /organizations/:orgId/${path}`,
      result.status === 200 && Array.isArray(result.body?.[key]),
      `HTTP ${result.status}, ${describe(result.body)}`,
    );
  }

  const dashboard = await admin.call(`/organizations/${organizationId}/dashboard`);
  check(
    "GET /organizations/:orgId/dashboard",
    dashboard.status === 200 && typeof dashboard.body?.dashboard === "object",
    `HTTP ${dashboard.status}`,
  );

  const notifications = await admin.call("/notifications");
  check(
    "GET /notifications",
    notifications.status === 200 && Array.isArray(notifications.body?.notifications),
    `HTTP ${notifications.status}`,
  );

  // CSRF must be enforced on unsafe requests.
  const missingCsrf = await admin.call("/auth/logout", { method: "POST" });
  check(
    "POST /auth/logout without a CSRF token returns 403",
    missingCsrf.status === 403,
    `HTTP ${missingCsrf.status}`,
  );

  // --- Client portal --------------------------------------------------------
  const client = createClient();
  const clientLogin = await client.login(clientEmail, clientPassword);
  check(
    `POST /auth/login as ${clientEmail}`,
    clientLogin.status === 200 &&
      Array.isArray(clientLogin.body?.clientMemberships) &&
      clientLogin.body.clientMemberships.length > 0,
    `HTTP ${clientLogin.status}`,
  );

  const portalProjects = await client.call("/client-portal/projects");
  check(
    "GET /client-portal/projects",
    portalProjects.status === 200 && Array.isArray(portalProjects.body?.projects),
    `HTTP ${portalProjects.status}, ${describe(portalProjects.body)}`,
  );

  const portalProjectId = portalProjects.body?.projects?.[0]?.id;
  if (portalProjectId) {
    const portalContent = await client.call(
      `/client-portal/projects/${portalProjectId}/content-items`,
    );
    check(
      "GET /client-portal/projects/:projectId/content-items",
      portalContent.status === 200 && Array.isArray(portalContent.body?.content),
      `HTTP ${portalContent.status}, ${describe(portalContent.body)}`,
    );

    const contentId = portalContent.body?.content?.[0]?.id;
    if (contentId) {
      const portalDetail = await client.call(`/client-portal/content-items/${contentId}`);
      check(
        "GET /client-portal/content-items/:contentId",
        portalDetail.status === 200,
        `HTTP ${portalDetail.status}`,
      );
    }
  }

  // Tenant roles stay separated: a client contact has no internal memberships and
  // cannot read organization-scoped workspace routes.
  const clientOrganizations = await client.call("/organizations");
  check(
    "GET /organizations as a client contact returns no internal memberships",
    clientOrganizations.status === 200 && clientOrganizations.body?.organizations?.length === 0,
    `HTTP ${clientOrganizations.status}`,
  );

  const clientWorkspaceRead = await client.call(`/organizations/${organizationId}/clients`);
  check(
    "Client contact cannot read internal organization clients",
    clientWorkspaceRead.status === 403 || clientWorkspaceRead.status === 404,
    `HTTP ${clientWorkspaceRead.status}`,
  );

  const failed = checks.filter((entry) => !entry.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
  if (failed.length > 0) {
    console.error(`Failed checks: ${failed.map((entry) => entry.name).join("; ")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`API smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
