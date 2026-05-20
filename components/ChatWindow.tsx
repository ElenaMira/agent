"use client";

import { type Message } from "ai";
import { useChat } from "ai/react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { Button } from "./ui/button";
import {
  ArrowDown,
  FileText,
  LoaderCircle,
  MessageSquareText,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/auth/auth-context";
import { UploadDocumentsForm } from "./UploadDocumentsForm";

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

const DEFAULT_SESSION_TITLE = "新对话";

function createSession(): ChatSession {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: DEFAULT_SESSION_TITLE,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function deriveSessionTitle(messages: Message[]) {
  const firstUserMessage = messages.find(
    (message) => message.role === "user" && message.content.trim().length > 0,
  );

  if (!firstUserMessage) {
    return DEFAULT_SESSION_TITLE;
  }

  return firstUserMessage.content.trim().slice(0, 5) || DEFAULT_SESSION_TITLE;
}

// 聊天消息自定义组件
// todo: 优化
function ChatMessages(props: {
  messages: Message[];
  emptyStateComponent: ReactNode;
  sourcesForMessages: Record<string, any>;
  aiEmoji?: string;
  className?: string;
}) {
  const normalizeAssistantMessage = (message: Message): Message => {
    if (message.role !== "assistant" || typeof message.content !== "string") {
      return message;
    }

    const content = message.content.trim();
    if (!content.startsWith("{") || !content.endsWith("}")) {
      return message;
    }

    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed?.messages)) {
        return message;
      }

      const lastAssistant = [...parsed.messages]
        .reverse()
        .find((item: any) => item?.role === "assistant");

      if (!lastAssistant || typeof lastAssistant.content !== "string") {
        return message;
      }

      return {
        ...message,
        content: lastAssistant.content,
        experimental_attachments:
          Array.isArray(lastAssistant.experimental_attachments) &&
          lastAssistant.experimental_attachments.length > 0
            ? lastAssistant.experimental_attachments
            : message.experimental_attachments,
      };
    } catch {
      return message;
    }
  };

  return (
    <div className="flex flex-col max-w-[768px] mx-auto pb-12 w-full">
      {/* //遍历消息m */}
      {props.messages.map((m, i) => {
        if (m.role === "system") return null;
        const displayMessage = normalizeAssistantMessage(m);
        // 其他消息
        // 尾部第一条消息 =  (总长度 - 1 - 当前位置),只适用于一次对话测试
        const sourceKey = (props.messages.length - 1 - i).toString();
        return (
          <ChatMessageBubble
            key={m.id}
            message={displayMessage}
            aiEmoji={props.aiEmoji}
            sources={props.sourcesForMessages[sourceKey]}
          />
        );
      })}
    </div>
  );
}

