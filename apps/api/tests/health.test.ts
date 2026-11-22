import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./helpers.js";

describe("service health and error envelope", () => {
  it("exposes liveness and readiness endpoints", async () => {
    const live = await request(app).get("/health");
    expect(live.status).toBe(200);
    expect(live.body.status).toBe("ok");
    expect(live.body.service).toBe("studioos-api");

    const ready = await request(app).get("/health/ready");
    expect(ready.status).toBe(200);
    expect(ready.body.checks.database).toBe("ok");

    const versioned = await request(app).get("/api/v1/health");
    expect(versioned.status).toBe(200);
  });

  it("publishes the OpenAPI contract and documentation UI", async () => {
    const spec = await request(app).get("/api/v1/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toBe("3.0.3");
    expect(spec.body.info.title).toBe("StudioOS API");
    expect(spec.body.paths["/client-portal/content-items/{contentId}/approve"]).toBeDefined();
    expect(spec.body.paths["/organizations/{orgId}/assets/upload-intents"]).toBeDefined();

    const docs = await request(app).get("/api/docs");
    expect(docs.status).toBe(200);
    expect(docs.text).toContain("swagger-ui");
  });

  it("applies secure headers and a narrow CORS allowlist", async () => {
    const live = await request(app).get("/health");
    expect(live.headers["x-content-type-options"]).toBe("nosniff");
    expect(live.headers["x-frame-options"]).toBeDefined();

    const allowed = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "http://localhost:5174")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,x-csrf-token");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5174");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "http://evil.example")
      .set("Access-Control-Request-Method", "POST");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("returns stable not-found errors with a request id", async () => {
    const response = await request(app)
      .get("/api/v1/does-not-exist")
      .set("x-request-id", "test-request-id");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ROUTE_NOT_FOUND");
    expect(response.body.error.requestId).toBe("test-request-id");
    expect(response.headers["x-request-id"]).toBe("test-request-id");
  });

  it("returns a stable validation error for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("content-type", "application/json")
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
    expect(response.body.error.requestId).toBeTruthy();
  });
});
