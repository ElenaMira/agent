import { AgentContext, RouteResult } from "@/lib/types/agent";
import { router } from "@/lib/router/Router";

export async function RouteAgent(ctx: AgentContext): Promise<RouteResult> {
  return router(ctx);
}
