import { createScannedFile, isBinaryBuffer, shouldIgnore, parseGitignore } from './fileScanner';
import type { ScannedFile } from '../types';
import JSZip from 'jszip';

/**
 * Reads a DirectoryHandle recursively using the native File System Access API.
 */
export async function scanDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  customPatterns: string[] = [],
  includeSvg: boolean = false,
  onProgress?: (count: number, currentPath: string) => void
): Promise<ScannedFile[]> {
  const scannedFiles: ScannedFile[] = [];
  let gitignorePatterns: string[] = [];

  // 1. Try to find root .gitignore first if exists
  try {
    const gitignoreHandle = await dirHandle.getFileHandle('.gitignore');
    const gitignoreFile = await gitignoreHandle.getFile();
    const text = await gitignoreFile.text();
    gitignorePatterns = parseGitignore(text);
  } catch {
    // .gitignore doesn't exist at root
  }

  let processedCount = 0;

  async function traverse(currentHandle: FileSystemDirectoryHandle, currentPath = '') {
    // @ts-ignore: async iterator in modern browsers
    for await (const entry of currentHandle.values()) {
      const relPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      if (entry.kind === 'directory') {
        if (shouldIgnore(relPath, true, customPatterns, gitignorePatterns, includeSvg)) {
          continue;
        }
        await traverse(entry as FileSystemDirectoryHandle, relPath);
      } else if (entry.kind === 'file') {
        if (shouldIgnore(relPath, false, customPatterns, gitignorePatterns, includeSvg)) {
          continue;
        }

        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          // Read first 1024 bytes to check for binary data
          const slice = file.slice(0, 1024);
          const buffer = await slice.arrayBuffer();

          if (isBinaryBuffer(buffer)) {
            continue; // Skip binary files
          }

          const content = await file.text();
          const scanned = createScannedFile(relPath, content);
          scannedFiles.push(scanned);
          processedCount++;

          if (onProgress && processedCount % 5 === 0) {
            onProgress(processedCount, relPath);
          }
        } catch (err) {
          console.warn(`Failed to read file ${relPath}`, err);
        }
      }
    }
  }

  await traverse(dirHandle);
  return scannedFiles;
}

/**
 * Reads a FileList from <input type="file" webkitdirectory directory multiple />
 */
export async function scanFileList(
  fileList: FileList | File[],
  customPatterns: string[] = [],
  includeSvg: boolean = false,
  onProgress?: (count: number, currentPath: string) => void
): Promise<ScannedFile[]> {
  const filesArray = Array.from(fileList);
  const scannedFiles: ScannedFile[] = [];

  // Check for root .gitignore
  let gitignorePatterns: string[] = [];
  const gitignoreFile = filesArray.find(
    f => f.webkitRelativePath === '.gitignore' || f.name === '.gitignore'
  );
  if (gitignoreFile) {
    try {
      const text = await gitignoreFile.text();
      gitignorePatterns = parseGitignore(text);
    } catch {
      // ignore
    }
  }

  let count = 0;
  for (const file of filesArray) {
    // Determine relative path (strip top root folder if webkitRelativePath starts with directory name)
    let rawPath = file.webkitRelativePath || file.name;
    const parts = rawPath.replace(/\\/g, '/').split('/');
    // If it came from directory upload, usually "my-project/src/index.ts" -> strip root if multiple parts
    const relPath = parts.length > 1 ? parts.slice(1).join('/') : parts[0];

    if (shouldIgnore(relPath, false, customPatterns, gitignorePatterns, includeSvg)) {
      continue;
    }

    try {
      const slice = file.slice(0, 1024);
      const buffer = await slice.arrayBuffer();

      if (isBinaryBuffer(buffer)) {
        continue;
      }

      const content = await file.text();
      scannedFiles.push(createScannedFile(relPath, content));
      count++;
      if (onProgress && count % 5 === 0) {
        onProgress(count, relPath);
      }
    } catch (err) {
      console.warn(`Failed reading file ${relPath}`, err);
    }
  }

  return scannedFiles;
}

/**
 * Extracts and scans a .zip repository archive completely in-browser RAM.
 */
export async function scanZipArchive(
  zipFile: File,
  customPatterns: string[] = [],
  includeSvg: boolean = false,
  onProgress?: (count: number, currentPath: string) => void
): Promise<ScannedFile[]> {
  const zip = await JSZip.loadAsync(zipFile);
  const scannedFiles: ScannedFile[] = [];

  // Read .gitignore if present in zip
  let gitignorePatterns: string[] = [];
  const gitignoreZipEntry = Object.keys(zip.files).find(
    k => k.endsWith('.gitignore') && k.split('/').length <= 2
  );
  if (gitignoreZipEntry) {
    try {
      const text = await zip.files[gitignoreZipEntry].async('string');
      gitignorePatterns = parseGitignore(text);
    } catch {
      // ignore
    }
  }

  // Detect if zip has a single root wrapping folder (common with GitHub zip downloads like "repo-main/...")
  const allEntries = Object.keys(zip.files);
  const firstSlashIdxs = allEntries.map(e => e.indexOf('/')).filter(idx => idx > 0);
  let prefixToStrip = '';
  if (firstSlashIdxs.length > 0 && firstSlashIdxs.length >= allEntries.length * 0.9) {
    const commonRoot = allEntries[0].split('/')[0] + '/';
    if (allEntries.every(e => e.startsWith(commonRoot))) {
      prefixToStrip = commonRoot;
    }
  }

  let count = 0;
  for (const [rawKey, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    let relPath = rawKey;
    if (prefixToStrip && relPath.startsWith(prefixToStrip)) {
      relPath = relPath.slice(prefixToStrip.length);
    }
    if (!relPath) continue;

    if (shouldIgnore(relPath, false, customPatterns, gitignorePatterns, includeSvg)) {
      continue;
    }

    try {
      // Read first chunk to check binary
      const uint8 = await entry.async('uint8array');
      if (isBinaryBuffer(uint8)) {
        continue;
      }

      const content = new TextDecoder('utf-8', { fatal: false }).decode(uint8);
      scannedFiles.push(createScannedFile(relPath, content));
      count++;
      if (onProgress && count % 5 === 0) {
        onProgress(count, relPath);
      }
    } catch (err) {
      console.warn(`Failed reading zip entry ${relPath}`, err);
    }
  }

  return scannedFiles;
}
