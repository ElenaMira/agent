export type Task = {
  id: string;
  description: string;
  tool?: string;
  status: "pending" | "running" | "done" | "failed";
  result?: any;
};