import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";
import { z } from "zod";

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import OpenAI from "openai";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import { Calculator } from "@langchain/community/tools/calculator";
import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { log } from "console";

export const runtime = "edge";

// 2. 转换消息格式 → LangChain 消息(id+role+content)
const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    const anyMsg = message as any;
    const attachments = anyMsg.experimental_attachments ?? [];
    if (attachments.length > 0) {
      const content: Array<any> = [{ type: "text", text: message.content }];
      for (const att of attachments) {
        const ct: string = att.contentType ?? "";
        if (ct.startsWith("image/")) {
          content.push({ type: "image_url", image_url: { url: att.url } });
        } else if (ct === "application/pdf") {
          // 将 PDF 作为提示文本注入（多模态模型可结合后续检索处理）
          content.push({ type: "text", text: `PDF 附件: ${att.name} (${att.url})` });
        }
      }
      return new HumanMessage({ content });
    }
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const convertLangChainMessageToVercelMessage = (message: ChatMessage | AIMessage | HumanMessage ) => {
  //后端的类型HumanMessage 对应前端的user
  if (message._getType() === "human") {
    return { content: message.content, role: "user" };
  }
  //后端的类型AIMessage 对应前端的assistant
  else if (message._getType() === "ai") {
    return {
      content: message.content,
      role: "assistant",
      tool_calls: (message as AIMessage).tool_calls,
    };
  } else {
    return { content: message.content, role: message._getType() };//比如:工具调用的回复 "tool"
  }
};

const SYSTEM_PROMPT = `
You are an AI agent.
Automatically decide whether the user is asking for an image.
If user intent matches: "draw", "generate an image", "give me a picture", "make an image", "photo of ...",
you MUST call the "generate_image" tool.

Otherwise, respond normally with text.
`;
/*
 * This handler initializes and calls an tool caling ReAct agent.
 * See the docs for more information:
 *
 * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
 */
export async function POST(req: NextRequest) {
  try {
    //1. 解析前端 body
    const body = await req.json();
    const returnIntermediateSteps = body.show_intermediate_steps;
    const messages = (body.messages ?? [])
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant",
      )
      .map(convertVercelMessageToLangChainMessage);

    // Requires process.env.SERPAPI_API_KEY to be set: https://serpapi.com/
    // You can remove this or use a different tool instead.

    //3. 创建 Tools + ChatOpenAI
    const chat = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.3,
    });
    const imageClient = new OpenAI();

    const generateImageSchema = z.object({
      prompt: z.string(),
      size: z.string().optional(),
    });

    // const imageTool = new DynamicStructuredTool({
    //   name: "generate_image",
    //   description: "Generate an image using gpt-image-1",
    //   schema: generateImageSchema,
    //   returnDirect: true,
    //   async func({ prompt }: z.infer<typeof generateImageSchema>) {
    //     const response = await imageClient.images.generate({
    //         model: "gpt-5",
    //         prompt: prompt,
    //         size: "1024x1024",
    //     });
    //     // 从 Response API 提取图片 base64(为什么结果会未定义)
    //     const imageData = response.output
    //       .find( (o) => o.type === "image_generation_call")
    //       ?.result;
    //     // // Save the image to a file(edge环境无法保存)
    //     // if (imageData.length > 0) {
    //     //   const imageBase64 = imageData[0];
    //     //   const fs = await import("fs");
    //     //   fs.writeFileSync("cat_and_otter.png", Buffer.from(imageBase64, "base64"));
    //     // }
    //     if (!imageData?.length) {
    //       return new AIMessage({
    //         content: "❌ Image generation failed.",
    //       });
    //     }
    //     return {
    //       role: "assistant",
    //       content: [
    //         { type: "text", text: "Here is your image!" },
    //         { type: "image", source_type: "base64", data: imageData },
    //           ],
    //       };
    //     },
    // });
    
    const tools = [new Calculator(), new SerpAPI()];

    /**
     * Use a prebuilt LangGraph agent.
     */
    //4. 创建 ReAct Agent
      const agent = createReactAgent({
        llm: chat,
        tools,
        /**
         * Modify the stock prompt in the prebuilt agent. See docs
         * for how to customize your agent:
         *
         * https://langchain-ai.github.io/langgraphjs/tutorials/quickstart/
         */
        messageModifier: new SystemMessage(SYSTEM_PROMPT),
      });
      //5. 判断是否需要中间步骤(由前端解析得到)
    if (!returnIntermediateSteps) {
      /**
       * Stream back all generated tokens and steps from their runs.
       *
       * We do some filtering of the generated events and only stream back
       * the final response as a string.
       *
       * For this specific type of tool calling ReAct agents with OpenAI, we can tell when
       * the agent is ready to stream back final output when it no longer calls
       * a tool and instead streams back content.
       *
       * See: https://langchain-ai.github.io/langgraphjs/how-tos/stream-tokens/
       */
      //异步事件迭代器
      const eventStream = await agent.streamEvents(
        { messages },
        { version: "v2" },//事件格式
      );

      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        //边调用生成eventstream,边将模型生成的内容发送给前端
        async start(controller) {
          for await (const { event, data } of eventStream) {
            // 过滤出 on_chat_model_stream 事件(包含模型生成的内容)
            if (event === "on_chat_model_stream") {
              // Intermediate chat model generations will contain tool calls and no content(解释不包含内容)
              //模型返回的内容包含tool_call,则不包含content
              if (!!data.chunk.content) {
                //将token发送给前端
                controller.enqueue(textEncoder.encode(data.chunk.content));
              }
            }
          }
          controller.close();
        },
      });

      return new StreamingTextResponse(transformStream);
    } else {
      /**
       * We could also pick intermediate steps out from `streamEvents` chunks, but
       * they are generated as JSON objects, so streaming and displaying them with
       * the AI SDK is more complicated.
       */
      const result = await agent.invoke({ messages });

      return NextResponse.json(
        {
          messages: result.messages.map(convertLangChainMessageToVercelMessage),
        },
        { status: 200 },
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
