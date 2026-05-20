import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";


//把从数据库里拿到的多个文档，拼接成一段文本供模型参考。
const combineDocumentsFn = (docs: Document[]) => {
  const serializedDocs = docs.map((doc) => doc.pageContent);
  return serializedDocs.join("\n\n");
};

const ragQuerySchema = z.object({
  query: z.string().describe("The query string to search."),
  chat_history: z.string().describe("The previous conversation history."),
});

const sbRagQuery = async (input: { query: string, chat_history: string }) => {
    //1. 连接 Supabase + 初始化向量存储
    const client = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_PRIVATE_KEY!,
    );
    const vectorstore = new SupabaseVectorStore(new OpenAIEmbeddings(), {
        client,
        tableName: "documents",
        queryName: "match_documents",//RPC调用（SQL function）
    });
    if (!vectorstore) {
        throw new Error("Supabase vector store not initialized");
    }
        // 生成待处理(延迟)提示词(等待传入文档的提示词)
    let resolveWithDocuments: (value: Document[]) => void;
    const documentPromise = new Promise<Document[]>((resolve) => {
      resolveWithDocuments = resolve;
    });
    // 2. 调用 retriever
      const retriever = vectorstore.asRetriever({
        //回调钩子:用于拦截事件:以下为检索结束
        //LLM 开始/结束 ,工具开始/结束 ,Retriever 开始/结束
        callbacks: [
          {
            handleRetrieverEnd(documents) {
              console.log("🔍 Retrieved documents:", documents);//打印出检索到的文档
              resolveWithDocuments(documents);
            },
          },
        ],
      });
    const docs = await retriever.invoke(input.query);

    console.log("🔍 Retrieved documents:", docs);
      // 3. 返回结构化结果
    return {
      query: input.query,
      documents: docs.map((d) => d.pageContent),
      combined: combineDocumentsFn(docs),
    };
}

export const RagQueryTool = tool(
    sbRagQuery,
    {
    name: "RagQueryTool",
    description: "Search internal knowledge base. Input: query string.",
    schema: ragQuerySchema,
    },
);
export const ragQueryLogic = async (query: string) => {
    // 1. 连接 Supabase + 初始化向量存储
    const client = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_PRIVATE_KEY!,
    );
    // 确保使用正确的 API Key 和配置初始化 OpenAIEmbeddings
    const embeddings = new OpenAIEmbeddings({
        // modelName: "text-embedding-ada-002", // 可选配置
    });

    const vectorstore = new SupabaseVectorStore(embeddings, {
        client,
        tableName: "documents",
        queryName: "match_documents",
    });

    if (!vectorstore) {
        throw new Error("Supabase vector store not initialized");
    }

    // 2. 调用 retriever
    // 注意：去除了原代码中未使用的 documentPromise 和 resolveWithDocuments
    const retriever = vectorstore.asRetriever({
        // 可选：在这里添加 callbacks 钩子来打印日志
    });
    
    // 执行检索
    const docs = await retriever.invoke(query);

    console.log("🔍 Retrieved documents:", docs);

    // 3. 返回结构化结果
    return {
        documents: docs, // 返回 Document[] 数组
        combined_context: combineDocumentsFn(docs), // 返回合并后的文本
    };
};