export function ChatInput(props: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onStop?: () => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  loading?: boolean;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;

  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLTextAreaElement>) => void;
}) {
  const disabled = props.loading && props.onStop == null;

  // 自动增高
  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  };

  return (
    <form
      onSubmit={(e) => {
        e.stopPropagation();//阻止事件冒泡(页面刷新)
        e.preventDefault();//阻止浏览器的“默认行为”
        // 如果正在加载中,则停止提交
        if (props.loading) {
          //现在正在生成中，用户又点了按钮 → 如果外面给了我停止函数，我就帮他停掉；没给我就啥也不干
          props.onStop?.();//防止空参报错
        } else {
          props.onSubmit(e);
        }
      }}
      //使用cn拼接的好处:
      // 1. 可以动态添加类名
      // 2. 可以避免类名冲突(比如传入一个空参)
      className={cn("flex w-full flex-col", props.className)}
    >
      {/* // 输入框主体(flex) */}
      <div className="border border-input bg-secondary rounded-lg flex flex-col gap-2 max-w-[768px] w-full mx-auto">
        {/* // 输入框 */}
        <textarea
            ref={props.textareaRef}  // 新增 ref
            value={props.value}
            placeholder={props.placeholder ?? "输入消息... 支持直接粘贴图片/PDF"}
            onChange={(e) => {
              props.onChange(e as any);
              autoResize(e);
            }}
            onKeyDown={(e) => {
              // 按回车发送（不换行），Shift+回车换行
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (props.loading) {
                  props.onStop?.();
                } else {
                  props.onSubmit(e as any);
                }
              }
            }}
            onPaste={props.onPaste}        // ← 新增：粘贴事件
            onDrop={props.onDrop}          // ← 新增：拖拽放下
            onDragOver={(e) => e.preventDefault()} // 必须阻止默认才能触发 drop
            className="min-h-[60px] max-h-[200px] resize-none border-none outline-none bg-transparent p-4 w-full"
            rows={1}
          />
        {/* //justify-between: 子元素在水平方向上平均分布，第一个元素在左侧，最后一个元素在右侧 */}
        <div className="flex justify-between ml-4 mr-2 mb-2">
          {/* // 左侧操作按钮(上传文件等) */}
          <div className="flex gap-3">{props.children}</div>
          {/* // 右侧操作按钮(发送按钮等) */}
          <div className="flex gap-2 self-end">
            {props.actions}
            <Button type="submit" className="self-end" disabled={disabled}>
              {/* 如果正在加载中,则显示加载动画 */}
              {props.loading ? (
                <span role="status" className="flex justify-center">
                  <LoaderCircle className="animate-spin" />
                  <span className="sr-only">Loading...</span>
                </span>
              ) : 
              // 否则显示发送按钮
              (
                <span>Send</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="w-4 h-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();

  // scrollRef will also switch between overflow: unset to overflow: auto
  return (
    <div
      ref={context.scrollRef}   //
      style={{ width: "100%", height: "100%" }}
      className={cn("grid grid-rows-[1fr,auto]", props.className)}
    >
      <div ref={context.contentRef} className={props.contentClassName}>
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

export function ChatLayout(props: { content: ReactNode; footer: ReactNode }) {
  return (
    //聊天窗口自动滚动框架
    <StickToBottom>
      {/* // 聊天窗口内容区域 */}
      <StickyToBottomContent
        className="absolute inset-0"
        contentClassName="py-8 px-2"
        //整个聊天消息区
        content={props.content}
        // 底栏输入框与滚动按钮
        //sticky bottom-8 : 固定在底部8px的位置(触底触发)只在父级滚动时保持粘在底部
        footer={
          <div className="sticky bottom-8 px-2">
            {/* // 滚动到底部的按钮(让你看到最新的输入) */}
            {/* // absolute bottom-full left-1/2 -translate-x-1/2 mb-4 : 绝对定位在输入框上方,水平居中 */}
            <ScrollToBottom className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4" />
            {/* //插入输入框组件 */}
            {props.footer}
          </div>
        }
      />
    </StickToBottom>
  );
}
// 附件预览组件（显示在输入框上方）
function AttachmentsPreview(props: {
  files: {
    file: File;
    previewUrl: string;
    attachmentUrl: string;
    type: "image" | "pdf";
    shouldRevokePreview: boolean;
  }[];
  onRemove: (index: number) => void;
  className?: string;
}) {
  if (!props.files.length) return null;
  return (
    <div className={cn("max-w-[768px] w-full mx-auto mb-2", props.className)}>
      <div className="flex flex-wrap gap-2">
        {props.files.map((p, idx) => (
          <div
            key={idx}
            className="relative rounded-md border border-input bg-secondary overflow-hidden"
          >
            {p.type === "image" ? (
              <Image
                src={p.previewUrl}
                alt={p.file.name}
                width={112}
                height={80}
                unoptimized
                className="h-20 w-28 object-cover"
              />
            ) : (
              <div className="h-20 w-28 flex items-center justify-center gap-2">
                <FileText className="w-5 h-5" />
                <span className="text-xs truncate max-w-[5rem]">{p.file.name}</span>
              </div>
            )}
            <button
              type="button"
              aria-label="Remove"
              className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white hover:bg-black/80"
              onClick={() => props.onRemove(idx)}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
// 聊天窗口组件
export function ChatWindow(props: {
  endpoint: string;// API端点地址
  placeholder?: string;// 输入框提示文字（可选）  
  emptyStateComponent: ReactNode;// 空状态显示组件(空状态下的提示信息)
  emoji?: string;// AI头像emoji（可选）
  showIngestForm?: boolean;// 是否显示文档上传功能（可选）
}) {
  const { user, loading: authLoading } = useAuth();
  const trimMessagesRequest = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.body || typeof init.body !== "string") {
        return fetch(input, init);
      }

      try {
        const parsed = JSON.parse(init.body);
        const lastMessage = Array.isArray(parsed.messages)
          ? parsed.messages[parsed.messages.length - 1]
          : undefined;

        const nextBody = JSON.stringify({
          ...parsed,
          messages: lastMessage ? [lastMessage] : [],
        });

        return fetch(input, {
          ...init,
          body: nextBody,
        });
      } catch {
        return fetch(input, init);
      }
    },
    [],
  );
  // 使用状态管理消息来源
  const [sourcesForMessages, setSourcesForMessages] = useState<
    Record<string, any>// 消息来源记录(泛型)
  >({});
  // ref 用于访问文本输入框 DOM 元素(控制框的大小)
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [previewFiles, setPreviewFiles] = useState<{
    file: File;
    previewUrl: string;
    attachmentUrl: string;
    type: "image" | "pdf";
    shouldRevokePreview: boolean;
  }[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([createSession()]);
  const [activeSessionId, setActiveSessionId] = useState<string>(sessions[0].id);
  const hasLoadedSessionsRef = useRef(false);
  const lastAppliedSessionIdRef = useRef<string | null>(null);
  const storageKey = useMemo(
    () => `chat-sessions:${user?.id ?? "guest"}`,
    [user?.id],
  );
// 功能谁干的？你要不要写？
// 收集 chat.messages,useChat 自动,不用
// 把输入框内容加成最后一条 user 消息,useChat 自动,不用
// 把 messages 序列化成 JSON,useChat 自动,不用
// 加上 experimental_attachments,你传的 options,要传
// 发 POST 请求,useChat 自动,不用
// 收到流式响应，更新 messages,useChat 自动,不用

// 名字,作用,你平时怎么用
// chat.messages,当前所有消息（自动更新）,渲染聊天记录
// chat.append,手动添加一条消息（推荐）,await chat.append(message)
// chat.handleSubmit,手动触发一次提交（你现在用的就是这个）,"chat.handleSubmit(e, options)"
// chat.isLoading,是否在请求中,显示“AI 正在思考...”
  const chat = useChat({
    api: props.endpoint,
    body: {
      userId: user?.id,
    },
    fetch: trimMessagesRequest,
    // 处理响应
    onResponse(response) {
      // 提取消息源:x-sources（RAG 来源）  后端返回格式x-sources: base64(JSON.stringify([{page:1,chunk:"..."}]))
      const sourcesHeader = response.headers.get("x-sources");
      const sources = sourcesHeader
        //1. 三元运算符condition(这里的条件为sourcesHeader是否存在) ? A : B
        //2. Buffer.from(sourcesHeader, "base64").toString("utf8"):先将把 Base64 字符串转成二进制数据,再把这个二进制数据按 UTF-8 编码转成普通字符串(最终得到json字符串)
        //3. JSON.parse():将json字符串解析为JSON对象
        //🔗 为什么要 Base64 + JSON 两层？
        //HTTP Header 里放内容，只能是纯文本、ASCII 安全的字符串 const sources = [{ title: "文档1", chunk: "..." }];
        //直接塞 JSON 可能有特殊字符，不安全 / 有兼容问题
        //所以后端做法一般是： 先把 JSON 对象转成字符串，再 Base64 编码
        ? JSON.parse(Buffer.from(sourcesHeader, "base64").toString("utf8")) 
        : [];
      // 提取消息索引
      const messageIndexHeader = response.headers.get("x-message-index");
      if (sources.length && messageIndexHeader !== null) {
        //更新消息来源记录
        setSourcesForMessages((prev) => ({
          ...prev,
          [messageIndexHeader]: sources,
        }));
      }
    },
    //stream流模式
    streamMode: "text",
    //异常处理
    onError: (e) =>
      toast.error(`Error while processing your request`, {
        description: e.message,
      }),
  });
  const { handleInputChange, setInput, setMessages } = chat;
  //安全释放Url
  const safelyRevokeUrl = (url: string) => {
    try {
      URL.revokeObjectURL(url);// 释放
    } catch {
      // 忽略清理错误(一般为已经处理过了)
    }
  };

  // 清除预览文件
  const clearPreviewFiles = useCallback(() => {
    setPreviewFiles((prev) => {
      prev.forEach((file) => {
        // 只释放预览图片的 URL
        if (file.shouldRevokePreview) {
          safelyRevokeUrl(file.previewUrl);
        }
      });
      return [];
    });
  }, []);

  useEffect(() => {
    if (authLoading || typeof window === "undefined") return;

    const rawSessions = window.localStorage.getItem(storageKey);

    try {
      const parsedSessions = rawSessions ? (JSON.parse(rawSessions) as ChatSession[]) : [];
      const nextSessions = parsedSessions.length > 0 ? parsedSessions : [createSession()];
      const nextActiveSession = nextSessions[0];

      hasLoadedSessionsRef.current = true;
      lastAppliedSessionIdRef.current = nextActiveSession.id;
      setSessions(nextSessions);
      setActiveSessionId(nextActiveSession.id);
      setMessages(nextActiveSession.messages);
      setSourcesForMessages({});
      clearPreviewFiles();
    } catch {
      const fallbackSession = createSession();
      hasLoadedSessionsRef.current = true;
      lastAppliedSessionIdRef.current = fallbackSession.id;
      setSessions([fallbackSession]);
      setActiveSessionId(fallbackSession.id);
      setMessages([]);
      setSourcesForMessages({});
      clearPreviewFiles();
    }
  }, [authLoading, clearPreviewFiles, setMessages, storageKey]);

  useEffect(() => {
    if (!hasLoadedSessionsRef.current || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(sessions));
  }, [sessions, storageKey]);

  useEffect(() => {
    if (!hasLoadedSessionsRef.current || !activeSessionId) return;
    if (lastAppliedSessionIdRef.current === activeSessionId) {
      lastAppliedSessionIdRef.current = null;
      return;
    }

    setSessions((prev) =>
      prev.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              messages: chat.messages,
              title: deriveSessionTitle(chat.messages),
              updatedAt: Date.now(),
            }
          : session,
      ),
    );
  }, [activeSessionId, chat.messages]);

  const selectSession = (sessionId: string) => {
    const targetSession = sessions.find((session) => session.id === sessionId);
    if (!targetSession) return;

    lastAppliedSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
    setMessages(targetSession.messages);
    setSourcesForMessages({});
    clearPreviewFiles();
  };

  const createNewSession = () => {
    const nextSession = createSession();
    setSessions((prev) => [nextSession, ...prev]);
    lastAppliedSessionIdRef.current = nextSession.id;
    setActiveSessionId(nextSession.id);
    setMessages([]);
    setInput("");
    setSourcesForMessages({});
    clearPreviewFiles();
  };

  const deleteSession = (sessionId: string) => {
    if (sessions.length <= 1) {
      const resetSession = createSession();
      setSessions([resetSession]);
      lastAppliedSessionIdRef.current = resetSession.id;
      setActiveSessionId(resetSession.id);
      setMessages([]);
      setInput("");
      setSourcesForMessages({});
      clearPreviewFiles();
      return;
    }

    const sortedSessions = sessions
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const targetIndex = sortedSessions.findIndex((session) => session.id === sessionId);
    const fallbackSession =
      sortedSessions[targetIndex + 1] ??
      sortedSessions[targetIndex - 1] ??
      sortedSessions[0];

    setSessions((prev) => prev.filter((session) => session.id !== sessionId));

    if (sessionId !== activeSessionId) {
      return;
    }

    if (!fallbackSession) {
      return;
    }

    lastAppliedSessionIdRef.current = fallbackSession.id;
    setActiveSessionId(fallbackSession.id);
    setMessages(fallbackSession.messages);
    setInput("");
    setSourcesForMessages({});
    clearPreviewFiles();
  };
  //读取pdf文件内容并转换为data:url格式,提供给handleFiles显示预览
  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      // 1. 创建一个 FileReader 实例
    // FileReader 是浏览器原生 API，专门用来读取本地文件内容
      const reader = new FileReader();
    // 2. 读取成功时的回调
    // reader.result 就是读取到的结果
    // 此时它是一个 string（data:url 格式），例如：
    // "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
      reader.onload = () => resolve(reader.result as string);
      // 3. 读取失败时的回调（比如文件损坏、权限问题）
      reader.onerror = () => reject(new Error("生成预览失败"));
      // 4. 真正开始读取！
    // readAsDataURL 会把文件内容编码成 data:url 字符串
    // 适用于图片、PDF 小预览等任何二进制文件
      reader.readAsDataURL(file);
    });
  // 处理图片/PDF 上传后的预览（支持多文件，限制 3 图 + 1 PDF）
  const handleFiles = async (files: File[]) => {
    const newPreviews: typeof previewFiles = [];

    const currentImageCount = previewFiles.filter(
      (p) => p.type === "image",
    ).length;
    const currentPdfCount = previewFiles.filter((p) => p.type === "pdf").length;

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";

      if (!isImage && !isPdf) {
        toast.error("仅支持图片或 PDF 文件");
        continue;
      }

      const exceededLimit =
        (isImage &&
          currentImageCount +
            newPreviews.filter((p) => p.type === "image").length >=
            3) ||
        (isPdf &&
          currentPdfCount +
            newPreviews.filter((p) => p.type === "pdf").length >=
            1);

      if (exceededLimit) {
        toast.warning(
          isImage ? "最多只能预览 3 张图片" : "最多只能预览 1 个 PDF 文件",
        );
        continue;
      }
      const previewUrl = URL.createObjectURL(file);//将本地照片转为浏览器直接访问的临时URL
      try {
        const attachmentUrl = await fileToDataUrl(file);
        //预览文件处理
        newPreviews.push({
          file,
          previewUrl,
          attachmentUrl,
          type: isImage ? "image" : "pdf",
          shouldRevokePreview: true,
        });
      } catch {
        safelyRevokeUrl(previewUrl);
        toast.error("生成文件预览失败");
      }
    }
      if (newPreviews.length > 0) {
        setPreviewFiles((prev) => [...prev, ...newPreviews]);
      }
  };
  // 粘贴事件
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    //1. 判断剪切板内是否有对象文件(包括图片,文件等)
    const items = e.clipboardData?.items;
    if (!items) return;//如果为纯文本粘贴就不处理

    // 2. 准备一个数组，专门收集“文件”类型的粘贴内容
    const files: File[] = [];
    // 3. 遍历剪贴板里的每一项（可能同时粘贴多张图）
    for (const item of items) {
      if (item.kind === "file") {//图片/pdf等都为file(文本为string)
        const file = item.getAsFile();//将“文件项”转为真正的File对象
        if (file) files.push(file);//防止“伪图片”造成null错误
      }
    }
    // 4. 如果真的粘贴了文件（而不是文字）
    if (files.length > 0) {
      // 阻止默认行为！
      // 不阻止的话，浏览器会把图片当成“乱码文字”插进 textarea
      e.preventDefault();
      void handleFiles(files);
    }
  };
  // 拖拽事件
  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    // 2. 阻止事件冒泡（可选，但强烈推荐）
    // 防止父元素也触发 drop 事件，导致重复处理
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);// e.dataTransfer.files 是一个 FileList（类数组）用 Array.from 转成真数组，方便操作
    if (files.length > 0) {
      void handleFiles(files);
    }
  };

  //发送消息给后端
  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (chat.isLoading) return;

    const trimmedInput = chat.input.trim();
    const hasText = trimmedInput.length > 0;
    const hasFiles = previewFiles.length > 0;

    if (!hasText && !hasFiles) return;

    //把用户预览中的所有文件，转成(map) Vercel AI SDK 要求的附件格式（数组） 
    const attachmentsForRequest = previewFiles.map((file) => ({
      name: file.file.name,//获取文件名
      url: file.attachmentUrl ?? file.previewUrl, // 关键！必须是 data:url 或 blob:url（base64 也行）
      contentType: file.file.type,
    }));
    //清空预览区
    clearPreviewFiles();
    // 3. 重置输入框高度（因为你可能用了自动增高）
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    chat.handleSubmit(e, {
      experimental_attachments: attachmentsForRequest,
      allowEmptySubmit: hasFiles && !hasText,
    });
  }
  //布局组件（ChatLayout）：
  return (
    <div className="grid h-full grid-rows-[auto,1fr] lg:grid-cols-[260px,1fr] lg:grid-rows-1">
      <aside className="border-b border-input bg-secondary/40 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-input px-4 py-4">
            <div>
              <p className="text-sm font-semibold">新增对话</p>
              <p className="text-xs text-muted-foreground">
                {user ? (user.email ?? "当前用户") : "游客模式"}
              </p>
            </div>
            <Button size="icon" variant="outline" onClick={createNewSession}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-3 py-3 text-xs text-muted-foreground">
            {user
              ? "对话管理"
              : "对话管理"}
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col">
              {sessions
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "flex min-w-[180px] items-center gap-2 rounded-xl border px-2 py-2 transition-colors lg:min-w-0",
                      session.id === activeSessionId
                        ? "border-primary bg-background shadow-sm"
                        : "border-transparent bg-background/70 hover:border-input hover:bg-background",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectSession(session.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-1 text-left"
                    >
                      <MessageSquareText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{session.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {session.messages.length > 0
                            ? `${session.messages.length} 条消息`
                            : "还没有消息"}
                        </div>
                      </div>
                    </button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteSession(session.id)}
                      aria-label="删除会话"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </aside>

      <div className="relative min-h-0">
        <ChatLayout
          content={
            chat.messages.length === 0 ? (
              <div>{props.emptyStateComponent}</div>
            ) : (
              <ChatMessages
                aiEmoji={props.emoji}
                messages={chat.messages}
                emptyStateComponent={props.emptyStateComponent}
                sourcesForMessages={sourcesForMessages}
              />
            )
          }
          footer={
            <>
              <AttachmentsPreview
                files={previewFiles}
                onRemove={(index) => {
                  setPreviewFiles((prev) => {
                    const target = prev[index];
                    if (target?.shouldRevokePreview) {
                      safelyRevokeUrl(target.previewUrl);
                    }
                    return prev.filter((_, i) => i !== index);
                  });
                }}
              />

              <ChatInput
                value={chat.input}
                onChange={handleInputChange}
                onSubmit={sendMessage}
                onStop={chat.stop}
                loading={chat.isLoading}
                placeholder={props.placeholder ?? "What's it like to be a pirate?"}
                textareaRef={textareaRef}
                onPaste={handlePaste}
                onDrop={handleDrop}
                actions={
                  chat.isLoading ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground animate-pulse">
                        思考中 ♦ ♦ ♦
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={chat.stop}
                      >
                        立即终止
                      </Button>
                    </div>
                  ) : null
                }
              >
                {props.showIngestForm && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="pl-2 pr-3 -ml-2"
                        disabled={chat.messages.length !== 0}
                      >
                        <Paperclip className="size-4" />
                        <span>Upload document</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload document</DialogTitle>
                        <DialogDescription>
                          Upload a document to use for the chat.
                        </DialogDescription>
                      </DialogHeader>
                      <UploadDocumentsForm />
                    </DialogContent>
                  </Dialog>
                )}

              </ChatInput>
            </>
          }
        />
      </div>
    </div>
  );
}
