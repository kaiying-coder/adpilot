/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { detectedAnomalies } from "../app/data";
import { runWorkersAIInvestigation, type WorkersAIBinding } from "../app/workers-ai";

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
      try {
        return Response.json(await runWorkersAIInvestigation(incident, env.AI));
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

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
