// Minimal ambient declarations for the Cloudflare Workers runtime types this
// project uses (D1, Workers AI, ExecutionContext). In the real project these
// come from `@cloudflare/workers-types` (installed automatically by
// `npm install` when you set this up locally with network access) — this
// file exists only so the code type-checks in an offline sandbox. Once you
// run `npm install` for real, you can delete this file; the official types
// take over automatically.

interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(colName?: string): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
  exec(query: string): Promise<D1Result>;
}

interface Ai {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
