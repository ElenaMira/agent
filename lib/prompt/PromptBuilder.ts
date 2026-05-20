import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

import { AgentContext } from "@/lib/types/agent";
import { PromptAssembler } from "@/lib/prompt/PromptAssembler";
import { ContextProvider } from "@/lib/prompt/providers/ContextProvider";

export class PromptBuilder {
  private readonly assembler: PromptAssembler;

  constructor(private readonly providers: ContextProvider[]) {
    this.assembler = new PromptAssembler(providers);
  }

  async build(ctx: AgentContext): Promise<BaseMessage[]> {
    const system = await this.assembler.assemble(ctx);

    return [
      new SystemMessage(system),
      ...ctx.messages,
      new HumanMessage(ctx.input),
    ];
  }
}
