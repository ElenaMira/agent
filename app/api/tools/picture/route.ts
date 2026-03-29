import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
    }

    // 1. 把上传的 File 读成 BASE64
    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    // 2. Vision 调用（必须严格符合 SDK 结构）
    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "描述图中物体的品牌和用途" },
            {
              type: "input_image",
              image_url: `data:${file.type};base64,${base64Image}`,
               detail: "low", 
            },
          ],
        },
      ],
    });

    return NextResponse.json({
      answer: response.output_text,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
