import { GraphType } from "./GraphRegistry";
import { GraphFactory } from "./GraphFactory";
import { ExecutionPlan } from "@/lib/types/agent";
import { GraphCompiler } from "@/lib/graph/GraphCompiler";
import { NodeHandlerRegistry } from "@/lib/nodes/NodeHandlerRegistry";


export class GraphRuntime {
    static async run(type : GraphType, state: any) {
      const graph = await GraphFactory.get(type);
      return graph.invoke(state);
    }

    static async runPlan(plan: ExecutionPlan, state: any, registry: NodeHandlerRegistry) {
      const compiler = new GraphCompiler(registry);
      const graph = await compiler.compile(plan);
      return graph.invoke(state);
    }
  }
