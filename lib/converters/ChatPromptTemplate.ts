import { BaseMessage } from "@langchain/core/messages";

function stripImagesFromMessage(m: BaseMessage) {
  if (!Array.isArray(m.content)) return m;
  return {
    ...m,
    content: m.content.filter((c) => c.type !== "image_url"),
  };
}

export const buildPrompt = async (msg: BaseMessage[]) => {
  // 若 msg 为 undefined 或 null，强制当空数组
  const safeMsg: BaseMessage[] = Array.isArray(msg) ? msg : [];

  // 去除图片内容
  const message = safeMsg.map(stripImagesFromMessage);

  // 取最后一条作为 latest
  const latest = message.length > 0 ? message[message.length - 1] : null;

  // 历史消息 = 除最后一条外
  const history = message.slice(0, -1);

  return {
    history_messages: history,
    input: latest ? latest.content : "用户没有输入消息",  // 无消息则空字符串
    agent_scratchpad: [], // 必须是数组
  };
};
