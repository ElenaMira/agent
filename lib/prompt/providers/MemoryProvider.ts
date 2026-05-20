import { AgentContext } from "@/lib/agent/AgentContext";
import { ContextProvider } from "@/lib/prompt/providers/ContextProvider";

export class MemoryProvider implements ContextProvider {
  async get(ctx: AgentContext): Promise<string> {
    if (!ctx.userId || !ctx.memory?.trim()) {
      return "";
    }

    return `# User Memory\n${ctx.memory.trim()}`;
  }
}
