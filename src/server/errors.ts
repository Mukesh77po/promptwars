export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what: string) => new HttpError(404, 'not_found', `${what} not found`);
export const forbidden = (msg = 'You do not have permission for this action') =>
  new HttpError(403, 'forbidden', msg);
export const unauthorized = (msg = 'Please sign in first') =>
  new HttpError(401, 'unauthorized', msg);
