import {
  executeAgentTool,
  type AgentToolName,
  type AgentToolRequest,
  type LiveAgentTrace,
} from "./agent";
import type { DetectedAnomaly } from "./data";

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const REQUIRED_TOOLS: AgentToolName[] = [
  "query_metrics",
  "search_runbook",
  "get_similar_incidents",
];

type WorkersAIResponse = {
  response?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type WorkersAIBinding = {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
};

type ModelDecision =
  | {
      type: "tool";
      tool: AgentToolName;
      args?: AgentToolRequest["args"];
      rationale: string;
    }
  | {
      type: "final";
      hypothesis: string;
      evidence: string[];
      recommendedAction: string;
      confidence: number;
      rationale: string;
    };

function parseDecision(raw: string): ModelDecision {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as ModelDecision;
}

function promptFor(
  incident: DetectedAnomaly,
  trace: LiveAgentTrace[],
  usedTools: Set<AgentToolName>
) {
  const observations = trace.length
    ? trace.map((item) => `${item.request.tool}: ${item.observation.result}`).join("\n")
    : "No tools called yet.";
  const missingTools = REQUIRED_TOOLS.filter((tool) => !usedTools.has(tool));
  return `
You are AdPilot, an advertising monetization incident investigator.
Return ONLY one valid JSON object. Do not reveal private chain-of-thought.
Give only a short operational rationale for the next observable action.

Incident:
${JSON.stringify({
  id: incident.id,
  market: incident.market,
  device: incident.device,
  metric: incident.metric,
  deltaPct: incident.delta,
  detector: incident.detector,
  estimatedImpactUsdPerDay: incident.estimatedImpact,
})}

Available read-only tools:
- query_metrics({ market, device, window }): executes against the 14-day metric table.
- search_runbook({ query }): retrieves approved runbooks with citations.
- get_similar_incidents({}): retrieves prior incident evidence.

Observations so far:
${observations}

Tools still required before a final answer: ${missingTools.join(", ") || "none"}.
If any tools are still required, choose one of them and respond:
{"type":"tool","tool":"query_metrics|search_runbook|get_similar_incidents","args":{},"rationale":"one concise sentence"}

Only when no tools are missing, respond:
{"type":"final","hypothesis":"...","evidence":["..."],"recommendedAction":"...","confidence":0.0,"rationale":"one concise sentence"}

All numbers in the final answer must come from tool observations. A rollback is high risk and must remain behind human approval.
`.trim();
}

export async function runWorkersAIInvestigation(
  incident: DetectedAnomaly,
  ai: WorkersAIBinding
) {
  const trace: LiveAgentTrace[] = [];
  const usedTools = new Set<AgentToolName>();
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  for (let step = 1; step <= 5; step += 1) {
    const result = await ai.run(MODEL, {
      messages: [
        {
          role: "system",
          content: "You are a precise AI operations agent. Follow the requested JSON contract.",
        },
        { role: "user", content: promptFor(incident, trace, usedTools) },
      ],
      max_tokens: 420,
      temperature: 0.1,
    }) as WorkersAIResponse;

    usage = {
      promptTokens: usage.promptTokens + (result.usage?.prompt_tokens ?? 0),
      completionTokens: usage.completionTokens + (result.usage?.completion_tokens ?? 0),
      totalTokens: usage.totalTokens + (result.usage?.total_tokens ?? 0),
    };

    if (!result.response) throw new Error("Workers AI returned an empty response.");
    const decision = parseDecision(result.response);

    if (decision.type === "final") {
      const missing = REQUIRED_TOOLS.filter((tool) => !usedTools.has(tool));
      if (missing.length) {
        throw new Error(`Model attempted to finish before required tools: ${missing.join(", ")}`);
      }
      return {
        mode: "workers-ai-live" as const,
        model: MODEL,
        incidentId: incident.id,
        detector: incident.detector,
        trace,
        conclusion: {
          hypothesis: decision.hypothesis,
          evidence: decision.evidence,
          recommendedAction: decision.recommendedAction,
          confidence: Math.max(0, Math.min(1, decision.confidence)),
          rationale: decision.rationale,
        },
        usage,
        billing: {
          paidApiKeyRequired: false,
          freeAllocation: "10,000 neurons/day",
        },
        guardrail: "Recommendation only; execution requires explicit human approval.",
      };
    }

    if (!REQUIRED_TOOLS.includes(decision.tool)) {
      throw new Error(`Unsupported tool requested: ${decision.tool}`);
    }
    const request: AgentToolRequest = {
      tool: decision.tool,
      args: decision.args,
      rationale: decision.rationale,
    };
    const observation = executeAgentTool(request, incident);
    usedTools.add(decision.tool);
    trace.push({
      step,
      decision: decision.rationale,
      request,
      observation,
    });
  }

  throw new Error("Workers AI did not produce a final answer within the step limit.");
}
