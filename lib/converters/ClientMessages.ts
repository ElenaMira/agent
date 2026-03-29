export interface ClientMessage {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: {
    type: "image" | "file";
    url: string;
  }[];
}