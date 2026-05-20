import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";

import {
  AgentEvaluation,
  AgentSource,
  ControllerDecision,
  ExecutionPlan,
  PlanStep,
  RouteResult,
} from "@/lib/types/agent";

export const AgentStateAnnotation = Annotation.Root({
  userId: Annotation<string | undefined>,
  input: Annotation<string>,
  messages: Annotation<BaseMessage[]>,
  memory: Annotation<string>,
  systemPrompt: Annotation<string>,
  route: Annotation<RouteResult | undefined>,
  steps: Annotation<PlanStep[]>,
  decision: Annotation<ControllerDecision | undefined>,
  plan: Annotation<ExecutionPlan | undefined>,
  intermediate: Annotation<{
    searchSummary?: string;
    ragContext?: string;
    imageAnalysis?: string;
    calculatorResult?: string;
  }>,
  finalOutput: Annotation<string>,
  sources: Annotation<AgentSource[]>,
  evaluation: Annotation<AgentEvaluation | undefined>,
  evaluationRetryCount: Annotation<number>,
  errors: Annotation<string[]>,
});

export type GraphAgentState = typeof AgentStateAnnotation.State;
