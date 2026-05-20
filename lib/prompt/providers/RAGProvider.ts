import { AgentContext } from "@/lib/agent/AgentContext";
import { ContextProvider } from "@/lib/prompt/providers/ContextProvider";

export class RAGProvider implements ContextProvider {
  async get(ctx: AgentContext): Promise<string> {
    if (!ctx.rag?.trim()) {
      return "";
    }

    return `# Retrieved Context\n${ctx.rag.trim()}`;
  }
}
