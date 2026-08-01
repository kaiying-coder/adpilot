/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { detectedAnomalies } from "../app/data";
import { runWorkersAIInvestigation, type WorkersAIBinding } from "../app/workers-ai";
import { askWorkersAIAnalyst } from "../app/analyst";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  AI: WorkersAIBinding;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const requestBuckets = new Map<string, number[]>();
const investigationCache = new Map<string, { expiresAt: number; payload: Record<string, unknown> }>();
const investigationInFlight = new Map<string, Promise<Record<string, unknown>>>();
const analystCache = new Map<string, { expiresAt: number; payload: Record<string, unknown> }>();

function clientKey(request: Request, scope: string) {
  return `${scope}:${request.headers.get("cf-connecting-ip") ?? "anonymous"}`;
}

function isRateLimited(key: string, limit: number, windowMs = 60_000) {
  const now = Date.now();
  const recent = (requestBuckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= limit) return true;
  recent.push(now);
  requestBuckets.set(key, recent);
  return false;
}

function classifyAIError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("empty response")) return "AI_EMPTY_RESPONSE";
  if (message.includes("before required tools")) return "AI_TOOL_SEQUENCE_INCOMPLETE";
  if (message.includes("within the step limit")) return "AI_STEP_LIMIT";
  if (message.includes("JSON")) return "AI_OUTPUT_INVALID";
  if (message.includes("Unsupported tool")) return "AI_TOOL_UNSUPPORTED";
  return "AI_UPSTREAM_ERROR";
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/investigations/INC-2407/run"
    ) {
      const incident = detectedAnomalies.find((item) => item.id === "INC-2407");
      if (!incident) return Response.json({ error: "Incident not found" }, { status: 404 });
      const body = await request.json().catch(() => null) as { language?: "zh" | "en" } | null;
      const language = body?.language === "en" ? "en" : "zh";
      const usePublicProtection = Boolean(request.headers.get("cf-connecting-ip"));
      const cachedInvestigation = investigationCache.get(language);
      if (usePublicProtection && cachedInvestigation && cachedInvestigation.expiresAt > Date.now()) {
        return Response.json({ ...cachedInvestigation.payload, cache: { hit: true, ttlSeconds: 300 } });
      }
      if (usePublicProtection && isRateLimited(clientKey(request, "investigation"), 3)) {
        return Response.json(
          { error: "Live investigation rate limit reached", errorCode: "RATE_LIMITED", retryable: true, retryAfterSeconds: 60 },
          { status: 429, headers: { "retry-after": "60" } }
        );
      }
      try {
        if (!investigationInFlight.has(language)) investigationInFlight.set(language, runWorkersAIInvestigation(incident, env.AI, language)
          .then((result) => result as unknown as Record<string, unknown>)
          .finally(() => { investigationInFlight.delete(language); }));
        const payload = await investigationInFlight.get(language)!;
        if (usePublicProtection) investigationCache.set(language, { expiresAt: Date.now() + 300_000, payload });
        return Response.json({ ...payload, cache: { hit: false, ttlSeconds: 300 } });
      } catch (error) {
        return Response.json(
          {
            error: "Workers AI investigation failed",
            errorCode: classifyAIError(error),
            retryable: true,
          },
          { status: 502 }
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/api/analyst/ask") {
      const body = await request.json().catch(() => null) as {
        question?: string;
        market?: "All" | "US" | "DE" | "UK";
        device?: "All" | "Mobile" | "Desktop";
        language?: "zh" | "en";
      } | null;
      const question = body?.question?.trim() ?? "";
      const market = body?.market ?? "All";
      const device = body?.device ?? "All";
      const language = body?.language ?? "zh";
      if (!question || question.length > 300) {
        return Response.json({ error: "Question must contain 1–300 characters." }, { status: 400 });
      }
      const cacheKey = `${language}:${market}:${device}:${question.toLowerCase()}`;
      const usePublicProtection = Boolean(request.headers.get("cf-connecting-ip"));
      const cached = analystCache.get(cacheKey);
      if (usePublicProtection && cached && cached.expiresAt > Date.now()) {
        return Response.json({ ...cached.payload, cache: { hit: true, ttlSeconds: 120 } });
      }
      if (usePublicProtection && isRateLimited(clientKey(request, "analyst"), 8)) {
        return Response.json(
          { error: "Analyst rate limit reached", errorCode: "RATE_LIMITED", retryable: true, retryAfterSeconds: 60 },
          { status: 429, headers: { "retry-after": "60" } }
        );
      }
      try {
        const payload = await askWorkersAIAnalyst({ question, market, device, language }, env.AI) as unknown as Record<string, unknown>;
        if (usePublicProtection) analystCache.set(cacheKey, { expiresAt: Date.now() + 120_000, payload });
        return Response.json({ ...payload, cache: { hit: false, ttlSeconds: 120 } });
      } catch {
        return Response.json(
          { error: "Workers AI analyst failed", errorCode: "AI_UPSTREAM_ERROR", retryable: true },
          { status: 502 }
        );
      }
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
