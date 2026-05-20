import { AIMessage, HumanMessage } from "@langchain/core/messages";

import { controller } from "@/lib/controller/Controller";
import { GraphCompiler } from "@/lib/graph/GraphCompiler";
import { MemoryService } from "@/lib/memory/MemoryService";
import { createDefaultNodeRegistry } from "@/lib/nodes/defaultRegistry";
import { executionPlanBuilder } from "@/lib/plan/ExecutionPlanBuilder";
import { planner } from "@/lib/planner/planner";
import { PromptBuilder } from "@/lib/prompt/PromptBuilder";
import { MemoryProvider } from "@/lib/prompt/providers/MemoryProvider";
import { RAGProvider } from "@/lib/prompt/providers/RAGProvider";
import { ToolProvider } from "@/lib/prompt/providers/ToolProvider";
import { router } from "@/lib/router/Router";
import { AgentContext, AgentResult, AgentStateShape } from "@/lib/types/agent";
import { convertLangChainMessageToVercelMessage } from "@/lib/converters/Messages";

function hasImage(messages: AgentContext["messages"]) {
  const last = messages[messages.length - 1];
  return Array.isArray(last?.content)
    ? last.content.some((part: any) => part?.type === "image_url")
    : false;
}

function hasFiles(messages: AgentContext["messages"]) {
  const last = messages[messages.length - 1];
  return Array.isArray(last?.content)
    ? last.content.some(
        (part: any) =>
          part?.type === "text" && typeof part?.text === "string" && part.text.includes("PDF 附件:"),
      )
    : false;
}

export class Orchestrator {
  private readonly promptBuilder = new PromptBuilder([
    new MemoryProvider(),
    new ToolProvider(),
    new RAGProvider(),
  ]);
  private readonly graphCompiler = new GraphCompiler(createDefaultNodeRegistry());

  constructor(private readonly memoryService: MemoryService) {}

  async invoke(ctx: AgentContext): Promise<AgentResult> {
    const memory = await this.memoryService.load(ctx.userId);
    const conversationMessages =
      ctx.messages.length > 0 ? ctx.messages : [new HumanMessage(ctx.input)];
    const route = await router({
      ...ctx,
      messages: conversationMessages,
      memory,
    });
    console.log("route:${route}'\n' ",route);

    const tasks = await planner({
      userInput: ctx.input,
      route,
      hasImage: hasImage(conversationMessages),
      hasFiles: hasFiles(conversationMessages),
      requiresRecentInfo: route.needs.web,
      requiresStructuredOutput: route.needs.structuredOutput,
    });
    console.log("tasks:${tasks}'\n' ",tasks);

    const decision = await controller({
      state: { ...ctx, memory },
      route,
      tasks,
    });
    console.log("decision:${decision}'\n' ",decision);
    const plan = await executionPlanBuilder({
      state: { ...ctx, memory },
      route,
      tasks,
      decision,
    });
    console.log("plan:${plan}'\n' ",plan);

    const promptMessages = await this.promptBuilder.build({
      ...ctx,
      memory,
    });
    // console.log("promptMessages:${promptMessages}'\n' ",promptMessages);

    const systemPrompt = promptMessages[0]?.content?.toString?.() ?? "";

    const initialState: AgentStateShape = {
      userId: ctx.userId,
      input: ctx.input,
      messages: conversationMessages,
      memory,
      systemPrompt,
      route,
      steps: tasks.steps,
      decision,
      plan,
      intermediate: {},
      finalOutput: "",
      sources: [],
      evaluation: undefined,
      evaluationRetryCount: 0,
      errors: [],
    };

    const graph = await this.graphCompiler.compile(plan);
    // console.log("graph:${graph}'\n' ",graph);

    const resultState = await graph.invoke(initialState);
    console.log("resultState:${resultState}'\n' ",resultState.finalOutput,resultState.intermediate);

    if (ctx.userId) {
      const latestUserMessage = conversationMessages[conversationMessages.length - 1];
      const latestAssistantMessage = resultState.finalOutput
        ? new AIMessage(resultState.finalOutput)
        : null;

      const memoryMessages = [
        ...(latestUserMessage ? [latestUserMessage] : []),
        ...(latestAssistantMessage ? [latestAssistantMessage] : []),
      ];

      await this.memoryService.update(ctx.userId, memoryMessages);
    }

    return {
      messages: resultState.messages.map(convertLangChainMessageToVercelMessage),
      finalOutput: resultState.finalOutput,
      sources: resultState.sources,
      route,
      steps: tasks.steps,
    };
  }
}
