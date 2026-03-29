import { NextRequest, NextResponse } from "next/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAIEmbeddings } from "@langchain/openai";

export const runtime = "nodejs"; // 关键！必须是 Node 环境

export async function POST(req: NextRequest) {
  try {
    // 1. 读取 FormData
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 2. 读取文件内容为 ArrayBuffer
    const arrayBuf = await file.arrayBuffer();

    // ✔ 3. 转成 Blob（PDFLoader 支持 Blob）
    const blob = new Blob([arrayBuf], { type: "application/pdf" });

    // ✔ 4. 加载 PDF 内容
    const loader = new PDFLoader(blob);
    const docs = await loader.load();

    // 5. 文本分块
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });

    const splitDocs = await splitter.splitDocuments(docs);

    // 6. 存入 Supabase 向量数据库
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!
    );

    await SupabaseVectorStore.fromDocuments(
      splitDocs,
      new OpenAIEmbeddings(),
      {
        client,
        tableName: "documents",
        queryName: "match_documents",
      }
    );

    return NextResponse.json(
      { success: true, chunks: splitDocs.length },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
