import { ChatOpenAI } from "@langchain/openai";

export const router = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  }).withConfig({
    response_format: { type: "text" }
  });