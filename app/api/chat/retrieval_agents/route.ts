import { NextRequest, NextResponse } from "next/server";
import { AgentService } from "@/lib/agent/AgentService";
import  { convertVercelMessageToLangChainMessage }  from "@/lib/converters/InputMessage";
import { Message as VercelChatMessage} from "ai";
import { BaseMessage } from "@langchain/core/messages";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const returnIntermediateSteps = body.show_intermediate_steps;
    const messages:BaseMessage[]= (body.messages ?? [])
    .filter(
      (message: VercelChatMessage) =>
        message.role === "user" || message.role === "assistant",
    )
    .map(convertVercelMessageToLangChainMessage);
    // const promptVars  = await buildPrompt(langchainMessages);

    const agentService = new AgentService();
    
    // if (!body.show_intermediate_steps) {
    //   const stream = await agentService.stream(Prompt);
    //   return new StreamingTextResponse(stream);
    // }
      const result = await agentService.invoke(messages);
      return NextResponse.json({messages: result.messages},{ status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
