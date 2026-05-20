import { AIMessage, BaseMessage, SystemMessage } from "@langchain/core/messages";
import { StateGraph, START, END } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";

// 假设这些工具和构建函数已正确导入
import { condenseQuestionLogic, CondenseQuestionTool } from "../tools/CondenseQuestionTool";
import { ragQueryLogic, RagQueryTool } from "../tools/RagTool";
import { buildExecutionAgent } from "../agent/ExecutionAgent"; // 假设这个函数返回一个 LangChain RunnableAgent
import { imageAnalysisLogic } from "../tools/VisionTool";
import { generateImageFunc } from "../tools/GenerateImageTool";
import { searchTrendsLogic } from "../tools/SearchTool";
import { generateFinalCopyLogic } from "../tools/generateFinalCopyLogic";

// 定义图的状态结构
export const AgentState = Annotation.Root({
    // 原始消息和历史记录
    messages: Annotation<BaseMessage[]>,
    // 路由选中的工具名称
    selectedTools: Annotation<string[]>,
    // LLM 在 AgentExecutor 步骤中的 scratchpad
    agent_scratchpad: Annotation<BaseMessage[]>,
    // 经过 CondenseQuestionTool 浓缩后的独立问题
    standalone_question: Annotation<string>, 
    // RAG 查询后的合并上下文
    combined_context: Annotation<string>,
    // 最终的输出，用于判断是否结束
    final_output: Annotation<string | object>, 
    // 图像分析后的描述
    image_description: Annotation<string>,
    // 生成的图像 URL
    generated_image_url: Annotation<string>,
    // 搜索趋势结果
    search_trends_result: Annotation<string>,
  });
  

// 定义 StateGraph 的参数类型 (保持不变)
export type StateType = typeof AgentState.State;

function isSystemMessage(message: BaseMessage) {
  return (
    message instanceof SystemMessage ||
    (typeof (message as any).getType === "function" &&
      (message as any).getType() === "system") ||
    (message as any).role === "system"
  );
}

function getSystemPrompt(messages: BaseMessage[]) {
  const firstMessage = messages[0];
  if (!firstMessage || !isSystemMessage(firstMessage)) {
    return "";
  }

  return typeof firstMessage.content === "string"
    ? firstMessage.content
    : JSON.stringify(firstMessage.content);
}

function getConversationMessages(messages: BaseMessage[]) {
  if (messages.length === 0) return [];
  return isSystemMessage(messages[0]) ? messages.slice(1) : messages;
}

function extractFinalOutput(messages: BaseMessage[]) {
  const lastMessage = [...messages]
    .reverse()
    .find((message) => !isSystemMessage(message));

  if (!lastMessage) return "";

  if (typeof lastMessage.content === "string") {
    return lastMessage.content;
  }

  if (Array.isArray(lastMessage.content)) {
    return lastMessage.content
      .map((part: any) => {
        if (part?.type === "text") return part.text ?? "";
        return "";
      })
      .join("\n");
  }

  return String(lastMessage.content ?? "");
}

/**
 * 核心：LangGraph 工作流构建和运行函数
 * 实现了基于工具选择的 CondenseQuestionTool -> RagQueryTool 强制链式调用。
 */
export async function runRagAgentGraph() { // initialState 可能会在 invoke 时传入，这里签名简化
    
    // 实例化 StateGraph，传入状态定义
    const workflow = new StateGraph(AgentState);
    
    // --- 1. 定义节点 (Nodes) ---
    // RAG 链节点 1: 浓缩问题
    workflow.addNode("condense_question", async (state: StateType) => {
        console.log("-> Executing CondenseQuestionTool");
        const conversationMessages = getConversationMessages(state.messages);
        const { standalone_question } = await condenseQuestionLogic({
            messages: conversationMessages.map((message: any) => ({
                role: message.getType?.() ?? message.role ?? "message",
                content: typeof message.content === "string"
                  ? message.content
                  : JSON.stringify(message.content),
            })),
        });
        return { standalone_question: standalone_question };
    });
    // RAG 链节点 2: RAG 查询
    workflow.addNode("rag_query", async (state: StateType) => {
        console.log("-> Executing RagQueryTool");
    // 假设 RagQueryTool.invoke 返回一个包含 combined_context 的对象
    // 1. 调用核心逻辑，传入状态中经过 CondenseQuestionTool 处理后的 standalone_question
    const { documents, combined_context } = await ragQueryLogic(state.standalone_question);

    // 2. 返回 LangGraph 期望的状态更新对象
    return { 
        // 传递合并后的上下文，供 Agent 使用
        combined_context: combined_context, 
        // ⚠️ 可选：如果需要在状态中存储原始文档对象，可以添加一个字段：
        // raw_documents: documents 
    };
    });
    
    // 核心执行节点: ReAct Agent
    workflow.addNode("agent", async (state: StateType) => {
        console.log("-> Executing Core ReAct Agent");
        const systemPrompt = getSystemPrompt(state.messages);
        const conversationMessages = getConversationMessages(state.messages);
        const agentExecutor = await buildExecutionAgent(
          state.selectedTools,
          systemPrompt,
        );

        const result = await agentExecutor.invoke({
          messages: conversationMessages,
        });

        const nextMessages = Array.isArray((result as any).messages)
          ? ([...state.messages.slice(0, 1), ...(result as any).messages] as BaseMessage[])
          : state.messages;

        return { 
            messages: nextMessages,
            final_output: extractFinalOutput(nextMessages),
        };
    });

    // --- 2. 定义边缘和路由 ---
    
    // A. 条件路由 (Decider Node): 从 START 开始，决定走向
    workflow.addConditionalEdges(
        START, // ⚠️ 使用 START 作为 LangGraph 的标准起始点
        (state: StateType) => {
            // 路由函数：如果 selectedTools 包含 RagQueryTool (即需要 RAG 流程)
            if (state.selectedTools && state.selectedTools.includes("RagQueryTool")) {
                console.log("Route Decision: RAG Chain");
                return "rag_chain";
            }
            console.log("Route Decision: Agent Tool Choice");
            return "agent_tool_choice";
        },
        {
            // 路由映射
            "rag_chain": "condense_question", // 需要 RAG，进入 CondenseQuestionTool
            "agent_tool_choice": "agent",       // 不需要 RAG，直接进入 Agent 自由选择工具
        }as any
    );//使用 as any 忽略严格的类型检查 ⬆️
    
    // B. RAG 链的强制顺序 (Condense -> Query)
    workflow.addEdge("condense_question" as any, "rag_query" as any); 
    
    // C. RAG 结束后，进入 Agent 节点 (Query -> Agent)
    workflow.addEdge("rag_query" as any, "agent" as any); 
    
    // D.  Agent 节点结束
    // 假设 Agent 节点返回结果后，流程结束。
    workflow.addEdge("agent" as any, END);
    
    // --- 3. 编译图 ---
    const RAGApp = workflow.compile();
    return RAGApp;
}

