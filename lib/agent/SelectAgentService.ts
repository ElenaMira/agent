import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage } from "@langchain/core/messages";
import { Select_SYSTEM_PROMPT } from "../prompt/Prompt";

export class SelectAgentService {
  private routerModel = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  });

  async decide(messages: BaseMessage[]): Promise<string> {
    const system = { role: "system", content: Select_SYSTEM_PROMPT };
    const result = await this.routerModel.invoke([
      system,
      ...messages
    ]);

    // AIMessage result
    const raw = result.content.toString().trim().toLowerCase();

    if ([
      "chattool",
      "imageanalysistool",
      "generateimagetool",
      "ragquerytool",
      "web_search",
      "calculator",
    ].includes(raw)) {
      return raw;
    }

    return "error"; // fallback
  }
}
