import fs from "node:fs/promises";
import path from "node:path";
import { IngestError } from "./errors.js";

// FR-1.7: <path> may be a file or a directory (recursive, native — not a
// shell-loop responsibility). Returns absolute paths to every regular file
// found, skipping dotfiles (.DS_Store, etc).
export async function walk(inputPath: string): Promise<string[]> {
  const absPath = path.resolve(inputPath);

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(absPath);
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") throw IngestError.fileNotFound(inputPath);
    if (isErrnoException(err) && err.code === "EACCES") throw IngestError.permissionDenied(inputPath);
    throw err;
  }

  if (stat.isFile()) return [absPath];

  const entries = await fs.readdir(absPath, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
}

// FR-1.5/§7: the source path stored on each Document must be stable and
// portable across machines, so it's kept relative to the CLI's cwd rather
// than absolute.
export function toSourcePath(absPath: string): string {
  return path.relative(process.cwd(), absPath).split(path.sep).join("/");
}

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
