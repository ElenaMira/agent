import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import { PLANNER_SYSTEM_PROMPT } from "@/lib/prompt/Prompt";
import { PlanStep, PlannerInput, PlannerOutput } from "@/lib/types/agent";

const plannerModel = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

const STEP_ORDER: PlanStep[] = [
  "condense_question",
  "retrieve_context",
  "analyze_image",
  "search_trends",
  "web_research",
  "calculate",
  "generate_answer",
  "generate_copy",
  "generate_image",
  "format_output",
  "evaluate_output",
  "chat",
];

function dedupeSteps<T>(steps: T[]): T[] {
  return [...new Set(steps)];
}

function orderSteps(steps: PlanStep[]) {
  return [...steps].sort(
    (a, b) => STEP_ORDER.indexOf(a) - STEP_ORDER.indexOf(b),
  );
}

function sanitizeSteps(steps: unknown): PlanStep[] {
  if (!Array.isArray(steps)) return ["chat"];
  const valid = steps.filter((step): step is PlanStep =>
    STEP_ORDER.includes(step as PlanStep),
  );
  return valid.length > 0 ? orderSteps(dedupeSteps(valid)) : ["chat"];
}

function rulePlanner(input: PlannerInput): PlannerOutput | null {
  const text = input.userInput;
  const steps: PlanStep[] = [];

  if ((input.route.needs?.rag || input.hasFiles) && input.route.route !== "image_generation") {
    steps.push("condense_question", "retrieve_context");
  }

  if (input.route.needs?.image || input.hasImage) {
    steps.push("analyze_image");
  }

  if (/research|上网调研|上网查询资料|上网外部信息|上网查一下/i.test(text)) {
    steps.push("web_research");
  }

  if (
    input.route.needs?.web ||
    /趋势|近期|最新|新闻|市场|竞品|价格|202\d|last|recent|latest/i.test(text)
  ) {
    steps.push("search_trends");
  }


  if (/广告|文案|营销|推广|种草|标题|caption|copy/i.test(text)) {
    steps.push("generate_copy");
  }

  if (input.route.needs?.calculator) {
    steps.push("calculate");
  }

  if (input.route.route === "image_generation") {
    steps.push("generate_image");
  }

  if (
    /回答|解释|总结|分析|怎么|为什么|what|how|why/i.test(text) &&
    !steps.includes("generate_copy") &&
    !steps.includes("generate_image")
  ) {
    steps.push("generate_answer");
  }

  if (input.route.needs?.structuredOutput || input.requiresStructuredOutput) {
    steps.push("format_output");
  }

  if (steps.length === 0) {
    if (input.route.route === "chat" || input.route.route === "qa") {
      return { steps: ["chat"], confidence: 0.85, source: "rule" };
    }
    return null;
  }

  return {
    steps: orderSteps(dedupeSteps(steps)),
    confidence: 0.82,
    source: "rule",
  };
}

async function llmPlanner(input: PlannerInput): Promise<PlannerOutput> {
  const result = await plannerModel.invoke([
    new SystemMessage(PLANNER_SYSTEM_PROMPT),
    new HumanMessage(
      JSON.stringify({
        userInput: input.userInput,
        route: input.route,
        hasImage: input.hasImage,
        hasFiles: input.hasFiles,
      }),
    ),
  ]);

  try {
    const parsed = JSON.parse(result.content.toString());
    return {
      steps: sanitizeSteps(parsed.steps),
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.6,
      source: "llm",
    };
  } catch {
    return {
      steps: ["chat"],
      confidence: 0.4,
      source: "llm",
    };
  }
}

export async function planner(input: PlannerInput): Promise<PlannerOutput> {
  const ruleResult = rulePlanner(input);
  const needLLM =
    !ruleResult ||
    ruleResult.confidence < 0.75 ||
    (input.route.route === "multi_step" && ruleResult.steps.length <= 1);

  if (!needLLM && ruleResult) {
    return ruleResult;
  }

  const llmResult = await llmPlanner(input);

  if (!ruleResult) {
    return llmResult;
  }

  return {
    steps: orderSteps(dedupeSteps([...(ruleResult.steps ?? []), ...llmResult.steps])),
    confidence: llmResult.confidence,
    source: "hybrid",
  };
}
