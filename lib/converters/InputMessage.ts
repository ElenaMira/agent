import { HumanMessage, AIMessage, ChatMessage } from "@langchain/core/messages";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

// //  转换 Vercel 消息为 LangChain 消息
// export const convertVercelMessageToLangChainMessage = (msg: any) => {
//   // 1. 用户消息（可能包含图片）
//   if (msg.role === "user") {
//     const content: any[] = [];

//     // 文本部分
//     if (typeof msg.content === "string" && msg.content.trim().length > 0) {
//       content.push({
//         type: "text",
//         text: msg.content,
//       });
//     }

//     // 图片部分：Vercel AI SDK 就是放 experimental_attachments
//     if (msg.experimental_attachments && Array.isArray(msg.experimental_attachments)) {
//       for (const item of msg.experimental_attachments) {
//         if (item.url) {
//           content.push({
//             type: "image_url",
//             image_url:
//             {
//               url: item.url,
//             },
//           });
//         }
//       }
//     }
//     // console.log("HumanMessage content:", content);
//     return new HumanMessage({content});
//   }

//   // 2. assistant 普通文本
//   if (msg.role === "assistant") {
//     return new AIMessage({
//       content: msg.content,
//       tool_calls: msg?.tool_calls,
//     });
//   }

//   // 3. 其他角色
//   return new ChatMessage({
//     role: msg.role,
//     content: msg.content,
//   });
// };
// 2. 转换消息格式 → LangChain 消息(id+role+content)
export const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    const anyMsg = message as any;
    const attachments = anyMsg.experimental_attachments ?? [];
    if (attachments.length > 0) {
      const content: Array<any> = [{ type: "text", text: message.content }];
      for (const att of attachments) {
        const ct: string = att.contentType ?? "";
        if (ct.startsWith("image/")) {
          let imageUrlString = att.url;
          // console.log("att.url:", att.url)
          // 🚨 关键修正点：检查是否已经是 Data URL，如果不是，则补全
          if (!imageUrlString.startsWith("data:")) {
              // 假设 att.url 只是裸的 Base64 字符串，我们需要拼接前缀
              imageUrlString = `data:${ct};base64,${imageUrlString}`;
          }
          content.push({ type: "image_url", image_url: { url: imageUrlString,detail: 'low' } });
        } else if (ct === "application/pdf") {
          // 将 PDF 作为提示文本注入（多模态模型可结合后续检索处理）
          content.push({ type: "text", text: `PDF 附件: ${att.name} (${att.url})` });
        }
      }
      return new HumanMessage({ content });
    }
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};