import { END, START, StateGraph } from "@langchain/langgraph";

import { AgentStateAnnotation, GraphAgentState } from "@/lib/graph/AgentState";
import { NodeHandlerRegistry } from "@/lib/nodes/NodeHandlerRegistry";
import { ExecutionPlan, PlanEdge, PlanNode } from "@/lib/types/agent";

const MAX_RETRY = 2;
const EVALUATION_RETRY_GATE = "__evaluation_retry_gate";
const EVALUATION_NODE_ID = "evaluate_output";
const FORMAT_NODE_ID = "format_output";
const GENERATOR_NODE_NAMES = new Set([
  "generate_answer",
  "generate_copy",
  "generate_image",
  "chat",
]);

function shouldFollowCondition(state: GraphAgentState, when?: string) {
  if (!when) return true;
  if (when === "evaluation.passed") return Boolean(state.evaluation?.passed);
  if (when === "!evaluation.passed") return !state.evaluation?.passed;
  if (when === "retry.limit_reached") {
    return !state.evaluation?.passed && state.evaluationRetryCount > MAX_RETRY;
  }
  if (when === "retry.allowed") {
    return !state.evaluation?.passed && state.evaluationRetryCount <= MAX_RETRY;
  }
  return true;
}

function clonePlanNode(node: PlanNode): PlanNode {
  return {
    ...node,
    reads: [...node.reads],
    writes: [...node.writes],
    input: node.input ? { ...node.input } : undefined,
  };
}

function clonePlan(plan: ExecutionPlan): ExecutionPlan {
  return {
    ...plan,
    nodes: plan.nodes.map(clonePlanNode),
    edges: plan.edges.map((edge) => ({ ...edge })),
    policies: plan.policies ? { ...plan.policies } : undefined,
  };
}

function hasNode(plan: ExecutionPlan, nodeId: string) {
  return plan.nodes.some((node) => node.id === nodeId);
}

function ensureFormatOutputNode(plan: ExecutionPlan) {
  if (hasNode(plan, FORMAT_NODE_ID)) return;

  plan.nodes.push({
    id: FORMAT_NODE_ID,
    name: "format_output",
    type: "llm",
    reads: ["finalOutput"],
    writes: ["messages"],
    onFail: "retry",
    retry: 1,
  });
}

function removeEvaluateOutput(plan: ExecutionPlan) {
  plan.nodes = plan.nodes.filter((node) => node.id !== EVALUATION_NODE_ID);
  plan.edges = plan.edges.filter(
    (edge) => edge.from !== EVALUATION_NODE_ID && edge.to !== EVALUATION_NODE_ID,
  );
}

function rebuildEvaluatorEdges(plan: ExecutionPlan) {
  const evaluationIndex = plan.nodes.findIndex((node) => node.id === EVALUATION_NODE_ID);
  const generatorNode = [...plan.nodes.slice(0, evaluationIndex)]
    .reverse()
    .find((node) => GENERATOR_NODE_NAMES.has(node.name));

  if (!generatorNode) {
    removeEvaluateOutput(plan);
    return;
  }

  plan.edges = plan.edges.filter(
    (edge) =>
      edge.from !== EVALUATION_NODE_ID &&
      edge.from !== generatorNode.id &&
      edge.from !== EVALUATION_RETRY_GATE &&
      edge.to !== EVALUATION_RETRY_GATE &&
      edge.to !== EVALUATION_NODE_ID,
  );

  plan.edges.push(
    {
      from: generatorNode.id,
      to: EVALUATION_NODE_ID,
    },
    {
      from: EVALUATION_NODE_ID,
      to: FORMAT_NODE_ID,
      when: "evaluation.passed",
    },
    {
      from: EVALUATION_NODE_ID,
      to: EVALUATION_RETRY_GATE,
      when: "!evaluation.passed",
    },
    {
      from: EVALUATION_RETRY_GATE,
      to: generatorNode.id,
      when: "retry.allowed",
    },
    {
      from: EVALUATION_RETRY_GATE,
      to: FORMAT_NODE_ID,
      when: "retry.limit_reached",
    },
  );
}

function normalizePlan(plan: ExecutionPlan): ExecutionPlan {
  const nextPlan = clonePlan(plan);
  const businessNodes = nextPlan.nodes.filter(
    (node) => node.id !== EVALUATION_NODE_ID && node.id !== FORMAT_NODE_ID,
  );

  if (businessNodes.length <= 1) {
    removeEvaluateOutput(nextPlan);
    return nextPlan;
  }

  if (!hasNode(nextPlan, EVALUATION_NODE_ID)) {
    return nextPlan;
  }

  ensureFormatOutputNode(nextPlan);
  rebuildEvaluatorEdges(nextPlan);
  return nextPlan;
}

export class GraphCompiler {
  constructor(private readonly registry: NodeHandlerRegistry) {}

  async compile(plan: ExecutionPlan) {
    const normalizedPlan = normalizePlan(plan);
    console.log("normalizedPlan:",normalizedPlan);
    const workflow = new StateGraph(AgentStateAnnotation);

    for (const node of normalizedPlan.nodes) {
      const handler = this.registry.get(node.name);
      if (!handler) {
        throw new Error(`No node handler registered for ${node.name}`);
      }

      workflow.addNode(node.id, async (state: GraphAgentState) => {
        return handler(state);
      });
    }

    if (hasNode(normalizedPlan, EVALUATION_NODE_ID)) {
      workflow.addNode(EVALUATION_RETRY_GATE, async (state: GraphAgentState) => ({
        evaluationRetryCount: state.evaluationRetryCount + 1,
      }));
    }

    workflow.addEdge(START, normalizedPlan.entry as any);

    const outgoing = new Map<string, PlanEdge[]>();
    for (const edge of normalizedPlan.edges) {
      const list = outgoing.get(edge.from) ?? [];
      list.push(edge);
      outgoing.set(edge.from, list);
    }

    const compiledNodeIds = [
      ...normalizedPlan.nodes.map((node) => node.id),
      ...(hasNode(normalizedPlan, EVALUATION_NODE_ID) ? [EVALUATION_RETRY_GATE] : []),
    ];

    for (const nodeId of compiledNodeIds) {
      const edges = outgoing.get(nodeId) ?? [];
      if (edges.length === 0) {
        workflow.addEdge(nodeId as any, END);
        continue;
      }

      if (edges.length === 1 && !edges[0].when) {
        workflow.addEdge(nodeId as any, edges[0].to as any);
        continue;
      }

      workflow.addConditionalEdges(
        nodeId as any,
        (state: GraphAgentState) => {
          const match = edges.find((edge) => shouldFollowCondition(state, edge.when));
          return (match?.to ?? END) as any;
        },
        Object.fromEntries(edges.map((edge) => [edge.to, edge.to])) as any,
      );
    }

    return workflow.compile();
  }
}
