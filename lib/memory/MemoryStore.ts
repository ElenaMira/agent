export interface MemoryStore {
  get(userId: string): Promise<string>;
  save(userId: string, data: string): Promise<void>;
}
