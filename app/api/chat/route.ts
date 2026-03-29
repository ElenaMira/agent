import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import OpenAI from "openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

export const runtime = "edge";

const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};

const SYSTEM_PROMPT = `
You are an AI agent.
Automatically decide whether the user is asking for an image.
If user intent matches: "draw", "generate an image", "give me a picture", "make an image", "photo of ...",
you MUST call the "generate_image" tool.

Otherwise, respond normally with text.
`;

/**
 * This handler initializes and calls a simple chain with a prompt,
 * chat model, and output parser. See the docs for more information:
 *
 * https://js.langchain.com/docs/guides/expression_language/cookbook#prompttemplate--llm--outputparser
 */
export async function POST(req: NextRequest) {
  try {
    // 将json字符串转换为javascript对象
    const body = await req.json();
    const messages = body.messages ?? [];
    // 格式化历史记录
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    // 提取当前消息体(也就是当前的问题)
    const currentMessageContent = messages[messages.length - 1].content;
    const prompt = PromptTemplate.fromTemplate(SYSTEM_PROMPT);

    /**
     * You can also try e.g.:
     *
     * import { ChatAnthropic } from "@langchain/anthropic";
     * const model = new ChatAnthropic({});langchain-nextjs-template/app/api/chat/route.ts
     *
     * See a full list of supported models at:
     * https://js.langchain.com/docs/modules/model_io/models/
     */
    // 初始化OpenAI模型
      const openai = new OpenAI();

      const result = await openai.images.generate({
        model: "dall-e-2",
        prompt: "a white siamese cat",
        size: "1024x1024",
      });

      console.log(result?.data?.[0]?.url);
    // /**
    //  * Chat models stream message chunks rather than bytes, so this
    //  * output parser handles serialization and byte-encoding.
    //  */
    // const outputParser = new HttpResponseOutputParser();

    // /**
    //  * Can also initialize as:
    //  *
    //  * import { RunnableSequence } from "@langchain/core/runnables";
    //  * const chain = RunnableSequence.from([prompt, model, outputParser]);
    //  */
    // const chain = RunnableSequence.from([prompt, llmWithImageGeneration, outputParser]);

    // const stream = await chain.stream({
    //   chat_history: formattedPreviousMessages.join("\n"),
    //   input: currentMessageContent,
    // });
      return NextResponse.json({
        messages: [
          {
            role: "assistant",
            content: result.data?.[0]?.url,   // 保留多模态 blocks
          }
        ]
      });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
