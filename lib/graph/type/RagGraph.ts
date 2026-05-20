import { BaseAgentState } from "./BaseGraph";
import { Annotation } from "@langchain/langgraph";

// 1. 继承基础状态，扩展 RAG 字段
export const RagAgentStateAnnotation = {
  ...BaseAgentState,
  standalone_question: Annotation<string>,
  combined_context: Annotation<string>,
};

// 2. 创建 LangGraph 可识别的 Root State
export const RagAgentState = Annotation.Root(RagAgentStateAnnotation);

// 3. 导出自动推导的 TypeScript 类型
export type RagGraphState = typeof RagAgentState.State;