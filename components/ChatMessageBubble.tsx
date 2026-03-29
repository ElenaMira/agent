// src/components/ChatMessageBubble.tsx
import { Message } from "ai/react";
import { cn } from "@/utils/cn";
import { useMemo } from "react"; // 确保引入 useMemo

interface ChatMessageBubbleProps {
  message: Message;
  aiEmoji?: string;
  sources?: any[];
}

export function ChatMessageBubble(props: ChatMessageBubbleProps) {
  const { message, aiEmoji, sources } = props;
  const isUser = message.role === "user";

  // 🔥 核心优化：使用 useMemo 集中处理附件和文本清洗，确保逻辑健壮且只计算一次
  const { attachments, displayContent } = useMemo(() => {
    const contentStr = message.content || "";

    // 1. 获取后端提供的结构化附件(这个是不会接收的,对于react/ai)
    // 注意：使用 (message as any).experimental_attachments 来安全访问
    const rawAttachments = message.experimental_attachments || [];
    let parsedAttachments = [...rawAttachments];
    console.log("rawAttachments:", rawAttachments);
    
    // 2. 清洗文本：移除 Markdown 图片语法（无论附件来源如何，文本都需要被清洗）
    const cleanContent = (content: string) => {
      // 正则表达式：匹配 ![alt](url) 格式的 markdown 图片语法
      return content.replace(/!\[.*?\]\(.*?\)/g, "").trim();
    };

    const cleanedText = cleanContent(contentStr);

    // -----------------------------------------------------------------------------------
    // 💡 容错/兼容性逻辑：如果后端是 streaming 模式且没有传 attachments，我们从文本中解析。
    // 在你的 invoke 模式下，rawAttachments 应该非空，这段代码不会执行，但它保留了兼容性。
    // -----------------------------------------------------------------------------------
    if (parsedAttachments.length === 0 && contentStr.includes("![")) {
      const markdownImageRegex = /!\[(.*?)\]\((https?:\/\/[^\s)]+)(?:\s+".*?")?\)/g;
      let match;
      
      // 注意：这里需要重新在原始 contentStr 上运行匹配，因为它包含了 Markdown 链接
      while ((match = markdownImageRegex.exec(contentStr)) !== null) {
        // 如果后端没有传，前端就自己构造一个附件对象
        parsedAttachments.push({
          url: match[2], 
          contentType: "image/png", 
          name: match[1] || "Extracted Image",
        });
      }
    }
    
    return {
      attachments: parsedAttachments,
      displayContent: cleanedText,
    };
  }, [message.content, (message as any).experimental_attachments]);


  return (
    <div
      className={cn(
        "flex gap-3 my-4 max-w-[80%]",
        isUser ? "ml-auto justify-end" : "mr-auto"
      )}
    >
      {!isUser && aiEmoji && (
        <div className="size-8 shrink-0 rounded-full flex items-center justify-center text-lg">
          {aiEmoji}
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl px-4 py-3",
          isUser
            ? "bg-blue-500 text-white"
            : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        )}
      >
        {/* 1. 优先渲染附件 (attachments 变量来自 useMemo 的解构) */}
        {attachments.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {attachments.map((attachment: any, idx: number) => (
              <div key={idx} className="relative group">
                {/* 确保渲染条件足够宽松，即使手动提取时 contentType 缺失也能渲染 */}
                {(!attachment.contentType || attachment.contentType.startsWith("image/")) ? (
                  // 图片附件
                  <img
                    src={attachment.url}
                    alt={attachment.name || "Generated Image"}
                    className="max-w-full h-auto rounded-lg object-cover cursor-pointer hover:opacity-90 transition border border-gray-200 dark:border-gray-700"
                    onClick={() => window.open(attachment.url, "_blank")}
                  />
                ) : (
                  // 其他文件类型 (如 PDF)
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg flex items-center gap-2 text-sm border border-gray-200/50">
                    <span>📎</span>
                    <span className="truncate max-w-[150px]">{attachment.name || "File"}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 2. 渲染清洗后的文本内容 */}
        {displayContent && (
          <div className="whitespace-pre-wrap leading-relaxed">
            {displayContent}
          </div>
        )}

        {/* 3. 来源引用 */}
        {sources && sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200/30 text-xs opacity-70">
            <span className="font-semibold mr-1">Sources:</span>
            {sources.map((s, i) => (
              <span key={i} className="mr-2">[{i + 1}]</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}