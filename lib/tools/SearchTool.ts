// 文件名：../tools/SearchTrendsTool.ts

import { SerpAPI } from "@langchain/community/tools/serpapi";
import { AgentSource } from "@/lib/types/agent";
// 导入 LangChain 的 HumanMessage，尽管在这里未使用，但在 Agent 场景中通常需要

/**
 * 使用 SerpApi 执行实时搜索，获取与查询相关的最新趋势和信息。
 * * @param query 包含用户请求和图像描述的合并查询字符串。
 * @returns 包含格式化搜索结果的对象。
 */
export async function searchTrendsLogic(query: string): Promise<{ trends_result: string; sources: AgentSource[] }> {
    console.log(`[SearchTrendsTool] Starting real-time search for trends with query: "${query.substring(0, 80)}..."`);

    // --- 1. 实例化 SerpAPI 工具 ---
    // 假设 SERPAPI_API_KEY 已在环境变量中设置
    const serpApiTool = new SerpAPI(process.env.SERPAPI_API_KEY, {
        // 可以添加额外的参数，例如地理位置 (hl: language, gl: country)
        hl: "zh-cn",
        gl: "cn",
    });

    try {
        const result = await serpApiTool.invoke(query);
        console.log("[SerpAPI raw result]:", result);
      
        // =========================
        // 2️⃣ 格式化输出
        // =========================
        let trendsResult = "";
        const sources: AgentSource[] = [];
      
        if (result && result.trim()) {
            trendsResult = `【搜索结果摘要】\n${result}`;
        } else {
            trendsResult = "实时搜索未发现结构化结果，请参考原始信息进行判断。";
        }
      
        console.log("[SearchTrendsTool] result:", trendsResult);
      
        return {
          trends_result: trendsResult.trim(),
          sources,
        };
      
      } catch (error) {
        console.error("[SearchTrendsTool] Error:", error);
      
        return {
          trends_result: "⚠️ 实时趋势搜索失败，请检查 API Key 或网络。",
          sources: [],
        };
      }
}
