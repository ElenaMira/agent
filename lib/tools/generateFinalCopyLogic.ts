// 文件名：../tools/FormatOutputTool.ts

import { ChatOpenAI } from "@langchain/openai"; // 或您使用的任何 ChatModel
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// 定义输入类型，与您调用时传入的参数匹配
interface FinalCopyInput {
    userPrompt: string;
    imageDescription: string;
    trends: string;
    imageUrl: string; // 尽管文案本身不直接需要 URL，但作为上下文传递
}

/**
 * 核心逻辑：调用 LLM 综合所有信息，生成最终的广告文案。
 * * @param input 包含所有上下文信息的对象。
 * @returns 最终生成的广告文案字符串。
 */
export async function generateFinalCopyLogic(input: FinalCopyInput): Promise<string> {
    console.log("-> Generating Final Copy (Ad/Response Text) using LLM.");

    // 1. 实例化 LLM 客户端
    // ⚠️ 确保 process.env.OPENAI_API_KEY 或其他模型配置已设置
    const model = new ChatOpenAI({
        model: "gpt-4o-mini", // 推荐使用强大的多模态或指令遵循模型
        temperature: 0.7, // 适当的创造性
    });

    // 2. 构建系统级 Prompt（指导 LLM 的角色和任务）
    const systemInstruction = `
        你是一个专业的创意总监和内容营销专家。你的任务是根据以下提供的所有上下文信息，
        为用户生成一张新生成的电商广告图（内容与图像描述相关）撰写一段极具吸引力和销售力的广告文案。
        
        要求：
        1. 风格：专业、有吸引力，契合电商广告的语境。
        2. 长度：中等到偏长的段落（大约 3-5 句话）。
        3. 内容：
           - 必须回应用户最初的请求。
           - 必须结合图像描述的**核心主题和风格**。
           - 必须融入**搜索趋势结果**中提供的最新市场洞察。
           - **不要**提及你是一个AI或提及其它工具，直接给出文案。
           - **不要**包含 "【" 或 "】" 等标记。
        输出格式：
            - **文案的开头或结尾必须包含图片的 Markdown 格式链接：** \n\n\`![Generated Ad Image](${input.imageUrl})\`。
            - 确保文案本身与图片描述和趋势完美融合。
    `;

    // 3. 构建用户级 Prompt（传递所有上下文数据）
    const userMessageContent = `
        用户原始请求: ${input.userPrompt}
        
        ---
        
        **图像分析和主题（关键信息）:**
        ${input.imageDescription}
        
        ---
        
        **实时市场和趋势洞察 (用于提高文案的时效性和吸引力):**
        ${input.trends}
        
        ---
        **已生成的图片链接（请将此链接嵌入到最终文案中）:**
        ${input.imageUrl}

        请现在根据以上所有信息，为生成的图片撰写一段最终的电商广告文案：
    `;

    // 4. 调用 LLM
    try {
        const response = await model.invoke([
            new SystemMessage(systemInstruction),
            new HumanMessage(userMessageContent),
        ]);

        console.log("-> Final Copy Generation Success.");

        // 5. 返回生成的文案
        return response.content.toString().trim();

    } catch (error) {
        console.error("Error during final copy generation LLM call:", error);
        // 优雅降级：如果 LLM 调用失败，使用一个简单的默认文案
        return `我们已为您生成了参考图片（URL: ${input.imageUrl}）。
        抱歉，由于创意生成服务暂时繁忙，未能为您提供定制广告文案。
        图片描述：${input.imageDescription}`;
    }
}