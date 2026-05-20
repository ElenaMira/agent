import { AgentContext } from "@/lib/agent/AgentContext";
import { ContextProvider } from "@/lib/prompt/providers/ContextProvider";

export class ToolProvider implements ContextProvider {
  async get(ctx: AgentContext): Promise<string> {
    if (!ctx.tools?.length) {
      return "";
    }

    return `# Available Tools\n${ctx.tools.join(", ")}`;
  }
}
