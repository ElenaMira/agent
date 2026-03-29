import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

// 回答模板
const ANSWER_TEMPLATE = `
You are a helpful assistant.
Answer the question based only on the following context and chat history:

<context>
  {context}
</context>

<chat_history>
  {chat_history}
</chat_history>

Question: {question}
`;

const answerPrompt = PromptTemplate.fromTemplate(ANSWER_TEMPLATE);
const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0.2 });

// 工具函数
const answerFunc = async (input: { context: string; chat_history: string; question: string }) => {
  const result = await answerPrompt.pipe(model).invoke({
    context: input.context,
    chat_history: input.chat_history,
    question: input.question,
  });
  return { answer: result.content.toString() };
};

// 封装成工具
export const AnswerTool = tool(answerFunc, {
  name: "rag_answer",
  description: "Generate final answer based on context and history.",
  schema: z.object({
    context: z.string().describe("The retrieved context or documents."),
    chat_history: z.string().describe("The previous conversation history."),
    question: z.string().describe("The user question."),
  }),
});
