export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean)[];

export class ApiClientError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor({
    message,
    status,
    code,
    details,
  }: {
    message: string;
    status: number;
    code?: string;
    details?: unknown;
  }) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
