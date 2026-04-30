import { promises as fs } from "node:fs";
import path from "node:path";

export async function readJsonFile<T>(filePath: string, fallbackValue: T): Promise<T> {
  try {
    const rawContent = await fs.readFile(filePath, "utf8");
    return JSON.parse(rawContent) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallbackValue;
    }

    throw error;
  }
}

export async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, filePath);
}
