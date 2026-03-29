import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { createClient } from "@supabase/supabase-js";

import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { Document } from "@langchain/core/documents";
import { RunnableSequence } from "@langchain/core/runnables";
import {
  BytesOutputParser,
  StringOutputParser,
} from "@langchain/core/output_parsers";

export const runtime = "edge";


//把从数据库里拿到的多个文档，拼接成一段文本供模型参考。
const combineDocumentsFn = (docs: Document[]) => {
  const serializedDocs = docs.map((doc) => doc.pageContent);
  return serializedDocs.join("\n\n");
};
//格式化聊天历史（方便模型理解）
//Human: 你好
// Assistant: 汪汪～你好呀！
// Human: 什么是向量数据库？
const formatVercelMessages = (chatHistory: VercelChatMessage[]) => {
  const formattedDialogueTurns = chatHistory.map((message) => {
    if (message.role === "user") {
      return `Human: ${message.content}`;
    } else if (message.role === "assistant") {
      return `Assistant: ${message.content}`;
    } else {
      return `${message.role}: ${message.content}`;
    }
  });
  return formattedDialogueTurns.join("\n");
};
//问题改写模板（防止上下文丢失）
// 👉 功能：
// 当用户问“那它能搜索图片吗？”时，它会自动改写为
// 👉 “向量数据库能搜索图片吗？”
// （独立问题，避免因为省略主语导致检索失败）
const CONDENSE_QUESTION_TEMPLATE = `
Given the following conversation and a follow up question,
 rephrase the follow up question to be a standalone question, 
 in its original language.

<chat_history>
  {chat_history}
</chat_history>

Follow Up Input: {question}
Standalone question:`;
const condenseQuestionPrompt = PromptTemplate.fromTemplate(
  CONDENSE_QUESTION_TEMPLATE,
);
//回答模板
const ANSWER_TEMPLATE = `You are an energetic talking puppy named Dana, and must answer all questions like a happy, talking dog would.
Use lots of puns!

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

/**
 * This handler initializes and calls a retrieval chain. It composes the chain using
 * LangChain Expression Language. See the docs for more information:
 *
 * https://js.langchain.com/v0.2/docs/how_to/qa_chat_history_how_to/
 */
//核心逻辑
export async function POST(req: NextRequest) {
  try {
    //1. 解析请求
    const body = await req.json();
    const messages = body.messages ?? [];
    const previousMessages = messages.slice(0, -1);//历史问题
    const currentMessageContent = messages[messages.length - 1].content;//当前用户问题(直接用消息的最后一个索引表示)
    //2. 初始化模型
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0.2,
    });
    //3. 连接 Supabase + 初始化向量存储
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PRIVATE_KEY!,
    );
    const vectorstore = new SupabaseVectorStore(new OpenAIEmbeddings(), {
      client,
      tableName: "documents",
      queryName: "match_documents",//RPC调用（SQL function）
    });
    // console.log("🔍 Vectorstore initialized:", vectorstore);

    /**
     * We use LangChain Expression Language to compose two chains.
     * To learn more, see the guide here:
     *
     * https://js.langchain.com/docs/guides/expression_language/cookbook
     *
     * You can also use the "createRetrievalChain" method with a
     * "historyAwareRetriever" to get something prebaked.
     */
    //4. 问题改写链
    // 功能：将用户问题改写, 将历史问题结合当前input,通过大模型输出一个新的问题(string)
    const standaloneQuestionChain = RunnableSequence.from([
      //1. 构建改写模板(将用户问题结合历史对话改写为独立问题)
      condenseQuestionPrompt,
      //执行模型，将改写后的问题发送给模型
      model,
      //将模型输出的文本解析为字符串
      new StringOutputParser(),
    ]);
    // 生成待处理(延迟)提示词(等待传入文档的提示词)
    let resolveWithDocuments: (value: Document[]) => void;
    const documentPromise = new Promise<Document[]>((resolve) => {
      resolveWithDocuments = resolve;
    });

    //5. 检索链
    // 功能：根据用户问题，检索相关文档
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
    const retrievalChain = retriever.pipe(combineDocumentsFn);
    //5. 回答链
    // 功能：根据检索到的文档和问题等拼接模板，生成最终答案(将多个步骤（函数/链/模型）拼接成一个流水线（Pipeline））
    const answerChain = RunnableSequence.from([
      //1. 构建RAG输入数据
      {
        //先用问题，并通过检索链检索数据库回答(最终得到答案)
        context: RunnableSequence.from([
          (input) => input.question,
          retrievalChain,
        ]),
        chat_history: (input) => input.chat_history,//获得对话历史
        question: (input) => input.question,
      },
      //2. 执行回答模板(将RAG检索的信息插入到回答模板中)
      answerPrompt,//回答模板
      //3. 执行模型
      model,
    ]);
    //6. 组合链
    // 功能：将问题改写链、检索链、回答链组合起来，形成完整的问答流程
    const conversationalRetrievalQAChain = RunnableSequence.from([
      //1.产生了一个新的结构化输入对象 
      {
        question: standaloneQuestionChain,//生成改写的问题
        chat_history: (input) => input.chat_history,//历史对话
      },
      //2. 执行回答链(根据改写后的问题和历史对话，生成最终答案)
      answerChain,
      new BytesOutputParser(),//转为字节流
    ]);
    //7：运行 chain 并返回流式响应
    const stream = await conversationalRetrievalQAChain.stream({
      question: currentMessageContent,
      chat_history: formatVercelMessages(previousMessages),
    });

    const documents = await documentPromise;//等待检索链完成，返回文档
    //填充检索源
    const serializedSources = Buffer.from(
      JSON.stringify(
        documents.map((doc) => {
          return {
            pageContent: doc.pageContent.slice(0, 50) + "...",
            metadata: doc.metadata,
          };
        }),
      ),
    ).toString("base64");
    //步骤 8：返回结果 + 附带检索源
    return new StreamingTextResponse(stream, {
      headers: {
        "x-message-index": (previousMessages.length + 1).toString(),
        "x-sources": serializedSources,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
