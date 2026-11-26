export type ApiErrorBody = { error?: unknown };

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

/** Creates the shared cookie-authenticated JSON API request function used by the web client. */
export function createApiClient(apiBase: string, fetcher?: typeof fetch) {
  let base = apiBase;
  while (base.endsWith("/")) base = base.slice(0, -1);
  return async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await (fetcher ?? fetch)(`${base}${path}`, {
      ...init, credentials: "include",
      headers: { "content-type": "application/json", ...init.headers },
    });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = response.status >= 500
        ? "ArcTester couldn't complete this request right now. Please try again."
        : body && typeof body === "object" && "error" in body &&
          typeof (body as ApiErrorBody).error === "string"
          ? (body as { error: string }).error : "The request failed.";
      throw new ApiRequestError(message, response.status);
    }
    return body as T;
  };
}

/** Default cookie-authenticated JSON request using the same Render API as App.tsx. */
const configuredApi = import.meta.env.VITE_API_URL;
// Production requests stay on the Vercel origin so browsers do not have to send
// a Render-domain session cookie as a third-party cookie.
export const API = (import.meta.env.PROD ? "/api" : configuredApi || "/api").replace(/\/+$/, "");
export const request = createApiClient(API);
