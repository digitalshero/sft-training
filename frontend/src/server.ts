import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (
    request: Request,
    env: unknown,
    ctx: unknown,
  ) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) =>
        (m as { default?: ServerEntry }).default ??
        (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(
  body: string,
  responseStatus: number,
): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }
  // Log the raw body explicitly to aid debugging in dev environment.
  try {
    console.error("h3-swallowed-ssr-body:", body);
  } catch {
    /* ignore */
  }
  const captured = consumeLastCapturedError();
  console.error(captured ?? new Error(`h3 swallowed SSR error: ${body}`));

  // In development, surface the swallowed JSON response (and any captured
  // error) directly to the client to make debugging easier. Never enable in
  // production to avoid leaking internal error details.
  try {
    if (process.env.NODE_ENV !== "production") {
      const serialize = (v: unknown) => {
        if (v == null) return undefined;
        if (v instanceof Error) return { message: v.message, stack: v.stack };
        try {
          return JSON.parse(JSON.stringify(v));
        } catch {
          return String(v);
        }
      };
      let parsedBody: unknown = body;
      try {
        parsedBody = JSON.parse(body);
      } catch {
        /* keep raw body */
      }
      const devPayload = { swallowedBody: parsedBody, captured: serialize(captured) };
      return new Response(JSON.stringify(devPayload, null, 2), {
        status: response.status,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }
  } catch (err) {
    // If anything goes wrong while preparing the debug payload, fall back to
    // the branded error page so the app still returns something user friendly.
    console.error("failed to prepare dev SSR debug payload", err);
  }

  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
