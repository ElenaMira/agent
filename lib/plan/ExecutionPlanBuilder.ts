import {
  AgentContext,
  ControllerDecision,
  ExecutionPlan,
  PlanEdge,
  PlanNode,
  PlanStep,
  PlannerOutput,
  RouteResult,
} from "@/lib/types/agent";
// import { validateAndNormalizePlan } from "./validatePlan";



const PLAN_NODE_META: Record<
  PlanStep,
  Pick<PlanNode, "type" | "reads" | "writes">
> = {
  condense_question: {
    type: "llm",
    reads: ["messages", "input"],
    writes: ["messages"],
  },
  retrieve_context: {
    type: "retriever",
    reads: ["messages", "input"],
    writes: ["intermediate.ragContext", "sources"],
  },
  analyze_image: {
    type: "tool",
    reads: ["messages", "input"],
    writes: ["intermediate.imageAnalysis"],
  },
  search_trends: {
    type: "tool",
    reads: ["input", "intermediate.imageAnalysis"],
    writes: ["intermediate.searchSummary", "sources"],
  },
  web_research: {
    type: "tool",
    reads: ["input"],
    writes: ["intermediate.searchSummary", "sources"],
  },
  calculate: {
    type: "tool",
    reads: ["input"],
    writes: ["intermediate.calculatorResult"],
  },
  generate_answer: {
    type: "llm",
    reads: ["input", "messages", "memory", "intermediate.ragContext", "intermediate.searchSummary", "intermediate.calculatorResult"],
    writes: ["finalOutput"],
  },
  generate_copy: {
    type: "llm",
    reads: ["input", "intermediate.imageAnalysis", "intermediate.searchSummary", "memory", "intermediate.ragContext"],
    writes: ["finalOutput"],
  },
  generate_image: {
    type: "tool",
    reads: ["input", "intermediate.imageAnalysis"],
    writes: ["finalOutput", "sources"],
  },
  format_output: {
    type: "llm",
    reads: ["finalOutput"],
    writes: ["messages"],
  },
  evaluate_output: {
    type: "evaluator",
    reads: ["finalOutput", "sources"],
    writes: ["evaluation"],
  },
  chat: {
    type: "llm",
    reads: ["messages", "input", "memory"],
    writes: ["finalOutput"],
  },
};

function createPlanNode(step: PlanStep, decision: ControllerDecision): PlanNode {
  const meta = PLAN_NODE_META[step];
  return {
    id: step,
    name: step,
    type: meta.type,
    reads: meta.reads,
    writes: meta.writes,
    onFail: step === "retrieve_context" || step === "search_trends" ? "fallback" : "retry",
    retry: meta.type === "llm" ? decision.maxRetries : 0,
  };
}

export async function executionPlanBuilder(input: {
  state: AgentContext;
  route: RouteResult;
  tasks: PlannerOutput;
  decision: ControllerDecision;
}): Promise<ExecutionPlan> {
  const steps = [...input.tasks.steps];
  steps.push("generate_answer");
  // steps.push("format_output");
  if (input.decision.useEvaluator && !steps.includes("evaluate_output")) {
    steps.push("evaluate_output");
  }

  // validateAndNormalizePlan(input);

  const nodes = steps.map((step) => createPlanNode(step, input.decision));
  const edges: PlanEdge[] = nodes.slice(0, -1).map((node, index) => ({
    from: node.id,
    to: nodes[index + 1].id,
  }));
  

  return {
    goal: input.route.route,
    entry: nodes[0]?.id ?? "chat",
    nodes,
    edges,
    policies: {
      maxRetries: input.decision.maxRetries,
      qualityThreshold: input.decision.qualityThreshold,
      allowParallel: input.decision.allowParallel,
      timeoutMs: input.decision.mode === "deep" ? 60_000 : 30_000,
    },
  };
}
