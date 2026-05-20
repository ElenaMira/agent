import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { MemoryStore } from "./MemoryStore";

function toSafeFileName(userId: string) {
  return encodeURIComponent(userId).replace(/%/g, "_");
}

export class FileMemoryStore implements MemoryStore {
  constructor(
    private readonly baseDir = path.join(process.cwd(), "memory"),
  ) {}

  private async ensureDir() {
    await mkdir(this.baseDir, { recursive: true });
  }

  private getFilePath(userId: string) {
    return path.join(this.baseDir, `${toSafeFileName(userId)}.md`);
  }

  async get(userId: string): Promise<string> {
    await this.ensureDir();

    try {
      return await readFile(this.getFilePath(userId), "utf8");
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        return "";
      }
      throw error;
    }
  }

  async save(userId: string, data: string): Promise<void> {
    await this.ensureDir();
    await writeFile(this.getFilePath(userId), data, "utf8");
  }
}
