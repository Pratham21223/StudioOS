import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export type MonitoringContext = {
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  source: "api" | "worker";
  extra?: Record<string, unknown>;
};

/**
 * Optional error-monitoring hook. Set MONITORING_WEBHOOK_URL to forward
 * sanitized failures to Sentry Relay, a collector, or an alerting endpoint.
 */
export function reportError(error: unknown, context: MonitoringContext): void {
  if (!env.MONITORING_WEBHOOK_URL) return;

  const payload = {
    service: "studioos",
    source: context.source,
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    statusCode: context.statusCode,
    error: {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
    ...context.extra,
    occurredAt: new Date().toISOString(),
  };

  void fetch(env.MONITORING_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(3_000),
  }).catch((reportingError: unknown) => {
    logger.warn({ err: reportingError }, "monitoring.report_failed");
  });
}
