import {
  executeAgentTool,
  type AgentToolName,
  type AgentToolRequest,
  type LiveAgentTrace,
} from "./agent";
import type { DetectedAnomaly } from "./data";

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
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

type PlanDecision = {
  plan: Array<{
      tool: AgentToolName;
      args?: AgentToolRequest["args"];
      rationale: string;
  }>;
};

type FinalDecision = {
  hypothesis: string;
  evidence: string[];
  recommendedAction: string;
  confidence: number;
  rationale: string;
};

function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

function planningPrompt(incident: DetectedAnomaly, correction: string) {
  return `
You are AdPilot, an advertising monetization incident investigator.
Create a short read-only investigation plan. Return ONLY one valid JSON object.
Do not reveal private chain-of-thought; give only short operational rationales.

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

Use each available tool exactly once. Choose the metric dimensions, search query, and order.
Respond in this shape:
{"plan":[{"tool":"query_metrics","args":{"market":"US","device":"Mobile","window":14},"rationale":"Measure the affected segment."},{"tool":"search_runbook","args":{"query":"CTR anomaly investigation"},"rationale":"Retrieve approved guidance."},{"tool":"get_similar_incidents","args":{},"rationale":"Compare prior evidence."}]}
Every tool value must exactly match one available tool.
${correction ? `Correction from the previous attempt: ${correction}` : ""}
`.trim();
}

function conclusionPrompt(incident: DetectedAnomaly, trace: LiveAgentTrace[], correction: string) {
  const observations = trace.map((item) => `${item.request.tool}: ${item.observation.result}`).join("\n");
  return `
You are AdPilot. Produce the incident conclusion from the verified tool observations below.
Return ONLY one valid JSON object. Do not reveal private chain-of-thought.

Incident: ${JSON.stringify({ id: incident.id, estimatedImpactUsdPerDay: incident.estimatedImpact })}
Verified observations:
${observations}

Respond in this shape:
{"hypothesis":"...","evidence":["..."],"recommendedAction":"...","confidence":0.0,"rationale":"one concise operational sentence"}
All numbers must come from the observations. Any rollback must remain behind explicit human approval.
${correction ? `Correction from the previous attempt: ${correction}` : ""}
`.trim();
}

export async function runWorkersAIInvestigation(
  incident: DetectedAnomaly,
  ai: WorkersAIBinding
) {
  const trace: LiveAgentTrace[] = [];
  let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const callModel = async (prompt: string) => {
    const result = await ai.run(MODEL, {
      messages: [
        {
          role: "system",
          content: "You are a precise AI operations agent. Follow the requested JSON contract.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 640,
      temperature: 0.1,
    }) as WorkersAIResponse;
    usage = {
      promptTokens: usage.promptTokens + (result.usage?.prompt_tokens ?? 0),
      completionTokens: usage.completionTokens + (result.usage?.completion_tokens ?? 0),
      totalTokens: usage.totalTokens + (result.usage?.total_tokens ?? 0),
    };
    if (!result.response) throw new Error("Workers AI returned an empty response.");
    return result.response;
  };

  let plan: PlanDecision["plan"] = [];
  let correction = "";
  for (let attempt = 0; attempt < 3 && !plan.length; attempt += 1) {
    try {
      const proposed = parseJSON<PlanDecision>(await callModel(planningPrompt(incident, correction)));
      const seen = new Set<AgentToolName>();
      plan = (Array.isArray(proposed.plan) ? proposed.plan : []).filter((item) => {
        if (!REQUIRED_TOOLS.includes(item.tool) || seen.has(item.tool)) return false;
        seen.add(item.tool);
        return true;
      });
    } catch {
      plan = [];
    }
    correction = "Return a plan array using each of the three exact tool names once.";
  }

  const plannedTools = new Set(plan.map((item) => item.tool));
  for (const tool of REQUIRED_TOOLS) {
    if (!plannedTools.has(tool)) {
      plan.push({
        tool,
        args: tool === "query_metrics"
          ? { market: incident.market, device: incident.device, window: 14 }
          : tool === "search_runbook"
            ? { query: `${incident.metric} anomaly ${incident.market} ${incident.device}` }
            : {},
        rationale: "Required evidence check added by the investigation policy.",
      });
    }
  }

  for (const [index, item] of plan.entries()) {
    const request: AgentToolRequest = {
      tool: item.tool,
      args: item.args,
      rationale: item.rationale,
    };
    const observation = executeAgentTool(request, incident);
    trace.push({
      step: index + 1,
      decision: item.rationale,
      request,
      observation,
    });
  }

  correction = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const decision = parseJSON<FinalDecision>(
        await callModel(conclusionPrompt(incident, trace, correction))
      );
      if (!decision.hypothesis || !Array.isArray(decision.evidence) || !decision.recommendedAction) {
        throw new Error("Incomplete conclusion");
      }
      return {
        mode: "workers-ai-live" as const,
        model: MODEL,
        incidentId: incident.id,
        detector: incident.detector,
        trace,
        conclusion: {
          ...decision,
          confidence: Math.max(0, Math.min(1, Number(decision.confidence) || 0)),
        },
        usage,
        billing: {
          paidApiKeyRequired: false,
          freeAllocation: "10,000 neurons/day",
        },
        guardrail: "Recommendation only; execution requires explicit human approval.",
      };
    } catch {
      correction = "Return the complete conclusion as one plain JSON object with every requested field.";
    }
  }

  throw new Error("Workers AI did not produce a final answer within the step limit.");
}
