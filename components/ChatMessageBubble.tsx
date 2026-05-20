import { Message } from "ai/react";
import { cn } from "@/lib/utils/cn";
import { useMemo } from "react";
import Image from "next/image";

interface ChatMessageBubbleProps {
  message: Message;
  aiEmoji?: string;
  sources?: any[];
}

export function ChatMessageBubble(props: ChatMessageBubbleProps) {
  const { message, aiEmoji, sources } = props;
  const isUser = message.role === "user";
// 🔥 核心优化：使用 useMemo 集中处理附件和文本清洗，确保逻辑健壮且只计算一次
  const { attachments, displayContent, webSources } = useMemo(() => {
    const contentStr = message.content || "";
    const rawAttachments = message.experimental_attachments || [];
    const parsedAttachments = [...rawAttachments];

    const cleanedText = contentStr.replace(/!\[.*?\]\(.*?\)/g, "").trim();

    if (parsedAttachments.length === 0 && contentStr.includes("![")) {
      const markdownImageRegex = /!\[(.*?)\]\((https?:\/\/[^\s)]+)(?:\s+".*?")?\)/g;
      let match: RegExpExecArray | null;

      while ((match = markdownImageRegex.exec(contentStr)) !== null) {
        parsedAttachments.push({
          url: match[2],
          contentType: "image/png",
          name: match[1] || "Extracted Image",
        });
      }
    }

    const sourceList = Array.isArray(sources) ? sources : [];
    const linkRegex = /^https?:\/\//i;
    const parsedWebSources = sourceList
      .map((source: any, index: number) => {
        const url =
          typeof source?.url === "string"
            ? source.url
            : typeof source?.link === "string"
              ? source.link
              : typeof source?.source === "string"
                ? source.source
                : "";

        if (!url || !linkRegex.test(url)) return null;

        const title =
          typeof source?.title === "string" && source.title.trim().length > 0
            ? source.title
            : `网页来源 ${index + 1}`;

        const snippet =
          typeof source?.snippet === "string"
            ? source.snippet
            : typeof source?.chunk === "string"
              ? source.chunk
              : "";

        return { url, title, snippet };
      })
      .filter(Boolean) as { url: string; title: string; snippet: string }[];

    return {
      attachments: parsedAttachments,
      displayContent: cleanedText,
      webSources: parsedWebSources,
    };
  }, [message.content, message.experimental_attachments, sources]);


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
        {attachments.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {attachments.map((attachment: any, idx: number) => (
              <div key={idx} className="relative group">
                {(!attachment.contentType || attachment.contentType.startsWith("image/")) ? (
                  <Image
                    src={attachment.url}
                    alt={attachment.name || "Attachment image"}
                    width={480}
                    height={280}
                    unoptimized
                    className="max-w-full h-auto rounded-lg object-cover cursor-pointer hover:opacity-90 transition border border-gray-200 dark:border-gray-700"
                    onClick={() => window.open(attachment.url, "_blank")}
                  />
                ) : (
                  <div className="bg-white/50 dark:bg-black/20 p-3 rounded-lg flex items-center gap-2 text-sm border border-gray-200/50">
                    <span>📎</span>
                    <span className="truncate max-w-[150px]">{attachment.name || "File"}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {displayContent && (
          <div className="whitespace-pre-wrap leading-relaxed">
            {displayContent}
          </div>
        )}

        {webSources.length > 0 && (
          <details className="mt-3 rounded-lg border border-gray-300/40 p-2 text-xs">
            <summary className="cursor-pointer select-none font-medium text-gray-600 dark:text-gray-300">
              查看使用到的网页 ({webSources.length})
            </summary>
            <div className="mt-2 space-y-2">
              {webSources.map((source, i) => (
                <div key={`${source.url}-${i}`} className="rounded-md bg-black/5 p-2 dark:bg-white/5">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-1 text-blue-600 underline-offset-2 hover:underline dark:text-blue-300"
                  >
                    {source.title}
                  </a>
                  {source.snippet ? (
                    <p className="mt-1 line-clamp-2 text-gray-600 dark:text-gray-300">{source.snippet}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        )}

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