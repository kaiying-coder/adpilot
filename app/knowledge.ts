export type KnowledgeDocument = {
  id: string;
  type: "runbook" | "metric" | "case";
  titleZh: string;
  titleEn: string;
  tags: string[];
  content: string;
  approved: boolean;
};

export type SearchHit = {
  document: KnowledgeDocument;
  score: number;
  excerpt: string;
  citation: string;
};

export const knowledgeDocuments: KnowledgeDocument[] = [
  {
    id: "METRIC-CTR",
    type: "metric",
    titleZh: "点击率（CTR）指标定义",
    titleEn: "Click-through rate (CTR)",
    tags: ["ctr", "clicks", "impressions", "点击率", "展示"],
    content: "CTR equals clicks divided by impressions. Investigate changes by market, device, campaign and creative. A CTR decline with stable impressions can indicate creative fatigue, relevance changes, rendering latency or targeting drift.",
    approved: true,
  },
  {
    id: "RB-014",
    type: "runbook",
    titleZh: "CTR下降排查手册",
    titleEn: "CTR decline investigation runbook",
    tags: ["ctr", "latency", "creative", "release", "延迟", "发布"],
    content: "First confirm the historical baseline and affected dimensions. Then check creative freshness, targeting changes, page latency and recent releases. Correlate timestamps before proposing rollback. Rollback always requires human approval.",
    approved: true,
  },
  {
    id: "RB-021",
    type: "runbook",
    titleZh: "广告花费异常排查手册",
    titleEn: "Advertising spend spike runbook",
    tags: ["spend", "bid", "budget", "花费", "出价", "预算"],
    content: "Compare spend against the seven-day baseline. Check bid multipliers, budget changes, targeting expansion and traffic volume. If spend rises without conversion lift, restore the previous bid only after human approval.",
    approved: true,
  },
  {
    id: "RB-008",
    type: "runbook",
    titleZh: "广告收入下降排查手册",
    titleEn: "Revenue decline investigation runbook",
    tags: ["revenue", "tracking", "conversion", "收入", "追踪", "转化"],
    content: "Separate traffic loss from conversion loss. If clicks remain stable while conversions fall, verify tracking tags, landing-page health and delayed events before changing campaign delivery.",
    approved: true,
  },
  {
    id: "CASE-2319",
    type: "case",
    titleZh: "移动端落地页延迟历史案例",
    titleEn: "Mobile landing-page latency incident",
    tags: ["mobile", "latency", "release", "ctr", "移动端", "延迟"],
    content: "A rendering release increased mobile landing latency by 870ms and reduced CTR by 16%. The team rolled back the release after approval; CTR recovered within eighteen minutes.",
    approved: true,
  },
  {
    id: "CASE-2284",
    type: "case",
    titleZh: "转化追踪标签配置历史案例",
    titleEn: "Conversion tag configuration incident",
    tags: ["tracking", "tag", "conversion", "revenue", "追踪", "标签"],
    content: "A tag event-name change delayed conversion records. Click volume remained normal while reported CVR fell. Restoring the prior configuration and backfilling events resolved the incident.",
    approved: true,
  },
];

function tokens(value: string) {
  return value.toLowerCase().split(/[\s,./:;()·]+/).filter((token) => token.length > 1);
}

export function searchKnowledge(query: string, limit = 4): SearchHit[] {
  const queryTokens = tokens(query);
  if (!queryTokens.length) {
    return knowledgeDocuments.slice(0, limit).map((document) => ({
      document,
      score: 1,
      excerpt: document.content,
      citation: `${document.id} §1`,
    }));
  }

  return knowledgeDocuments
    .map((document) => {
      const title = `${document.titleZh} ${document.titleEn}`.toLowerCase();
      const tagText = document.tags.join(" ").toLowerCase();
      const content = document.content.toLowerCase();
      const score = queryTokens.reduce((total, token) => {
        if (title.includes(token)) total += 4;
        if (tagText.includes(token)) total += 3;
        if (content.includes(token)) total += 1;
        return total;
      }, 0);
      return {
        document,
        score,
        excerpt: document.content,
        citation: `${document.id} §1`,
      };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
