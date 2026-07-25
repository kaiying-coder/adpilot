import { NextRequest, NextResponse } from "next/server";
import { knowledgeDocuments, searchKnowledge } from "../../knowledge";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const hits = searchKnowledge(query, 6);
  return NextResponse.json({
    query,
    hits,
    total: hits.length,
    corpusSize: knowledgeDocuments.length,
    retrieval: "weighted lexical retrieval v1",
  });
}
