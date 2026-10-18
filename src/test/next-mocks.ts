// In-memory stand-ins for the request-scoped parts of Next.js, so Server
// Actions and auth code can run in plain Vitest.

type Cookie = { value: string; options?: Record<string, unknown> };

export const cookieJar = new Map<string, Cookie>();
export const requestHeaders = new Headers();

export class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}

export function resetRequest() {
  cookieJar.clear();
  for (const key of [...requestHeaders.keys()]) requestHeaders.delete(key);
  requestHeaders.set("x-forwarded-for", "203.0.113.10");
}

export const cookiesMock = async () => ({
  get: (name: string) => {
    const c = cookieJar.get(name);
    return c ? { name, value: c.value } : undefined;
  },
  set: (name: string, value: string, options?: Record<string, unknown>) => {
    cookieJar.set(name, { value, options });
  },
  delete: (name: string) => {
    cookieJar.delete(name);
  },
});

export const headersMock = async () => requestHeaders;

export function redirectMock(url: string): never {
  throw new RedirectError(url);
}

// Runs `fn` and returns the URL it redirected to (or null if it returned).
export async function redirectedTo(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    if (error instanceof RedirectError) return error.url;
    throw error;
  }
}