export  function runGenerateImageAgentGraph() {
    const workflow = new StateGraph(AgentState);
    
    // 1. 添加节点 (AnalyzeImage, GenerateImage, SearchTrends, FormatOutput)
    workflow.addNode("analyze_image", async (state: StateType) => {
        console.log("-> Executing AnalyzeImageTool");
        // 1. 传入 LangGraph 状态中的 messages
        // 假设最后一个消息包含图像 URL
        const lastMessage = state.messages[state.messages.length - 1];
        const imageUrl = (lastMessage.content as Array<any>).find(c => c.image_url)?.image_url.url;
        // 返回状态更新：设置 image_description
        if (!imageUrl) {
             throw new Error("No image URL found in the last message.");
        }
        const analysis = await imageAnalysisLogic({ 
            image_url: imageUrl,
        });
        return { image_description: analysis };
    });
    
    // 节点 C: 搜索趋势 (SearchTrends) - 新增
    workflow.addNode("search_trends", async (state: StateType) => {
        console.log("-> Executing SearchTrendsTool");
        // 1. 使用原始输入消息或分析结果进行搜索
        const prompt = state.messages[state.messages.length - 1].content.toString();
        const imageDescription = state.image_description;
        const query = `${prompt} +"\n" +"结合以下图像描述，搜索相关知识" +${imageDescription}`;
        // 2. 调用核心逻辑
        const { trends_result } = await searchTrendsLogic(query);

        // 3. 返回状态更新
        return { search_trends_result: trends_result };
    });
        // 节点 B: 生成图像 (GenerateImage) - 新增
    workflow.addNode("generate_image", async (state: StateType) => {
        console.log("-> Executing GenerateImageTool");
        // 1. 
        const prompt = state.image_description; 
        
        // 2. 调用核心逻辑
        const  generated_image = await generateImageFunc({prompt});

        // 3. 返回状态更新
        return { generated_image_url: (generated_image.content as Array<any>).find(c => c.image_url)?.image_url.url};
    });
    
        workflow.addNode("format_output", async (state: StateType) => {
        console.log("-> Executing FormatOutputTool: Generating Final Response");
        
        // 1. 生成最终的广告文案（需要调用 LLM）
        const finalCopy = await generateFinalCopyLogic({
            userPrompt: state.messages[state.messages.length - 1].content.toString(),
            imageDescription: state.image_description,
            trends: state.search_trends_result,
            imageUrl: state.generated_image_url,
        });

        // 2. 包装 AI 消息，包含文本和图像附件
        const finalAiMessage = new AIMessage({
            content: finalCopy, // 广告文案
            additional_kwargs: {
                experimental_attachments: [
                    {
                        url: state.generated_image_url,
                        contentType: "image/png" // 或其他类型
                    }
                ]
            }
        });
        // 3. 返回状态更新
        return { 
            // 确保将 LLM/逻辑链的文本输出作为 final_output
            final_output: finalCopy, 
            // 关键：将完整的 AI 消息（包含图像 URL）添加到消息历史中
            messages: [...state.messages, finalAiMessage] 
        };
    });
    // 1. 从 START 到 analyze_image
    workflow.addEdge(START, "analyze_image" as any);
    // 2. 实现并行：analyze_image 同时指向 generate_image 和 search_trends
    workflow.addEdge("analyze_image" as any, "generate_image" as any);
    workflow.addEdge("analyze_image" as any, "search_trends" as any);
    // 3. 汇聚：在 format_output 之前，需要等待 generate_image 和 search_trends 都完成
    // LangGraph 默认支持多入边，只有当所有入边（来自 generate_image 和 search_trends）
    // 都执行完毕后，才会执行 format_output 节点。
    workflow.addEdge("generate_image" as any, "format_output" as any);
    workflow.addEdge("search_trends" as any, "format_output" as any);

    // 4. 结束
    workflow.addEdge("format_output" as any, END);
    return  workflow.compile();
}


export const graphs = runGenerateImageAgentGraph();
export function runDefaultAgentGraph() {
}
