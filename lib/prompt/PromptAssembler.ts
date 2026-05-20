import { AgentContext } from "@/lib/types/agent";
import { BaseSystemPrompt } from "@/lib/prompt/Prompt";
import { ContextProvider } from "@/lib/prompt/providers/ContextProvider";

export class PromptAssembler {
  constructor(private readonly providers: ContextProvider[]) {}

  async assemble(ctx: AgentContext): Promise<string> {
    const contexts = await Promise.all(
      this.providers.map((provider) => provider.get(ctx)),
    );

    return [BaseSystemPrompt, ...contexts.filter(Boolean)].join("\n\n").trim();
  }
}
