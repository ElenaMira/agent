import { BaseMessage } from "@langchain/core/messages";

export interface AgentSource {
  title?: string;
  url: string;
  snippet?: string;
}

export interface AgentContext {
  userId?: string;
  input: string;
  messages: BaseMessage[];
  memory?: string;
  tools?: string[];
  rag?: string;
}

export interface AgentResult {
  messages: Array<{
    role: string;
    content: string;
    tool_calls?: unknown;
    experimental_attachments?: Array<{
      url: string;
      contentType: string;
      name?: string;
    }>;
  }>;
  finalOutput: string;
  token?:number;
  sources?: AgentSource[];
  route?: RouteResult;
  steps?: PlanStep[];
}

export interface AgentEvaluation {
  score: number;
  passed: boolean;
  reason: string;
}

export interface AgentStateShape {
  userId?: string;
  input: string;
  messages: BaseMessage[];
  memory: string;
  systemPrompt: string;
  route?: RouteResult;
  steps: PlanStep[];
  decision?: ControllerDecision;
  plan?: ExecutionPlan;
  intermediate: {
    searchSummary?: string;
    ragContext?: string;
    imageAnalysis?: string;
    calculatorResult?: string;
  };
  finalOutput: string;
  sources: AgentSource[];
  evaluation?: AgentEvaluation;
  evaluationRetryCount: number;
  errors: string[];
}

export type RouteType =
  | "chat"
  | "qa"
  | "image"
  | "image_generation"
  | "research"
  | "rag"
  | "math"
  | "structured_output"
  | "multi_step";

export interface RouteNeeds {
  image: boolean;
  web: boolean;
  rag: boolean;
  calculator: boolean;
  structuredOutput: boolean;
  answer: boolean;
}

export interface RouteResult {
  route: RouteType;
  confidence: number;
  needs: RouteNeeds;
  reason: string;
}

export type PlanStep =
  | "condense_question"
  | "retrieve_context"
  | "analyze_image"
  | "search_trends"
  | "web_research"
  | "calculate"
  | "generate_answer"
  | "generate_copy"
  | "generate_image"
  | "format_output"
  | "evaluate_output"
  | "chat";

export interface PlannerInput {
  userInput: string;
  route: RouteResult;
  hasImage?: boolean;
  hasFiles?: boolean;
  requiresRecentInfo?: boolean;
  requiresStructuredOutput?: boolean;
}

export interface PlannerOutput {
  steps: PlanStep[];
  confidence: number;
  source: "rule" | "llm" | "hybrid";
}

export interface ControllerDecision {
  useMemory: boolean;
  useRAG: boolean;
  useTools: boolean;
  useEvaluator: boolean;
  allowParallel: boolean;
  maxRetries: number;
  qualityThreshold?: number;
  fallbackEnabled: boolean;
  mode: "fast" | "balanced" | "deep";
}

export interface ExecutionPlan {
  goal: string;
  entry: string;
  nodes: PlanNode[];
  edges: PlanEdge[];
  policies?: PlanPolicy;
}

export interface PlanNode {
  id: string;
  type: "tool" | "llm" | "retriever" | "evaluator" | "default";
  name: PlanStep;
  reads: string[];
  writes: string[];
  input?: Record<string, unknown>;
  onFail?: "abort" | "retry" | "fallback" | "skip";
  retry?: number;
}

export interface PlanEdge {
  from: string;
  to: string;
  when?: string;
}

export interface PlanPolicy {
  maxRetries?: number;
  qualityThreshold?: number;
  allowParallel?: boolean;
  timeoutMs?: number;
}
