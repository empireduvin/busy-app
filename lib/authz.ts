export class AuthzError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = 'AuthzError';
    this.status = status;
  }
}

export function getErrorStatus(error: unknown, fallback = 500) {
  if (error instanceof AuthzError) return error.status;
  return fallback;
}
