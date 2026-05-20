import { BaseMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import { MemoryStore } from "./MemoryStore";

const MEMORY_TOKEN_THRESHOLD = 50_000;
const MIN_MEMORY = 10;


function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function getMessageRole(message: BaseMessage) {
  if (typeof (message as any).getType === "function") {
    return (message as any).getType();
  }

  return (message as any).role ?? "message";
}

function getMessageText(message: BaseMessage, options?: { excludeMedia?: boolean }) {
  const excludeMedia = options?.excludeMedia ?? false;
  if (typeof message.content === "string") {
    if (excludeMedia) {
      return message.content
        .split("\n")
        .filter((line) => !line.trim().startsWith("PDF 附件:"))
        .join("\n");
    }
    return message.content;
  }

  if (Array.isArray(message.content)) {
    return message.content
      .map((part: any) => {
        if (typeof part === "string") return part;
        if (part?.type === "text") {
          if (
            excludeMedia &&
            typeof part?.text === "string" &&
            part.text.trim().startsWith("PDF 附件:")
          ) {
            return "";
          }
          return part.text ?? "";
        }
        if (part?.type === "image_url") {
          if (excludeMedia) return "";
          return `[image] ${part.image_url?.url ?? ""}`;
        }
        return JSON.stringify(part);
      })
      .filter(Boolean)
      .join("\n");
  }

  return String(message.content ?? "");
}

function toMarkdownTranscript(messages: BaseMessage[]) {
  return messages
    .map((message) => {
      const role = getMessageRole(message);
      const content = getMessageText(message, { excludeMedia: true }).trim();
      if (!content) return "";
      return `### ${role}\n${content}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export class MemoryService {
  private readonly summarizer = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  });

  constructor(private readonly store: MemoryStore) {}

  async load(userId?: string): Promise<string> {
    if (!userId) return "";
    return this.store.get(userId);
  }

  async update(userId: string, messages: BaseMessage[]): Promise<void> {
    if (!userId || messages.length <= MIN_MEMORY) return;

    

    const existingMemory = await this.store.get(userId);
    const transcript = toMarkdownTranscript(messages);
    if (!transcript.trim()) return;

    const nextMemoryDraft = existingMemory
      ? `${existingMemory.trim()}\n\n---\n\n${transcript}`
      : transcript;

    if (estimateTokens(existingMemory) <= MEMORY_TOKEN_THRESHOLD) {
      await this.store.save(userId, nextMemoryDraft);
      return;
    }

    const summary = await this.summarize(existingMemory, transcript);
    await this.store.save(userId, summary);
  }

  private async summarize(existingMemory: string, transcript: string) {
    const response = await this.summarizer.invoke([
      [
        "system",
        [
          "You maintain persistent user memory for an agent.",
          "Compress the memory into concise markdown.",
          "Preserve stable user preferences, durable facts, long-running goals, and important project context.",
          "Avoid copying raw conversation verbatim unless it is a durable fact.",
        ].join(" "),
      ],
      [
        "human",
        `Existing memory:\n${existingMemory}\n\nNew conversation transcript:\n${transcript}`,
      ],
    ]);

    return response.content.toString().trim();
  }
}
