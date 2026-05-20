import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export const BaseAgentState = {
  messages: Annotation<BaseMessage[]>,
  selectedTools: Annotation<string[]>,
  final_output: Annotation<string | object>,
};
