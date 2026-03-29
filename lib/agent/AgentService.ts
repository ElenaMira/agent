import { convertLangChainMessageToVercelMessage } from "../converters/Messages";
import {  BaseMessage } from "@langchain/core/messages";
import { RouteAgent } from "./RouteAgent";
import { buildExecutionAgent } from "./ExecutionAgent";

import { runRagAgentGraph,AgentState,StateType, runGenerateImageAgentGraph } from "./LangGraph";  

// export class AgentService {  
//   async invoke(messages:BaseMessage[]) {
//     // --- 1. 拆分历史和最新输入 (按照我们之前的讨论) ---
//     const latestMessage = messages[messages.length - 1];
//     const chatHistory = messages.slice(0, messages.length - 1); 

//     const selectedTools = await RouteAgent(latestMessage);//可以将系统和对话提示词解耦
//     console.log("路由结果:"+ selectedTools);

//     const ExecutorAgent = await buildExecutionAgent(selectedTools);
//     const result = await ExecutorAgent.invoke(
//         {
//             messages:latestMessage,
//         },
//         {
//             recursionLimit: 4,
//         }
//     );
//       return({messages: result.messages.map(convertLangChainMessageToVercelMessage),})
//   }
// }

export const AgentType: Record<string, number> = {
    GenerateImage: 0,
    RagQuery: 1,
    Default: 2,
}

// 使用 Record<number, any> 或 Map 来缓存不同的编译图
// 缓存结构：{ AgentType.RagQuery: compiledGraphInstance, ... }
const compiledGraphCache: Record<number, Awaited<ReturnType<typeof runRagAgentGraph>> | null> = {
    [AgentType.GenerateImage]: null,
    [AgentType.RagQuery]: null,
    [AgentType.Default]: null,
};

export class AgentService {

    /**
     * 优化：如果 LangGraph App 尚未编译，则进行编译。
     */
    private async getCompiledGraph(type:number): Promise<Awaited<ReturnType<typeof runRagAgentGraph>>> {
      // 1. 检查缓存
        if (compiledGraphCache[type]) {
            return compiledGraphCache[type]!;
        }

        console.log(`Compiling LangGraph workflow for type: ${AgentType[type]}`);
        
        // 2. 根据类型选择编译函数
        let app;
        switch (type) {
            case AgentType.GenerateImage:
                app = await runGenerateImageAgentGraph();
                break;
            case AgentType.RagQuery:
                app = await runRagAgentGraph();
                break;
            case AgentType.Default:
                app = await runGenerateImageAgentGraph();
                break;
            default:
                throw new Error(`Unknown AgentType: ${type}`);
        }
        
        // 3. 存入缓存并返回
        compiledGraphCache[type] = app;
        return app;
    
    }

    async invoke(messages: BaseMessage[]) {
        // --- 1. 路由 (RouteAgent) ---
        const latestMessage = messages[messages.length - 1];
        // 🚨 路由逻辑保持不变，但其结果用于 LangGraph 的初始状态
        const selectedTools = await RouteAgent(latestMessage);
        console.log("路由结果 (selectedTools):", selectedTools);

        // --- 1.5. 确定 Agent Type ---
        let typeToUse: number;
        if (selectedTools.includes("GenerateImageTool")) {
            // 图像生成链的优先级最高
            typeToUse = AgentType.GenerateImage;
        } else if (selectedTools.includes("RagQueryTool")) {
            // RAG 链的优先级次之
            typeToUse = AgentType.RagQuery;
        } else {
            // 默认进入自由 Agent 模式
            typeToUse = AgentType.Default;
        }
        // --- 2. 准备 LangGraph 初始状态 (Initial State) ---
        const initialState: StateType = {
            // 传入所有的消息历史
            messages: messages, 
            // 传入路由选定的工具
            selectedTools: selectedTools, 
            // 其他字段初始化为空或默认值
            agent_scratchpad: [],
            standalone_question: "", 
            combined_context: "",
            final_output: "",
            // 图像分析后的描述
            image_description: "",
            // 生成的图像 URL
            generated_image_url: "",
            // 搜索趋势结果
            search_trends_result: "",
        };
        const app = await this.getCompiledGraph(typeToUse);
        console.log(`Invoking LangGraph App [Type: ${AgentType[typeToUse]}]...`);
        
        // ⚠️ LangGraph 的核心调用，替代了原有的 ExecutorAgent.invoke
        const finalState = await app.invoke(initialState);
        
        // --- 4. 结果解析 ---
        
        // LangGraph 运行结束后，最终结果存在于 finalState 中。
        // 我们提取最终的消息历史或最终的输出字段。
        const finalMessages = finalState.messages.slice(1); // 移除初始消息
        const finalOutput = finalState.final_output; // 最终输出可能被 AnswerTool 设置
        
        console.log("LangGraph Execution Finished. Final Messages Count:", finalMessages.length);
        
        // 检查 finalOutput 是否存在（例如，如果 Agent 成功调用了 OutputFormatterTool）
        if (finalOutput && typeof finalOutput === 'string') {
            // 如果 final_output 存在，可以将其转换为最终消息（视您的业务逻辑而定）
            // 这里我们直接返回 LangGraph 状态中的消息历史
        }

        return {
            // 返回 Vercel 格式的消息，使用 LangGraph 运行后的最终消息列表
            messages: finalMessages.map(convertLangChainMessageToVercelMessage),
        };
    }
}
