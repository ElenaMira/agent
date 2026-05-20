import { AgentStateShape, PlanStep } from "@/lib/types/agent";

export type NodeHandler = (
  state: AgentStateShape,
) => Promise<Partial<AgentStateShape>>;

export class NodeHandlerRegistry {
  private readonly handlers = new Map<string, NodeHandler>();

  register(name: PlanStep, handler: NodeHandler) {
    this.handlers.set(name, handler);
  }

  get(name: string) {
    return this.handlers.get(name);
  }
}
