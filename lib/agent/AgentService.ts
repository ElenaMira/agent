import { FileMemoryStore } from "../memory/FileMemoryStore";
import { MemoryService } from "../memory/MemoryService";
import { Orchestrator } from "../nodes/orchestrator/Orchestrator";
import { AgentContext, AgentResult } from "@/lib/types/agent";

export class AgentService {
  private readonly memoryService = new MemoryService(new FileMemoryStore());
  private readonly orchestrator = new Orchestrator(this.memoryService);

  async invoke(ctx: AgentContext): Promise<AgentResult> {
    return this.orchestrator.invoke(ctx);
  }
}
