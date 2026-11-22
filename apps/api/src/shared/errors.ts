export type ErrorDetail = {
  path: string;
  message: string;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(code: string, message: string, details?: ErrorDetail[]): AppError {
    return new AppError(400, code, message, details);
  }

  static unauthorized(
    code = "AUTHENTICATION_REQUIRED",
    message = "Authentication is required.",
  ): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(
    code = "FORBIDDEN",
    message = "You do not have permission to do that.",
  ): AppError {
    return new AppError(403, code, message);
  }

  static notFound(
    code = "RESOURCE_NOT_FOUND",
    message = "The requested resource was not found.",
  ): AppError {
    return new AppError(404, code, message);
  }

  static conflict(code: string, message: string): AppError {
    return new AppError(409, code, message);
  }
}

export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
