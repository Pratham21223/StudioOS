/**
 * Invitation tokens are single-use secrets that travel in the URL path. They
 * must never be written to logs. Password-reset tokens travel in the query
 * string, which the request logger strips entirely.
 */
export function redactSensitivePath(path: string): string {
  return path.replace(/\/invitations\/(?!accept$)[^/]+/g, "/invitations/:token");
}
