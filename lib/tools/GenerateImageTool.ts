import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { OpenAI } from "openai";
import { AIMessage } from "@langchain/core/messages";

const openai = new OpenAI()

const generateImageSchema = z.object({
  prompt: z.string().describe("The detailed, descriptive text for the image to be generated."),
})

// 1. 定义工具函数
export const generateImageFunc = async (input: z.infer<typeof generateImageSchema>) => {
  const { prompt } = input;
  const result = await openai.images.generate({
    model: "dall-e-2",
    prompt: `Generate an image based on the following description: ${prompt}`,
    size: "1024x1024",
    n:1,
  });
  const url = result.data?.[0]?.url || ""
  console.log("url:", url)
  return new AIMessage({
    content: [
      {
        type: "text",
        text: "这是为你生成的图像："
      },
      {
        type: "image_url",
        image_url: { url }
      }
    ],
    additional_kwargs: {
      experimental_attachments: [
        { url, contentType: "image/png", name: "generated-image.png" },
      ],
    },
  });
};

// 2. 封装成 Tool
export const GenerateImageTool = tool(generateImageFunc, {
  name: "generate_image",
  description: "Generate a new image based on a user's descriptive prompt."+
  "After receiving the image URL, **immediately transition to the Final Answer** step without calling any other tools, including this one.",
  schema: generateImageSchema
});

// import { tool } from "@langchain/core/tools";
// import { z } from "zod";
// import { OpenAI } from "openai";
// import { AIMessage } from "@langchain/core/messages";

// const openai = new OpenAI();

// // 1. 定义更灵活的输入 Schema
// const generateImageSchema = z.object({
//   prompt: z.string().describe("The detailed, descriptive text for the image to be generated."),
//   // 优化：添加可选的 size 参数，让 Agent 可以选择图片大小
//   size: z.enum(["256x256", "512x512", "1024x1024"]).optional().describe("The desired resolution of the image. Defaults to 1024x1024 if not specified."),
//   // 优化：添加可选的模型参数，方便切换到 DALL-E 3
//   model: z.enum(["dall-e-2", "dall-e-3"]).optional().describe("The DALL-E model to use for generation. DALL-E 3 is recommended for better quality and prompt adherence. Defaults to dall-e-2."),
//   n:z.number().int().positive().optional().describe("The number of images to generate. Defaults to 1 if not specified."),
// });


// // 2. 优化工具函数
// const generateImageFunc = async (
//   input: z.infer<typeof generateImageSchema>
// ): Promise<any> => {
//   const { 
//       prompt, 
//       size = "256x256", // 设置默认值
//       model = "dall-e-2" ,
//       n = 1,
//   } = input;

//   try {
//     // 优化 LLM 提示：直接使用用户提示，避免冗余的 "Generate an image based on..." 前缀
//     const result = await openai.images.generate({
//       model: model, 
//       prompt: prompt, // 使用原始提示
//       n: n,
//       size: size, 
//       response_format: "url", // 确保返回 URL
//     });

//     const url = result.data?.[0]?.url;

//     if (!url) {
//         // 优化：如果 API 没有返回 URL，抛出错误
//         throw new Error("DALL-E API 未返回有效的图片 URL。");
//     }
//     console.log(url)
//     // 优化输出：使用更简洁和明确的格式，确保 Vercel AI SDK 能够识别
//     return new AIMessage({
//       // 1. LLM 主内容：提供给 LLM 流程的文本描述
//       content: [
//         {
//           type: "text",
//           text: `图像生成成功。这是为你生成的图片链接：${url}。`,
//         },
//         // 2. 确保包含 image_url 类型用于多模态链
//         {
//           type: "image_url",
//           image_url: { url },
//         },
//       ],
//       // 3. Vercel 附件兼容性：确保 attachments 放在 additional_kwargs
//       additional_kwargs: {
//         experimental_attachments: [
//           { url, contentType: "image/png", name: "generated-image.png" },
//         ],
//       },
//     });
//   } catch (error) {
//     if (error instanceof Error) {
//       // 此时 TypeScript 知道 error 具有 message 属性
//       console.error(error.message); 
//       throw new Error(`图像生成失败，错误详情: ${error.message || "未知错误"}`);
//     } else {
//       // 处理非 Error 类型的抛出值
//       console.error("发生了未知错误:", error);
//       throw new Error(`图像生成失败，错误详情: ${error || "未知错误"}`);
//     }
//   }
// };

// // 3. 封装成 Tool
// export const GenerateImageTool = tool(generateImageFunc, {
//   name: "generate_image",
//   // 优化描述，指导 Agent 何时调用
//   description: "Generate a new image based on a user's descriptive prompt. Use this tool ONLY when the user explicitly asks to 'draw', 'generate an image', or 'create a picture'.",
//   schema: generateImageSchema,
// });