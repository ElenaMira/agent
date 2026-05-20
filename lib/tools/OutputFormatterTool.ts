import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

// 1. 定义 schema
const schema = z.object({
  tone: z.enum(["positive", "negative", "neutral"]).describe("The overall tone of the input"),
  entity: z.string().describe("The main entity mentioned in the input"),
  word_count: z.number().describe("The number of words in the input"),
  chat_response: z.string().describe("The response to the input"),
  token_count: z.number().describe("The number of tokens in the response"),
  final_punctuation: z.string().optional().describe("The final punctuation of the response"),
});

// 2. 绑定模型
const baseModel = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.2 });
const structuredModel = baseModel.withStructuredOutput(schema, {
  name: "output_formatter",
});

export const formatOutput = async (input: any) => {
  console.log("input",input);
  return structuredModel.invoke(input);
}

// 3. 包装成工具
export const OutputFormatterTool = tool(
    formatOutput,
  {
    name: "output_formatter",
    description: "Analyze text and return structured tone/entity/word_count/token_count/etc.",
    schema: z.object({
      text: z.string().describe("The text to analyze"),
    }),
  }
);