import { AgentContext } from "@/lib/agent/AgentContext";

export interface ContextProvider {
  get(ctx: AgentContext): Promise<string>;
}
