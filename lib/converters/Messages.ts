import { HumanMessage, AIMessage, ChatMessage, BaseMessage } from "@langchain/core/messages";
// 定义 Vercel 附件类型
interface VercelAttachment {
  url: string;
  contentType: string;
  name?: string;
}
// 确保能够处理 content 是字符串还是数组的情况
const extractTextContent = (message: BaseMessage): string => {
  // 1. 如果 content 是字符串
  if (typeof message.content === "string") {
    // 检查是否是序列化的 LangChain 消息 (针对 Agent output 可能会是这种格式)
    if (message.content.trim().startsWith('{') && message.content.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(message.content);
        // 如果是序列化后的多模态/数组内容，提取其中的文本部分
        if (parsed.kwargs && Array.isArray(parsed.kwargs.content)) {
          return parsed.kwargs.content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("\n");
        }
      } catch (e) {
        // 解析失败，返回原始内容
        return message.content;
      }
    }
    return message.content;
  }

  // 2. 如果 content 是数组 (多模态/Agent 输出)
  if (Array.isArray(message.content)) {
    return (message.content as any[]) // 断言为 any[] 以访问 type 属性
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
  }

  return "";
};
// 1. 优化后的提取图片函数：增加了 Markdown 正则解析
const extractImageAttachments = (message: BaseMessage): VercelAttachment[] => {
  const attachments: VercelAttachment[] = [];

  // --- A. 处理 Content 是数组的情况 (多模态) ---
  if (Array.isArray(message.content)) {
    const imageParts = (message.content as any[])
      .filter((c) => c.type === "image_url")
      .map((c) => ({
        url: c.image_url.url,
        contentType: "image/png", 
        name: c.name
      }));
    attachments.push(...imageParts);
  } 
  
  // --- B. 处理 Content 是字符串的情况 (Markdown 解析) ---
  else if (typeof message.content === "string") {
    // 尝试解析序列化的 JSON (Agent 某些步骤可能产生)
    if (message.content.trim().startsWith('{') && message.content.trim().endsWith('}')) {
      try {
        const parsed = JSON.parse(message.content);
        if (parsed.kwargs && Array.isArray(parsed.kwargs.content)) {
           const parts = parsed.kwargs.content
            .filter((c: any) => c.type === "image_url")
            .map((c: any) => ({ url: c.image_url.url, contentType: 'image/png' }));
           attachments.push(...parts);
        }
      } catch (e) { /* Ignore */ }
    }

    // [新增关键逻辑] 使用正则提取 Markdown 图片: ![alt](url)
    const markdownImageRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)(?:\s+".*?")?\)/g;
    let match;
    // 循环匹配所有图片
    while ((match = markdownImageRegex.exec(message.content)) !== null) {
      if (match[1]) {
        attachments.push({
          url: match[1], // 捕获到的 URL
          contentType: "image/png", // 默认为 png，根据需要调整
          name: `generated-image-${Date.now()}.png`
        });
      }
    }
  }

  // --- C. 检查消息对象自带的 experimental_attachments 属性 ---
  const messageWithKwargs = message as AIMessage;
  if (messageWithKwargs.additional_kwargs && Array.isArray(messageWithKwargs.additional_kwargs.experimental_attachments)) {
    const experimentalAttachments = messageWithKwargs.additional_kwargs.experimental_attachments as any[];
     // 避免重复添加 (如果 URL 已经通过 Markdown 提取过了)
     const existingUrls = new Set(attachments.map(a => a.url));
     experimentalAttachments.forEach((att: any) => {
        if (!existingUrls.has(att.url)) {
            attachments.push({
                url: att.url,
                contentType: att.contentType || 'image/png',
                name: att.name
            });
        }
     });
  }

  return attachments;
};

// 3. 主转换函数
export const convertLangChainMessageToVercelMessage = (msg: BaseMessage) => {
  const role = (msg as any).role || 'assistant'; 

  if (role === "user") {
    return {
      role: "user",
      content: extractTextContent(msg),
      experimental_attachments: extractImageAttachments(msg), 
    };
  }

  if (role === "assistant") {
    const imageAttachments = extractImageAttachments(msg); 
    const textContent = extractTextContent(msg);

    return {
      role: "assistant",
      content: textContent, 
      tool_calls: (msg as AIMessage).tool_calls || null,
      // 只要提取到了附件，就赋值
      experimental_attachments: imageAttachments.length > 0 ? imageAttachments : undefined, 
    };
  }

  return {
    role: role,
    content: typeof msg.content === "string" ? msg.content : extractTextContent(msg),
  };
};