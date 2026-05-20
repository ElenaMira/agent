import { AgentContext, ControllerDecision, PlannerOutput, RouteResult } from "../types/agent";

export function validateAndNormalizePlan(input: {
    state: AgentContext;
    route: RouteResult;
    tasks: PlannerOutput;
    decision: ControllerDecision;
  }) {
    const { plan, route } = input;
  
    let nodes = plan.nodes;
  
    if (!route.needs.web) {
      nodes = nodes.filter(
        n => n.name !== "web_research" && n.name !== "search_trends"
      );
    }
  
    if (!route.needs.rag) {
      nodes = nodes.filter(n => n.name !== "retrieve_context");
    }
  
    if (!route.needs.image) {
      nodes = nodes.filter(n => n.name !== "analyze_image");
    }
  
    if (!route.needs.calculator) {
      nodes = nodes.filter(n => n.name !== "calculate");
    }
  
    const nodeIds = new Set(nodes.map(n => n.id));
  
    const edges = plan.edges.filter(
      e => nodeIds.has(e.from) && nodeIds.has(e.to)
    );
  
    return {
      ...plan,
      nodes,
      edges,
      entry: nodes[0]?.id ?? "chat",
    };
  }