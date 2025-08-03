import * as fs from "fs";
import * as path from "path";
import * as unzipper from "unzipper";

export function isValidEntry(entryPath: string): boolean {
  return (
    !entryPath.startsWith("__MACOSX/") &&
    !entryPath.includes("/__MACOSX/") &&
    !entryPath.split("/").some((p: string) => p.startsWith("._"))
  );
}

export async function downloadArchive(
  url: string,
  tmpZipPath: string,
  onProgress: (percent: number | null) => void,
): Promise<void> {
  const https = await import("https");
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const totalBytes = parseInt(
        response.headers["content-length"] || "0",
        10,
      );
      let receivedBytes = 0;
      let lastPercent = 0;
      const fileStream = fs.createWriteStream(tmpZipPath);
      response.on("data", (chunk) => {
        receivedBytes += chunk.length;
        if (totalBytes > 0) {
          const percent = Math.floor((receivedBytes / totalBytes) * 100);
          if (percent !== lastPercent) {
            onProgress(percent);
            lastPercent = percent;
          }
        } else {
          onProgress(null);
        }
      });
      response.pipe(fileStream);
      fileStream.on("finish", () => fileStream.close(() => resolve()));
      fileStream.on("error", reject);
    });
    request.on("error", reject);
  });
}

export async function countZipEntries(zipPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    fs.createReadStream(zipPath)
      .pipe(unzipper.Parse())
      .on("entry", (entry: any) => {
        if (isValidEntry(entry.path)) {
          count++;
        }
        entry.autodrain();
      })
      .on("close", () => resolve(count))
      .on("error", reject);
  });
}

// Helper function to handle directory extraction
function handleDirectoryEntry(entry: any, destPath: string): void {
  fs.mkdir(destPath, { recursive: true }, (err) => {
    if (err) console.warn("Failed to create directory:", destPath, err);
    entry.autodrain();
  });
}

// Helper function to handle file extraction
function handleFileEntry(entry: any, destPath: string): void {
  fs.mkdir(path.dirname(destPath), { recursive: true }, (err) => {
    if (err) {
      console.warn(
        "Failed to create parent directory:",
        path.dirname(destPath),
        err,
      );
      entry.autodrain();
      return;
    }

    entry
      .pipe(fs.createWriteStream(destPath))
      .on("error", (err: any) => {
        setImmediate(() => {
          console.warn("Failed to write file:", destPath, err);
        });
      })
      .on("finish", () => {});
  });
}

// Helper function to process a single zip entry
function processZipEntry(
  entry: any,
  destDir: string,
  processedCount: number,
  entryCount: number,
  onProgress: (info: { percent: number | null; file: string }) => void,
): number {
  if (!isValidEntry(entry.path)) {
    entry.autodrain();
    return processedCount;
  }

  processedCount++;
  const percent =
    entryCount > 0 ? Math.floor((processedCount / entryCount) * 100) : null;
  onProgress({ percent, file: entry.path });

  const destPath = path.join(destDir, entry.path);

  if (entry.type === "Directory") {
    handleDirectoryEntry(entry, destPath);
  } else {
    handleFileEntry(entry, destPath);
  }

  return processedCount;
}

export async function extractZipEntries(
  zipPath: string,
  destDir: string,
  entryCount: number,
  onProgress: (info: { percent: number | null; file: string }) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let processedCount = 0;

    fs.createReadStream(zipPath)
      .pipe(unzipper.Parse())
      .on("entry", (entry: any) => {
        processedCount = processZipEntry(
          entry,
          destDir,
          processedCount,
          entryCount,
          onProgress,
        );
      })
      .on("close", resolve)
      .on("error", reject);
  });
}
