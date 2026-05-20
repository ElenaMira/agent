import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Calculator } from "@langchain/community/tools/calculator";
import { ChatOpenAI } from "@langchain/openai";

import { evaluateOutput } from "@/lib/evaluator/Evaluator";
import { condenseQuestionLogic } from "@/lib/tools/CondenseQuestionTool";
import { generateImageFunc } from "@/lib/tools/GenerateImageTool";
import { formatOutput, OutputFormatterTool } from "@/lib/tools/OutputFormatterTool";
import { retrieveContext } from "@/lib/rag/RagService";
import { searchTrendsLogic } from "@/lib/tools/SearchTool";
import { imageAnalysisLogic } from "@/lib/tools/VisionTool";
import { generateFinalCopyLogic } from "@/lib/tools/generateFinalCopyLogic";
import { NodeHandlerRegistry } from "@/lib/nodes/NodeHandlerRegistry";
import { PromptBuilder } from "@/lib/prompt/PromptBuilder";
import { BaseSystemPrompt,AnsWerBaseSystemPrompt } from "@/lib/prompt/Prompt";
import { AgentContext, AgentStateShape } from "@/lib/types/agent";

const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.2,
});

function getHistoryMessages(state: AgentStateShape) {
  return state.messages.slice(0, -1);
}

function getCurrentInputMessage(state: AgentStateShape) {
  return state.messages[state.messages.length - 1];
}

function getCurrentImageUrl(state: AgentStateShape) {
  const current = getCurrentInputMessage(state);
  if (!current || !Array.isArray(current.content)) return undefined;

  const part = current.content.find(
    (item: any) => item && typeof item === "object" && item.type === "image_url",
  ) as any;
  return part?.image_url?.url;
}

function buildPromptContext(state: AgentStateShape): AgentContext {
  return {
    userId: state.userId,
    input: state.input,
    messages: getHistoryMessages(state),
    memory: state.memory,
    rag: state.intermediate.ragContext,
  };
}

async function generateAnswer(state: AgentStateShape) {
  const prompt = new PromptBuilder([]); // only used for structure; system prompt is assembled manually below
  const baseCtx = buildPromptContext(state);
  const messages = await prompt.build(baseCtx);
  const systemText = [
    AnsWerBaseSystemPrompt,
    state.intermediate.ragContext ? `# Retrieved Context\n${state.intermediate.ragContext}` : "",
    state.intermediate.searchSummary ? `# External Research\n${state.intermediate.searchSummary}` : "",
    state.intermediate.calculatorResult ? `# Calculation Result\n${state.intermediate.calculatorResult}` : "",
    state.intermediate.imageAnalysis ? `# Image Analysis\n${state.intermediate.imageAnalysis}` : "",
    "Answer the user directly and clearly using the available context.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await llm.invoke([
    new SystemMessage(systemText),
    ...messages.slice(1),
  ]);

  const content = response.content.toString();
  return {
    finalOutput: content,
  };
}

async function chat(state: AgentStateShape) {
  const response = await llm.invoke([
    new SystemMessage(
      [BaseSystemPrompt, state.memory ? `# User Memory\n${state.memory}` : ""]
        .filter(Boolean)
        .join("\n\n"),
    ),
    ...state.messages,
  ]);

  const content = response.content.toString();
  return {
    finalOutput: content,
  };
}

export function createDefaultNodeRegistry() {
  const registry = new NodeHandlerRegistry();

  registry.register("condense_question", async (state) => {
    const messages = state.messages.map((message: any) => ({
      role: message.getType?.() ?? message.role ?? "message",
      content:
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content),
    }));

    const result = await condenseQuestionLogic({ messages });
    return {
      messages: state.messages.map((message, index) => {
        if (index !== state.messages.length - 1) return message;
        return new HumanMessage(result.standalone_question);
      }),
    };
  });

  registry.register("retrieve_context", async (state) => {
    const latestMessage = getCurrentInputMessage(state);
    const query =
      typeof latestMessage?.content === "string"
        ? latestMessage.content
        : state.input;
    const result = await retrieveContext(query);
    return {
      intermediate: {
        ...state.intermediate,
        ragContext: result.combinedContext,
      },
      sources: [...state.sources, ...result.sources],
    };
  });

  registry.register("analyze_image", async (state) => {
    const imageUrl = getCurrentImageUrl(state);
    if (!imageUrl) {
      return { errors: [...state.errors, "No image URL found for analysis."] };
    }
    const result: any = await imageAnalysisLogic({ image_url: imageUrl });
    return {
      intermediate: {
        ...state.intermediate,
        imageAnalysis: result.analysis ?? "",
      },
    };
  });

  registry.register("search_trends", async (state) => {
    const query = [state.input, state.intermediate.imageAnalysis].filter(Boolean).join("\n");
    const result = await searchTrendsLogic(query);
    return {
      intermediate: {
        ...state.intermediate,
        searchSummary: result.trends_result,
      },
      sources: [...state.sources, ...(result.sources ?? [])],
    };
  });

  registry.register("web_research", async (state) => {
    const result = await searchTrendsLogic(state.input);
    return {
      intermediate: {
        ...state.intermediate,
        searchSummary: result.trends_result,
      },
      sources: [...state.sources, ...(result.sources ?? [])],
    };
  });

  registry.register("calculate", async (state) => {
    const calculator = new Calculator();
    const result = await calculator.invoke(state.input);
    return {
      intermediate: {
        ...state.intermediate,
        calculatorResult:
          typeof result === "string" ? result : JSON.stringify(result),
      },
    };
  });

  registry.register("generate_answer", generateAnswer);

  registry.register("generate_copy", async (state) => {
    const finalCopy = await generateFinalCopyLogic({
      userPrompt: state.input,
      imageDescription: state.intermediate.imageAnalysis ?? "",
      trends: state.intermediate.searchSummary ?? "",
      imageUrl: "",
    });

    return {
      finalOutput: finalCopy,
    };
  });

  registry.register("generate_image", async (state) => {
    const prompt = state.intermediate.imageAnalysis || state.input;
    const imageMessage = await generateImageFunc({ prompt });
    const url = (imageMessage.content as Array<any>).find((item) => item?.type === "image_url")?.image_url?.url ?? "";
    const text = (imageMessage.content as Array<any>)
      .filter((item) => item?.type === "text")
      .map((item) => item.text)
      .join("\n");

    return {
      finalOutput: text || url,
      sources: url
        ? [...state.sources, { title: "Generated image", url, snippet: "AI generated image output." }]
        : state.sources,
    };
  });
  registry.register("format_output", async (state) => {
    const content = state.finalOutput;
    return {
      finalOutput: content,
      messages: [...state.messages, new AIMessage(content)],
    };
  });

  registry.register("evaluate_output", async (state) => {
    const evaluation = await evaluateOutput({
      finalOutput: state.finalOutput,
      sources: state.sources,
      qualityThreshold: state.decision?.qualityThreshold,
    });
    return { evaluation };
  });

  registry.register("chat", chat);

  return registry;
}

