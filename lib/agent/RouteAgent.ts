import { BaseMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { Select_SYSTEM_PROMPT } from "./Prompt";
export const router = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
}).withConfig({
  response_format: { type: "text" }
});

export async function RouteAgent(lastMessage: BaseMessage) {
  const result = await router.invoke([
    new SystemMessage(Select_SYSTEM_PROMPT),
    lastMessage,
  ]);
  const selected = result.content
    .toString()
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  return selected; 
}
