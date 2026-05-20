import { ChatWindow } from "@/components/ChatWindow";


export default function Home() {
  const InfoCard = (
      <ul>
      </ul>

  );
  return (
    <ChatWindow
      endpoint="api/chat/retrieval_agents"
      emoji="🤖"
      placeholder="欢迎使用检索智能体，支持图片/PDF和网页检索问答。"
      emptyStateComponent={InfoCard}
      showIngestForm={true}
    />
  );
}
