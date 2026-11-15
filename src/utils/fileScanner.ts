import type { ScannedFile, TreeNode } from '../types';
import { estimateTokens } from './tokenEstimator';
import { scanFileForSecrets } from './secretGuard';

// Default heavy or irrelevant directories
export const DEFAULT_IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  '.venv',
  'venv',
  '__pycache__',
  '.idea',
  '.vscode',
  'coverage',
  'target',
  '.cache',
  '.turbo',
  '.svn',
  '.hg',
  'bower_components',
]);

// Binary & media file extensions to exclude automatically
export const DEFAULT_BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
  '.mp4', '.webm', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.flac', '.ogg',
  '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.iso',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.pyc', '.class', '.o', '.obj',
]);

// Lock files that typically inflate tokens without prompt value
export const DEFAULT_LOCK_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'cargo.lock',
  'gemfile.lock',
  'composer.lock',
  'poetry.lock',
]);

/**
 * Checks if a byte buffer contains binary data (checks first 1024 bytes for null bytes \0).
 */
export function isBinaryBuffer(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const sampleSize = Math.min(bytes.length, 1024);
  for (let i = 0; i < sampleSize; i++) {
    if (bytes[i] === 0) {
      return true; // Null byte found -> binary
    }
  }
  return false;
}

/**
 * Parses .gitignore contents into simple matcher patterns.
 */
export function parseGitignore(content: string): string[] {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

/**
 * Evaluates whether a relative path matches gitignore or custom patterns.
 */
export function matchesPattern(relPath: string, pattern: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  let cleanPattern = pattern.trim().replace(/\\/g, '/');
  if (!cleanPattern) return false;

  // Negation not supported for simplicity
  if (cleanPattern.startsWith('!')) return false;

  const isDirectoryOnly = cleanPattern.endsWith('/');
  if (isDirectoryOnly) {
    cleanPattern = cleanPattern.slice(0, -1);
  }

  // Exact directory or segment match
  const segments = normalized.split('/');
  if (segments.includes(cleanPattern)) {
    return true;
  }

  // Handle wildcards: e.g. *.test.ts, docs/*, etc.
  if (cleanPattern.includes('*')) {
    const escaped = cleanPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*');
    const regex = new RegExp(`(^|/)${escaped}($|/)`);
    return regex.test(normalized);
  }

  // Substring match e.g. "dist" matches "dist/bundle.js" or "foo/dist"
  if (normalized === cleanPattern || normalized.startsWith(cleanPattern + '/') || normalized.endsWith('/' + cleanPattern) || normalized.includes('/' + cleanPattern + '/')) {
    return true;
  }

  return false;
}

/**
 * Validates if a file or directory should be ignored.
 */
export function shouldIgnore(
  relPath: string,
  _isDir: boolean,
  customPatterns: string[] = [],
  gitignorePatterns: string[] = [],
  includeSvg: boolean = false
): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  const fileName = segments[segments.length - 1] || '';
  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()!.toLowerCase() : '';

  // 1. Check directory ignore
  for (const seg of segments) {
    if (DEFAULT_IGNORE_DIRS.has(seg)) {
      return true;
    }
  }

  // 2. Lock files
  if (DEFAULT_LOCK_FILES.has(fileName.toLowerCase())) {
    return true;
  }

  // 3. Binary extensions
  if (DEFAULT_BINARY_EXTENSIONS.has(ext)) {
    return true;
  }

  if (ext === '.svg' && !includeSvg) {
    return true;
  }

  // 4. Gitignore patterns
  for (const pat of gitignorePatterns) {
    if (matchesPattern(normalized, pat)) {
      return true;
    }
  }

  // 5. Custom user patterns
  for (const pat of customPatterns) {
    if (matchesPattern(normalized, pat)) {
      return true;
    }
  }

  return false;
}

/**
 * Concurrency runner for processing files Snappily without blocking UI.
 */
export async function runConcurrent<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const p = Promise.resolve().then(() => worker(item)).then(res => {
      results.push(res);
    });
    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
      // clean finished promises
      for (let i = executing.length - 1; i >= 0; i--) {
        // Remove settled
        executing.splice(i, 1);
      }
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Builds a hierarchical tree structure from a flat array of scanned files.
 */
export function buildFileTree(files: ScannedFile[]): TreeNode {
  const root: TreeNode = {
    id: 'root',
    name: 'root',
    path: '',
    isDirectory: true,
    children: [],
    totalFiles: 0,
    selectedFiles: 0,
    totalTokens: 0,
    selectedTokens: 0,
  };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (isFile) {
        current.children = current.children || [];
        current.children.push({
          id: file.id,
          name: part,
          path: currentPath,
          isDirectory: false,
          file,
          totalFiles: 1,
          selectedFiles: file.selected ? 1 : 0,
          totalTokens: file.tokens,
          selectedTokens: file.selected ? file.tokens : 0,
        });
      } else {
        current.children = current.children || [];
        let dirNode = current.children.find(c => c.isDirectory && c.name === part);
        if (!dirNode) {
          dirNode = {
            id: currentPath,
            name: part,
            path: currentPath,
            isDirectory: true,
            children: [],
            totalFiles: 0,
            selectedFiles: 0,
            totalTokens: 0,
            selectedTokens: 0,
          };
          current.children.push(dirNode);
        }
        current = dirNode;
      }
    }
  }

  // Recursively calculate stats and sort (folders first, then alphabetical)
  function computeStatsAndSort(node: TreeNode): void {
    if (!node.isDirectory || !node.children) return;

    let totalFiles = 0;
    let selectedFiles = 0;
    let totalTokens = 0;
    let selectedTokens = 0;

    for (const child of node.children) {
      computeStatsAndSort(child);
      totalFiles += child.totalFiles;
      selectedFiles += child.selectedFiles;
      totalTokens += child.totalTokens;
      selectedTokens += child.selectedTokens;
    }

    node.totalFiles = totalFiles;
    node.selectedFiles = selectedFiles;
    node.totalTokens = totalTokens;
    node.selectedTokens = selectedTokens;

    node.children.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  computeStatsAndSort(root);
  return root;
}

/**
 * Creates a ScannedFile instance from raw path and content.
 */
export function createScannedFile(path: string, content: string): ScannedFile {
  const normPath = path.replace(/\\/g, '/');
  const name = normPath.split('/').pop() || normPath;
  const extension = name.includes('.') ? '.' + name.split('.').pop()! : '';
  const lines = content.length === 0 ? 0 : content.split('\n').length;
  const tokens = estimateTokens(content);
  const secretFindings = scanFileForSecrets(normPath, content);

  // Auto-deselect .env files by default
  const isEnvFile = name.startsWith('.env');
  const selected = !isEnvFile;

  return {
    id: normPath,
    path: normPath,
    name,
    extension,
    size: new Blob([content]).size,
    content,
    lines,
    tokens,
    selected,
    isSecretWarning: secretFindings.length > 0 || isEnvFile,
    secretCount: secretFindings.length,
  };
}
