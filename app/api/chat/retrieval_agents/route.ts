import { NextRequest, NextResponse } from "next/server";
import { AgentService } from "@/lib/agent/AgentService";
import { convertVercelMessageToLangChainMessage } from "@/lib/converters/InputMessage";
import { Message as VercelChatMessage } from "ai";
import { BaseMessage } from "@langchain/core/messages";
import { AgentContext } from "@/lib/agent/AgentContext";

export const runtime = "nodejs";

function extractMessageText(message: BaseMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (part?.type === "text") return part.text ?? "";
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return String(message.content ?? "");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const returnIntermediateSteps = Boolean(body.show_intermediate_steps);
    const userId =
      typeof body.userId === "string" && body.userId.trim().length > 0
        ? body.userId
        : undefined;

    const normalizedMessages = Array.isArray(body.messages)
      ? body.messages.slice(-1)
      : [];

    const allMessages: BaseMessage[] = normalizedMessages
      .filter(
        (message: VercelChatMessage) =>
          message.role === "user" || message.role === "assistant"
      )
      .map(convertVercelMessageToLangChainMessage);

    if (allMessages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 }
      );
    }

    const input = extractMessageText(allMessages[allMessages.length - 1]);
    const messages = allMessages;

    const ctx: AgentContext = {
      messages,
      input,
      userId,
    };

    const agentService = new AgentService();
    const result = await agentService.invoke(ctx);
    const serializedSources = Buffer.from(
      JSON.stringify(result.sources ?? []),
    ).toString("base64");

    if (returnIntermediateSteps) {
      return NextResponse.json(
        {
          messages: result.messages,
          sources: result.sources ?? [],
          route: result.route,
          steps: result.steps,
        },
        {
          status: 200,
          headers: {
            "x-sources": serializedSources,
          },
        },
      );
    }

    return new Response(result.finalOutput, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "x-message-index": allMessages.length.toString(),
        "x-sources": serializedSources,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.status ?? 500 }
    );
  }
}
