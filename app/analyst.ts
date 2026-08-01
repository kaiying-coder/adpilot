import { adMetrics, detectedAnomalies, summarize, type Device, type Market } from "./data";
import { searchKnowledge } from "./knowledge";
import type { WorkersAIBinding } from "./workers-ai";

const MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

type AnalystRequest = {
  question: string;
  market: Market | "All";
  device: Device | "All";
  language: "zh" | "en";
};

type AnalystResponse = { response?: string; usage?: Record<string, number> };

export async function askWorkersAIAnalyst(input: AnalystRequest, ai: WorkersAIBinding) {
  const rows = adMetrics.filter((row) =>
    (input.market === "All" || row.market === input.market) &&
    (input.device === "All" || row.device === input.device)
  );
  const summary = summarize(rows);
  const incidents = detectedAnomalies
    .filter((item) =>
      (input.market === "All" || item.market === input.market) &&
      (input.device === "All" || item.device === input.device)
    )
    .map(({ id, title, market, device, metric, delta, estimatedImpact, detector }) => ({
      id, title, market, device, metric, delta, estimatedImpact, detector,
    }));
  const knowledge = searchKnowledge(input.question, 3).map((hit) => ({
    citation: hit.citation,
    excerpt: hit.excerpt,
  }));
  const prompt = `
You are AdPilot's advertising monetization analyst. Answer the user's question using ONLY the supplied 14-day replay data and approved knowledge. Do not invent causes, production outcomes, or numbers. Clearly say when evidence is insufficient. Keep the answer under 120 words, include relevant citations, and answer in ${input.language === "zh" ? "Simplified Chinese" : "English"}.

Question: ${input.question}
Filters: ${input.market} × ${input.device}
Computed summary: ${JSON.stringify(summary)}
Detected incidents in scope: ${JSON.stringify(incidents)}
Approved knowledge: ${JSON.stringify(knowledge)}
`.trim();

  const result = await ai.run(MODEL, {
    messages: [
      { role: "system", content: "You are a concise, evidence-grounded monetization analyst." },
      { role: "user", content: prompt },
    ],
    max_tokens: 320,
    temperature: 0.1,
  }) as AnalystResponse;
  if (!result.response) throw new Error("Workers AI returned an empty analyst response.");
  return {
    mode: "workers-ai-grounded" as const,
    model: MODEL,
    answer: result.response.trim(),
    filters: { market: input.market, device: input.device },
    sources: ["campaign_metrics:14d", ...knowledge.map((item) => item.citation)],
    usage: result.usage ?? {},
  };
}
