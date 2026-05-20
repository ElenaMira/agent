import { GraphRegistry,GraphType } from "./GraphRegistry";
const cache = new Map<GraphType, any>();

export class GraphFactory {

  static async get(type: GraphType) {
    if (cache.has(type)) {
      return cache.get(type);
    }

    const builder = GraphRegistry[type];

    const graph = await builder();

    cache.set(type, graph);

    return graph;
  }
}