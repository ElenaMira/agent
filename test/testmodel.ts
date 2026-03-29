import { ChatOpenAI } from "@langchain/openai";
import "dotenv/config";

console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY);
console.log("OPENAI_BASE_URL:", process.env.OPENAI_BASE_URL);

const model = new ChatOpenAI({
  modelName: "dall-e-2",
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY!,
});


async function main() {
  const response = await model.invoke("Create a picture of a cat");
  console.log(response.content);
}

main().catch(console.error);
