import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { OpenAI } from "@langchain/openai";

const textAnalysisSchema = z.object({
    input: z.string().describe("The human message to chat."),
    word_count: z.number().describe("The number of words in the input"),
    response: z.string().describe("The response message from the chatbot."),
    temperature: z.number().describe("The temperature of the chatbot."),
    max_tokens: z.number().describe("The maximum number of tokens in the response."),
});

// 1. 定义 func
const ChatFunc = async (input: z.infer<typeof textAnalysisSchema>) => {
    const llm = new OpenAI({
        model: "gpt-4o-mini",
        temperature: 0.2,
        maxTokens: input.max_tokens,
    });
    const response = await llm.invoke(input.input);
    return response;
};

export const ChatTool = tool(
    // 传入 func 作为第一个参数
    ChatFunc, 
    // 传入 fields 对象作为第二个参数
    {
        name: "chatTool",
        description: "Chat with the user.",
        schema: textAnalysisSchema,
    }
);