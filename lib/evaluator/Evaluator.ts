import { AgentEvaluation, AgentSource } from "@/lib/types/agent";

export async function evaluateOutput(input: {
  finalOutput: string;
  sources?: AgentSource[];
  qualityThreshold?: number;
}): Promise<AgentEvaluation> {
  const content = input.finalOutput.trim();
  let score = 0;

  if (content.length > 0) score += 0.4;
  if (content.length > 80) score += 0.2;
  if ((input.sources?.length ?? 0) > 0) score += 0.2;
  if (/https?:\/\//.test(content) || (input.sources?.length ?? 0) > 0) score += 0.1;
  if (!/未能|失败|error/i.test(content)) score += 0.1;

  const normalizedScore = Math.min(1, Number(score.toFixed(2)));
  const threshold = input.qualityThreshold ?? 0.7;

  return {
    score: normalizedScore,
    passed: normalizedScore >= threshold,
    reason:
      normalizedScore >= threshold
        ? "Output meets the basic V1 quality threshold."
        : "Output is too short or lacks support signals such as sources.",
  };
}
