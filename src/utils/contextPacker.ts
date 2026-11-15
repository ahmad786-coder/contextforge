import type { ScannedFile, ContextFormat } from '../types';
import { redactSecretsFromContent } from './secretGuard';

/**
 * Builds an ASCII directory tree representation.
 */
export function generateAsciiTree(files: ScannedFile[]): string {
  const treeObj: any = {};

  for (const file of files) {
    const parts = file.path.split('/');
    let curr = treeObj;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        curr[part] = null; // leaf file
      } else {
        curr[part] = curr[part] || {};
        curr = curr[part];
      }
    }
  }

  const lines: string[] = ['.'];

  function walk(node: any, prefix = '') {
    const keys = Object.keys(node).sort((a, b) => {
      const aIsDir = node[a] !== null;
      const bIsDir = node[b] !== null;
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const isLast = i === keys.length - 1;
      const branch = isLast ? '└── ' : '├── ';
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');

      if (node[key] === null) {
        lines.push(`${prefix}${branch}${key}`);
      } else {
        lines.push(`${prefix}${branch}${key}/`);
        walk(node[key], nextPrefix);
      }
    }
  }

  walk(treeObj);
  return lines.join('\n');
}

/**
 * Maps common file extensions to markdown fence syntax tags.
 */
export function getLanguageForFile(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'mts':
    case 'cts':
      return 'typescript';
    case 'tsx':
      return 'tsx';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'jsx':
      return 'jsx';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'scss':
    case 'sass':
      return 'scss';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'java':
      return 'java';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'hpp':
    case 'cc':
      return 'cpp';
    case 'cs':
      return 'csharp';
    case 'php':
      return 'php';
    case 'rb':
      return 'ruby';
    case 'sh':
    case 'bash':
      return 'bash';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'md':
      return 'markdown';
    case 'sql':
      return 'sql';
    case 'toml':
      return 'toml';
    case 'dockerfile':
      return 'dockerfile';
    default:
      return '';
  }
}

/**
 * Minifies/compacts code: strips redundant blank lines and single-line comments.
 */
export function compactContent(content: string, filePath: string): string {
  const lang = getLanguageForFile(filePath);
  const lines = content.split('\n');
  const compacted: string[] = [];

  for (let line of lines) {
    const trimmed = line.trim();

    // Strip empty lines
    if (!trimmed) continue;

    // Strip single line comments depending on syntax
    if (['javascript', 'typescript', 'tsx', 'jsx', 'c', 'cpp', 'csharp', 'java', 'rust', 'go', 'json'].includes(lang)) {
      if (trimmed.startsWith('//') && !trimmed.startsWith('///')) {
        continue;
      }
    } else if (['python', 'ruby', 'bash', 'yaml', 'toml', 'dockerfile'].includes(lang)) {
      if (trimmed.startsWith('#') && !trimmed.startsWith('#!')) {
        continue;
      }
    } else if (['sql'].includes(lang)) {
      if (trimmed.startsWith('--')) {
        continue;
      }
    }

    compacted.push(line);
  }

  return compacted.join('\n');
}

export interface PackOptions {
  files: ScannedFile[];
  format: ContextFormat;
  systemPrompt?: string;
  redactSecrets?: boolean;
  compactLines?: boolean;
}

/**
 * Main context packaging function.
 */
export function generateContextBundle(options: PackOptions): string {
  const { files, format, systemPrompt, redactSecrets = true, compactLines = false } = options;
  const selectedFiles = files.filter(f => f.selected);

  if (selectedFiles.length === 0) {
    return '<!-- ContextForge: No files selected. Select files from the left explorer pane to generate context. -->';
  }

  const processedFiles = selectedFiles.map(file => {
    let text = file.content;
    if (redactSecrets) {
      const { redactedContent } = redactSecretsFromContent(text);
      text = redactedContent;
    }
    if (compactLines) {
      text = compactContent(text, file.path);
    }
    return {
      ...file,
      content: text,
    };
  });

  const asciiTree = generateAsciiTree(selectedFiles);

  const parts: string[] = [];

  // Optional User Task / System Prompt Prepend
  if (systemPrompt && systemPrompt.trim()) {
    if (format === 'claude-xml') {
      parts.push(`<task_instruction>\n${systemPrompt.trim()}\n</task_instruction>\n`);
    } else {
      parts.push(`## Instructions\n${systemPrompt.trim()}\n\n---\n`);
    }
  }

  if (format === 'claude-xml') {
    parts.push('<codebase>');
    parts.push('  <directory_tree>');
    parts.push(asciiTree.split('\n').map(l => '    ' + l).join('\n'));
    parts.push('  </directory_tree>\n');

    for (const f of processedFiles) {
      parts.push(`  <file path="${f.path}" tokens="${f.tokens}">`);
      parts.push(f.content);
      parts.push('  </file>\n');
    }

    parts.push('</codebase>');
    return parts.join('\n');
  }

  // Markdown format
  if (format === 'markdown') {
    parts.push('# Project Structure\n');
    parts.push('```text\n' + asciiTree + '\n```\n');
    parts.push('# Repository Files\n');

    for (const f of processedFiles) {
      const lang = getLanguageForFile(f.path);
      parts.push(`### ${f.path}\n`);
      parts.push(`\`\`\`${lang}\n${f.content}\n\`\`\`\n`);
    }

    return parts.join('\n');
  }

  // Compact / Plain Text format
  if (format === 'compact') {
    parts.push('=== DIRECTORY STRUCTURE ===');
    parts.push(asciiTree);
    parts.push('\n=== CODEBASE CONTENT ===\n');

    for (const f of processedFiles) {
      parts.push(`--- FILE: ${f.path} [${f.tokens} tokens] ---`);
      parts.push(f.content);
      parts.push('\n');
    }

    return parts.join('\n');
  }

  return '';
}

/**
 * Splits selected files into sequential chunks under the target token threshold.
 */
export function splitContextIntoChunks(
  files: ScannedFile[],
  chunkTokenLimit: number,
  options: Omit<PackOptions, 'files'>
): { index: number; total: number; content: string; tokenCount: number; fileCount: number }[] {
  const selectedFiles = files.filter(f => f.selected);
  if (selectedFiles.length === 0) return [];

  const chunks: ScannedFile[][] = [];
  let currentChunk: ScannedFile[] = [];
  let currentTokens = 0;

  for (const file of selectedFiles) {
    if (currentChunk.length > 0 && currentTokens + file.tokens > chunkTokenLimit) {
      chunks.push(currentChunk);
      currentChunk = [file];
      currentTokens = file.tokens;
    } else {
      currentChunk.push(file);
      currentTokens += file.tokens;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  const total = chunks.length;

  return chunks.map((chunkFiles, idx) => {
    const chunkContent = generateContextBundle({
      ...options,
      files: chunkFiles,
      systemPrompt: options.systemPrompt
        ? `[PART ${idx + 1} OF ${total}]\n${options.systemPrompt}`
        : `[PART ${idx + 1} OF ${total}]`,
    });

    const tokenCount = chunkFiles.reduce((acc, f) => acc + f.tokens, 0);

    return {
      index: idx + 1,
      total,
      content: chunkContent,
      tokenCount,
      fileCount: chunkFiles.length,
    };
  });
}
