import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import { ROUTE_SYSTEM_PROMPT } from "@/lib/prompt/Prompt";
import { AgentContext, RouteNeeds, RouteResult } from "@/lib/types/agent";

const routerModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

const defaultNeeds = (): RouteNeeds => ({
  image: false,
  web: false,
  rag: false,
  calculator: false,
  structuredOutput: false,
  answer: true,
});

function detectAttachments(ctx: AgentContext) {
  const allMessages = [...ctx.messages];
  const latest = allMessages[allMessages.length - 1];
  const content = latest?.content;

  const hasImage = Array.isArray(content)
    ? content.some((part: any) => part?.type === "image_url")
    : false;

  const hasFiles = Array.isArray(content)
    ? content.some(
        (part: any) =>
          part?.type === "text" && typeof part?.text === "string" && part.text.includes("PDF 附件:"),
      )
    : false;

  return { hasImage, hasFiles };
}

function ruleRouter(ctx: AgentContext): RouteResult | null {
  const text = ctx.input;
  const lower = text.toLowerCase();
  const { hasImage, hasFiles } = detectAttachments(ctx);
  const needs = defaultNeeds();

  if (hasImage) {
    needs.image = true;
    needs.answer = true;
    return {
      route: "image",
      confidence: 0.95,
      needs,
      reason: "Detected attached or referenced image content.",
    };
  }

  if (/draw|generate an image|create an image|生成图片|画一张|生成一张图|做一张图/i.test(text)) {
    needs.image = true;
    return {
      route: "image_generation",
      confidence: 0.92,
      needs,
      reason: "Detected explicit image generation request.",
    };
  }

  if (hasFiles || /知识库|文档|项目资料|pdf|内部资料|上传文件/i.test(text)) {
    needs.rag = true;
    return {
      route: "rag",
      confidence: 0.88,
      needs,
      reason: "Detected internal document or uploaded file request.",
    };
  }

  if (/趋势|近期|最新|新闻|市场|竞品|价格|current|recent|latest|news|trend/i.test(text)) {
    needs.web = true;
    return {
      route: "research",
      confidence: 0.82,
      needs,
      reason: "Detected time-sensitive external information request.",
    };
  }

  if (/计算|算一下|多少|加减乘除|percent|percentage|math|calculate/i.test(lower)) {
    needs.calculator = true;
    return {
      route: "math",
      confidence: 0.86,
      needs,
      reason: "Detected math or calculation request.",
    };
  }

  if (/json|schema|表格|table|结构化/i.test(lower)) {
    needs.structuredOutput = true;
    return {
      route: "structured_output",
      confidence: 0.8,
      needs,
      reason: "Detected structured output requirement.",
    };
  }

  return null;
}

function sanitizeRouteResult(raw: any): RouteResult {
  const route = raw?.route ?? "chat";
  return {
    route,
    confidence: typeof raw?.confidence === "number" ? raw.confidence : 0.6,
    needs: {
      ...defaultNeeds(),
      ...(raw?.needs ?? {}),
    },
    reason: typeof raw?.reason === "string" ? raw.reason : "LLM router fallback.",
  };
}

export async function router(ctx: AgentContext): Promise<RouteResult> {
  const ruled = ruleRouter(ctx);
  if (ruled) return ruled;

  const result = await routerModel.invoke([
    new SystemMessage(ROUTE_SYSTEM_PROMPT),
    new HumanMessage(
      JSON.stringify({
        latestUserInput: ctx.input,
        hasHistory: ctx.messages.length > 0,
      }),
    ),
  ]);

  try {
    return sanitizeRouteResult(JSON.parse(result.content.toString()));
  } catch {
    return {
      route: "chat",
      confidence: 0.55,
      needs: defaultNeeds(),
      reason: "Router fallback to chat due to invalid model output.",
    };
  }
}
