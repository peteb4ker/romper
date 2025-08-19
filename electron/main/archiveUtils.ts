import * as fs from "fs";
import * as path from "path";
import * as unzipper from "unzipper";

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

export async function downloadArchive(
  url: string,
  tmpZipPath: string,
  onProgress: (percent: null | number) => void
): Promise<void> {
  const https = await import("https");

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(tmpZipPath);
    setupFileStream(fileStream, resolve, reject);

    const request = https.get(url, (response) => {
      const totalBytes = parseInt(
        response.headers["content-length"] || "0",
        10
      );

      const trackProgress = createProgressTracker(totalBytes, onProgress);
      response.on("data", trackProgress);
      response.pipe(fileStream);
    });

    request.on("error", reject);
  });
}

export async function extractZipEntries(
  zipPath: string,
  destDir: string,
  entryCount: number,
  onProgress: (info: { file: string; percent: null | number }) => void
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
          onProgress
        );
      })
      .on("close", resolve)
      .on("error", reject);
  });
}

export function isValidEntry(entryPath: string): boolean {
  return (
    !entryPath.startsWith("__MACOSX/") &&
    !entryPath.includes("/__MACOSX/") &&
    !entryPath.split("/").some((p: string) => p.startsWith("._"))
  );
}

// Helper to track download progress
function createProgressTracker(
  totalBytes: number,
  onProgress: (percent: null | number) => void
) {
  let receivedBytes = 0;
  let lastPercent = 0;

  return (chunk: any) => {
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
  };
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
        err
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
  onProgress: (info: { file: string; percent: null | number }) => void
): number {
  if (!isValidEntry(entry.path)) {
    entry.autodrain();
    return processedCount;
  }

  processedCount++;
  const percent =
    entryCount > 0 ? Math.floor((processedCount / entryCount) * 100) : null;
  onProgress({ file: entry.path, percent });

  const destPath = path.join(destDir, entry.path);

  if (entry.type === "Directory") {
    handleDirectoryEntry(entry, destPath);
  } else {
    handleFileEntry(entry, destPath);
  }

  return processedCount;
}

// Helper to setup file stream handlers
function setupFileStream(
  fileStream: fs.WriteStream,
  resolve: () => void,
  reject: (error: any) => void
) {
  fileStream.on("finish", () => {
    fileStream.close(() => resolve());
  });
  fileStream.on("error", reject);
}
