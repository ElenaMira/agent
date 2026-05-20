import { AgentSource } from "@/lib/types/agent";
import { ragQueryLogic } from "@/lib/tools/RagTool";

function normalizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  if (/^https?:\/\//.test(value)) return value;
  return undefined;
}

export async function retrieveContext(query: string): Promise<{
  combinedContext: string;
  documents: Array<{ pageContent: string; metadata?: Record<string, unknown> }>;
  sources: AgentSource[];
}> {
  const result = await ragQueryLogic(query);

  const documents = result.documents.map((doc: any) => ({
    pageContent: doc.pageContent,
    metadata: doc.metadata ?? {},
  }));

  const sources = documents
    .map((doc) => {
      const metadata = doc.metadata ?? {};
      const url =
        normalizeUrl(metadata.url) ??
        normalizeUrl(metadata.source) ??
        normalizeUrl(metadata.link);
      if (!url) return null;
      return {
        title:
          typeof metadata.title === "string"
            ? metadata.title
            : typeof metadata.source === "string"
              ? metadata.source
              : undefined,
        url,
        snippet: doc.pageContent.slice(0, 160),
      };
    })
    .filter(Boolean) as AgentSource[];

  return {
    combinedContext: result.combined_context,
    documents,
    sources,
  };
}
