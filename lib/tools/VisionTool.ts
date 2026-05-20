import OpenAI from "openai";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { BaseMessage } from "@langchain/core/messages";


const visionInputSchema = z.object({
  image: z.string().describe("The URL or Base64 data string of the image requiring analysis. MUST be provided if VisionTool is called."),
  prompt: z.string().optional().describe("The prompt to guide the analysis."),
  detail: z.string().optional().describe("The detail level of the analysis."),
});

const visionModel = new OpenAI();
export const imageAnalysisFunc = async (input: { image: string; prompt?: string; detail?: string;}) => {
  const { image, prompt, detail } = input;  

  const result = await visionModel.responses.create({
    model: "gpt-4o-mini",
    input: [{
      role: "user",
      content: [
          { type: "input_text", text: prompt || "请分析图片内容" },// 提供默认提示
          { type: "input_image", image_url: image, detail: detail || "auto" },
        ],
      }]});
    if (!result.output_text) {
      throw new Error("图片分析失败: 模型未返回识别结果");
    }
    return {
      analysis: result.output_text + "\n" + "图片分析成功,以上为图片分析结果",
    };
}

export const imageAnalysisTool = tool(
      imageAnalysisFunc,
      {
          name: "imageAnalysisFunc",
          description: "A specialized tool for analyzing the content, style, text, or objects within an image. "
                + "Call this tool ONLY when the user's request includes an image attachment or refers to a previously processed image.",
          schema:visionInputSchema, 
      }
);



export const imageAnalysisLogic = async (input: { image_url: string; prompt?: string; }) => {
  const { image_url, prompt } = input;  
  const result = await visionModel.responses.create({
    model: "gpt-4o-mini",
    input: [{
      role: "user",
      content: [
          { type: "input_text", text: prompt || "请分析图片内容" },// 提供默认提示
          { type: "input_image", image_url: image_url, detail: "auto" },
        ],
      }]});
    if (!result.output_text) {
      throw new Error("图片分析失败: 模型未返回识别结果");
    }
    return {
      analysis: result.output_text + "\n" + "图片分析成功,以上为图片分析结果",
    };
}
