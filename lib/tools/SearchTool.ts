// 文件名：../tools/SearchTrendsTool.ts

import { SerpAPI } from "@langchain/community/tools/serpapi";
// 导入 LangChain 的 HumanMessage，尽管在这里未使用，但在 Agent 场景中通常需要

/**
 * 使用 SerpApi 执行实时搜索，获取与查询相关的最新趋势和信息。
 * * @param query 包含用户请求和图像描述的合并查询字符串。
 * @returns 包含格式化搜索结果的对象。
 */
export async function searchTrendsLogic(query: string): Promise<{ trends_result: string }> {
    console.log(`[SearchTrendsTool] Starting real-time search for trends with query: "${query.substring(0, 80)}..."`);

    // --- 1. 实例化 SerpAPI 工具 ---
    // 假设 SERPAPI_API_KEY 已在环境变量中设置
    const serpApiTool = new SerpAPI(process.env.SERPAPI_API_KEY, {
        // 可以添加额外的参数，例如地理位置 (hl: language, gl: country)
        hl: "zh-cn",
        gl: "cn",
    });

    try {
        // --- 2. 调用 SerpAPI 工具的 run 方法执行搜索 ---
        // run 方法返回一个格式化为字符串的搜索结果（通常是 JSON 字符串）
        const searchResultString = await serpApiTool.call(query);
        
        // --- 3. 解析和格式化结果 ---
        // SerpAPI.run 返回的是一个包含搜索摘要的字符串或 JSON 字符串。
        // 为了方便 Agent 使用，我们进行简单的处理。
        
        let trendsResult = "";
        
        try {
            // 尝试解析为 JSON (SerpAPI 默认返回 JSON 字符串)
            const resultJson = JSON.parse(searchResultString);

            // 提取关键信息，例如来自 'organic_results' 或 'answer_box'
            
            // 优先获取知识图谱/直接回答
            if (resultJson.answer_box && resultJson.answer_box.snippet) {
                trendsResult += `【直接答案】${resultJson.answer_box.snippet}\n`;
            } else if (resultJson.knowledge_graph && resultJson.knowledge_graph.snippet) {
                trendsResult += `【知识图谱】${resultJson.knowledge_graph.snippet}\n`;
            }

            // 提取前 3 条有机搜索结果作为“趋势”参考
            if (resultJson.organic_results && resultJson.organic_results.length > 0) {
                trendsResult += "\n【实时搜索趋势摘要】\n";
                const topResults = resultJson.organic_results.slice(0, 3);
                
                topResults.forEach((result: any, index: number) => {
                    trendsResult += ` - ${index + 1}. ${result.title} (${result.source || result.domain})：${result.snippet.substring(0, 100)}...\n`;
                });
            } else if (trendsResult === "") {
                 trendsResult = "实时搜索未发现特定趋势或知识图谱信息，请以常规知识为基础进行回复。";
            }
            
        } catch (e) {
            // 如果解析失败，可能是因为 run 方法返回了文本摘要而不是完整的 JSON
            console.warn("[SerpAPI] Failed to parse result as JSON, treating as plain text summary.");
            trendsResult = `【搜索结果摘要】${searchResultString}`;
        }
        
        console.log(`[SearchTrendsTool] Trend search complete.`);
        
        // --- 4. 返回结果 ---
        return { 
            trends_result: trendsResult.trim() 
        };

    } catch (error) {
        console.error("[SearchTrendsTool] Error during SerpAPI call:", error);
        // 错误处理：返回一个友好的错误消息，防止流程中断
        return { 
            trends_result: "⚠️ 实时趋势搜索失败。错误信息：未能连接到搜索服务或API密钥无效。" 
        };
    }
}