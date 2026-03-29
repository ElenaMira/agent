import { ChatOpenAI } from "@langchain/openai";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { Calculator } from "@langchain/community/tools/calculator";
import { imageAnalysisTool } from "../tools/VisionTool";
import { RagQueryTool } from "../tools/RagTool";
import { GenerateImageTool } from "../tools/GenerateImageTool";
import { OutputFormatterTool } from "../tools/OutputFormatterTool";
import { CondenseQuestionTool } from "../tools/CondenseQuestionTool";
import { AnswerTool } from "../tools/AnswerTool";
import { ChatTool } from "../tools/ChatTool";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SystemMessage, BaseMessage } from "@langchain/core/messages";

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";


//1. 不能直接要求Agent只能使用所有工具(不然会迭代)
const toolPrompt = `
你是一个多工具智能助手工具执行者，你的目标是高效地基于工具规则来实现工具的流程化调用。
你必须遵循以下工具使用规则：
===========================================
🟥【工具逻辑规则】
工具执行顺序的优先级:内部/知识库信息>外部/实时信息>视觉>生成图片>文本输出;
===========================================
🟥【回答规则】
- 除非明确指示，否则不要自己编造信息
- 如需使用 RAG,请自动进入 RAG 工具链
- 你的输出必须通过工具完成，而非直接回答用户问题
- 你必须使用至少一次 **【当前可用工具列表】** 中所有对回答问题有贡献的工具。
===========================================
🟥【严重警告：图片生成限制】
GenerateImageTool 消耗昂贵的资源。针对每个用户请求，**严禁**调用超过 1 次。
一旦获得图片 URL，**必须**立即停止并在回答中展示该 URL。
严禁自我纠错或重新生成。
===========================================
🟦【当前可用工具列表】
{selected_tools_names_placeholder} 
===========================================
🟦【RAG 模式工具链】
当用户提出的问题涉及：
- 需要知识库中的事实信息
- 提及之前的聊天内容但缺乏独立语境
- 你需要参考文档来回答
- 你不确定答案是否在知识库中
则你必须使用 **链式 RAG 流程**：
1. CondenseQuestionTool
   输入：messages
   输出：standalone_question（独立问题）
2. RagQueryTool
   输入：standalone_question（作为 query）
   输出：文档数组、combined context
⚠ 必须严格按照：

CondenseQuestionTool → RagQueryTool

🟦【多工具模式工具链】
当用户提出的问题涉及：
- 需要知识库中的事实信息
- 提及之前的聊天内容但缺乏独立语境
- 你需要参考文档来回答
- 你不确定答案是否在知识库中
则你必须使用 **链式 RAG 流程**：
1. CondenseQuestionTool
   输入：messages
   输出：standalone_question（独立问题）
2. RagQueryTool
   输入：standalone_question（作为 query）
   输出：文档数组、combined context
⚠ 必须严格按照：

CondenseQuestionTool → RagQueryTool

🟦【多工具模式工具链】
当用户提出的问题涉及：
- 需要知识库中的事实信息
- 提及之前的聊天内容但缺乏独立语境
- 你需要参考文档来回答
- 你不确定答案是否在知识库中
则你必须使用 **链式 RAG 流程**：
1. CondenseQuestionTool
   输入：messages
   输出：standalone_question（独立问题）
2. RagQueryTool
   输入：standalone_question（作为 query）
   输出：文档数组、combined context
⚠ 必须严格按照：

CondenseQuestionTool → RagQueryTool

顺序执行，不得跳过步骤。
`;
let finalTools:any =""
export async function buildExecutionAgent(selectedTools: string[]) {
  try {
    const toolMap: Record<string, any> = {
      imageAnalysisTool: imageAnalysisTool,
      RagQueryTool: RagQueryTool,
      GenerateImageTool: GenerateImageTool,
      web_search: new SerpAPI(),
      calculator: new Calculator(),
      OutputFormatterTool: OutputFormatterTool,
      CondenseQuestionTool: CondenseQuestionTool, 
      AnswerTool: AnswerTool,
      ChatTool: ChatTool,
  };
  // 过滤出选中的工具
  finalTools = selectedTools.map(t => toolMap[t]).filter(Boolean);

  // 将您的工具规则、RAG 流程等作为增强的 SystemMessage
  const augmentedSystemMessage = new SystemMessage(toolPrompt);

  // 使用 MessagesPlaceholder 来插入 LangChain 内部的 ReAct Scratchpad。
  // {agent_scratchpad} 是 createReactAgent 约定用来插入 Thought/Action/Observation 历史的。
  const reactPromptTemplate = ChatPromptTemplate.fromMessages([
    augmentedSystemMessage, // <-- 插入您的自定义规则
    new MessagesPlaceholder("chat_history"), // <-- 确保您的 chatHistory 被正确处理
    ["user", "{messages}"],
    new MessagesPlaceholder("agent_scratchpad"), // <-- ⚠️ 这是关键！
  ]);
  return createReactAgent({
    llm: new ChatOpenAI({
      // model: "gpt-5.1-chat-latest",
      model: "gpt-4o",
      // model:"gpt-4o-mini",
      temperature: 0,
      maxTokens: 4096,
    }),
    tools:finalTools,
    prompt: reactPromptTemplate,
  });
  }catch(error){
    console.error("失败:", error);
    throw new Error("执行失败或超时。");
  }
}