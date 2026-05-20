import { runGenerateImageAgentGraph } from "./LangGraph";
import { runRagAgentGraph } from "./LangGraph";
// import { }

export const GraphRegistry = {
    image: runGenerateImageAgentGraph,
    rag: runRagAgentGraph,
    // default: 
  };

  export type GraphType = keyof typeof GraphRegistry;