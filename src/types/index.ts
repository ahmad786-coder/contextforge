export interface ScannedFile {
  id: string; // unique identifier / relative path
  path: string; // relative path with forward slashes e.g. "src/App.tsx"
  name: string; // "App.tsx"
  extension: string; // ".tsx"
  size: number; // size in bytes
  content: string; // text content
  lines: number; // line count
  tokens: number; // estimated token count
  selected: boolean; // whether included in bundle
  isSecretWarning?: boolean; // whether flagged by secret scanner
  secretCount?: number;
}

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
  file?: ScannedFile;
  totalFiles: number;
  selectedFiles: number;
  totalTokens: number;
  selectedTokens: number;
}

export interface SecretFinding {
  id: string;
  filePath: string;
  line: number;
  ruleName: string;
  severity: 'high' | 'medium';
  snippet: string;
  matchedText: string;
}

export type ContextFormat = 'claude-xml' | 'markdown' | 'compact';

export interface ModelPreset {
  id: string;
  name: string;
  provider: string;
  maxTokens: number;
  badge: string;
}
