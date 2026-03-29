import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

// 改写问题的提示词
const CONDENSE_QUESTION_TEMPLATE = `
Given the conversation history and the latest user message,
rewrite the latest user message into an independent standalone question,
in its original language.

<chat_history>
{chat_history}
</chat_history>

Latest user message:
{latest_user_message}

Standalone question:
`;

const condenseQuestionPrompt = PromptTemplate.fromTemplate(
  CONDENSE_QUESTION_TEMPLATE
);

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

// 将 messages[] 解析成 chat_history + 最新用户消息
function extractHistory(messages: any[]) {
  const textParts = messages.map((m) => `${m.role}: ${m.content}`);
  const chat_history = textParts.slice(0, -1).join("\n");
  const latest = messages[messages.length - 1]?.content ?? "";
  return { chat_history, latest };
}

// ----------------- 工具函数 -----------------
const condenseQuestionFunc = async (input: { messages: any[] }) => {
  const { chat_history, latest } = extractHistory(input.messages);

  const result = await condenseQuestionPrompt
    .pipe(model)
    .pipe(new StringOutputParser())
    .invoke({
      chat_history,
      latest_user_message: latest,
    });

  return { standalone_question: result.trim() };
};

// ----------------- 封装成 LangChain Tool -----------------
export const CondenseQuestionTool = tool(condenseQuestionFunc, {
  name: "condense_question",
  description: "Rewrite a follow-up query into an independent standalone question.",
  schema: z.object({
    messages: z.array(
      z.object({
        role: z.string(),
        content: z.string(),
      })
    ),
  }),
});
// ----------------- 核心逻辑函数 -----------------
// 暴露为可直接调用的逻辑
export const condenseQuestionLogic = async (input: { messages: any[] }) => {
    const { chat_history, latest } = extractHistory(input.messages);

    const result = await condenseQuestionPrompt
        .pipe(model)
        .pipe(new StringOutputParser())
        .invoke({
            chat_history,
            latest_user_message: latest,
        });

    // 返回一个对象，包含我们需要的输出字段
    return { standalone_question: result.trim() };
};