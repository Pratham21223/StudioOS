const BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1").replace(
  /\/$/,
  "",
);

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type ErrorDetail = {
  path: string;
  message: string;
};

type ErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: ErrorDetail[];
    requestId?: string;
  };
};

let csrfToken: string | null = null;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ErrorDetail[],
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (!SAFE_METHODS.has(method) && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Could not reach the StudioOS API. Check that it is running and try again.",
    );
  }

  const text = await response.text();
  let data: unknown;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = undefined;
    }
  }

  if (data && typeof data === "object" && "csrfToken" in data) {
    const rotated = (data as { csrfToken?: unknown }).csrfToken;
    if (typeof rotated === "string") csrfToken = rotated;
  }

  if (!response.ok) {
    const payload = data as ErrorPayload | undefined;
    const error = payload?.error;

    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("studioos:unauthorized"));
    }

    throw new ApiError(
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "The request could not be completed.",
      error?.details,
      error?.requestId,
    );
  }

  return data as T;
}

export const api = {
  async initCsrf(): Promise<string> {
    const response = await request<{ csrfToken: string }>("GET", "/auth/csrf");
    return response.csrfToken;
  },

  clearCsrf(): void {
    csrfToken = null;
  },

  get<T>(path: string): Promise<T> {
    return request<T>("GET", path);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("POST", path, body);
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>("PATCH", path, body);
  },
};

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error) || !error.details) return {};
  return error.details.reduce<Record<string, string>>((accumulator, detail) => {
    const key = detail.path.split(".")[0] ?? "form";
    if (!accumulator[key]) accumulator[key] = detail.message;
    return accumulator;
  }, {});
}
