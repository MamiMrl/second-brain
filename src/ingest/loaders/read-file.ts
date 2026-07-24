import fs from "node:fs/promises";
import { IngestError } from "../errors.js";

export async function readTextFile(absPath: string, source: string): Promise<string> {
  const content = (await readRaw(absPath, source, "utf8")) as string;
  if (content.trim().length === 0) throw IngestError.emptyFile(source);
  return content;
}

export async function readFileBuffer(absPath: string, source: string): Promise<Buffer> {
  const buffer = (await readRaw(absPath, source)) as Buffer;
  if (buffer.byteLength === 0) throw IngestError.emptyFile(source);
  return buffer;
}

async function readRaw(absPath: string, source: string, encoding?: BufferEncoding) {
  try {
    return encoding ? await fs.readFile(absPath, encoding) : await fs.readFile(absPath);
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") throw IngestError.fileNotFound(source);
    if (isErrnoException(err) && err.code === "EACCES") throw IngestError.permissionDenied(source);
    throw err;
  }
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
