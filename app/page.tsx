import { ChatWindow } from "@/components/ChatWindow";


export default function Home() {
  const InfoCard = (
      <ul>
      </ul>

  );
  return (
    <ChatWindow
      endpoint="api/chat"
      emoji="🏴‍☠️"
      placeholder="I'm an LLM pretending to be a pirate! Ask me about the pirate life!"
      emptyStateComponent={InfoCard}
      showIngestForm={true}
    />
  );
}
