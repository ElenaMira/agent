import {
  AgentContext,
  ControllerDecision,
  PlannerOutput,
  RouteResult,
} from "@/lib/types/agent";

export async function controller(input: {
  state: AgentContext;
  route: RouteResult;
  tasks: PlannerOutput;
}): Promise<ControllerDecision> {
  const { state, route, tasks } = input;

  const useRAG = route.needs.rag && tasks.steps.includes("retrieve_context");
  const useEvaluator =
    tasks.steps.length > 2 ||
    route.needs.structuredOutput ||
    route.needs.web;

  const mode: ControllerDecision["mode"] =
    route.route === "research" || route.route === "multi_step"
      ? "deep"
      : useRAG || route.needs.web
        ? "balanced"
        : "fast";

  return {
    useMemory: Boolean(state.userId),
    useRAG,
    useTools:
      route.needs.web ||
      route.needs.calculator ||
      route.needs.image ||
      route.route === "image_generation" ||
      useRAG,
    useEvaluator,
    allowParallel:
    tasks.steps.includes("search_trends") && tasks.steps.includes("analyze_image"),
    maxRetries: mode === "deep" ? 2 : 1,
    qualityThreshold: useEvaluator ? 0.7 : undefined,
    fallbackEnabled: true,
    mode,
  };
}
