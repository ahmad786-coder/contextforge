import { describe, it, expect } from 'vitest';
import {
  shouldIgnore,
  parseGitignore,
  createScannedFile,
  isBinaryBuffer,
} from '../fileScanner';
import { scanFileForSecrets, redactSecretsFromContent } from '../secretGuard';
import { estimateTokens } from '../tokenEstimator';
import { generateContextBundle } from '../contextPacker';

describe('ContextForge Utility Suite', () => {
  describe('fileScanner & ignore engine', () => {
    it('excludes heavy default folders like node_modules and .git', () => {
      expect(shouldIgnore('node_modules/react/index.js', false)).toBe(true);
      expect(shouldIgnore('.git/config', false)).toBe(true);
      expect(shouldIgnore('dist/bundle.js', false)).toBe(true);
      expect(shouldIgnore('build/main.js', false)).toBe(true);
      expect(shouldIgnore('.venv/bin/python', false)).toBe(true);
      expect(shouldIgnore('src/components/Header.tsx', false)).toBe(false);
    });

    it('excludes binary extensions and lock files', () => {
      expect(shouldIgnore('public/logo.png', false)).toBe(true);
      expect(shouldIgnore('assets/font.woff2', false)).toBe(true);
      expect(shouldIgnore('package-lock.json', false)).toBe(true);
      expect(shouldIgnore('yarn.lock', false)).toBe(true);
      expect(shouldIgnore('src/index.ts', false)).toBe(false);
    });

    it('correctly matches and respects .gitignore rules', () => {
      const gitignore = `
# dependencies
coverage
*.log
docs/*.pdf
secret_folder/
`;
      const patterns = parseGitignore(gitignore);
      expect(patterns).toContain('coverage');
      expect(patterns).toContain('*.log');

      expect(shouldIgnore('coverage/lcov.info', false, [], patterns)).toBe(true);
      expect(shouldIgnore('debug.log', false, [], patterns)).toBe(true);
      expect(shouldIgnore('src/main.ts', false, [], patterns)).toBe(false);
    });

    it('detects binary buffers with null bytes', () => {
      const textBuffer = new TextEncoder().encode('Hello, world! Normal text.');
      const binaryBuffer = new Uint8Array([72, 101, 108, 0, 108, 111]); // contains \0
      expect(isBinaryBuffer(textBuffer)).toBe(false);
      expect(isBinaryBuffer(binaryBuffer)).toBe(true);
    });

    it('auto-deselects .env files for safety', () => {
      const envFile = createScannedFile('.env', 'DATABASE_URL=postgres://localhost:5432\n');
      expect(envFile.selected).toBe(false);
      expect(envFile.isSecretWarning).toBe(true);

      const codeFile = createScannedFile('src/index.ts', 'console.log("hello");\n');
      expect(codeFile.selected).toBe(true);
      expect(codeFile.isSecretWarning).toBe(false);
    });
  });

  describe('secretGuard', () => {
    it('detects high-risk OpenAI, AWS, and Google API keys', () => {
      const sampleCode = `
const openAiKey = "sk-proj-9481948194819481948194819481";
const awsKey = "AKIAIOSFODNN7EXAMPLE";
const googleKey = "AIzaSyD-123456789012345678901234567890";
`;
      const findings = scanFileForSecrets('src/api.ts', sampleCode);
      expect(findings.length).toBeGreaterThanOrEqual(3);
      expect(findings.some(f => f.ruleName.includes('OpenAI'))).toBe(true);
      expect(findings.some(f => f.ruleName.includes('AWS'))).toBe(true);
      expect(findings.some(f => f.ruleName.includes('Google API'))).toBe(true);
    });

    it('redacts secrets without touching real disk files', () => {
      const sampleCode = 'const key = "sk-ant-api-983198319831983198319831";\nconsole.log(key);';
      const { redactedContent, redactionCount } = redactSecretsFromContent(sampleCode);

      expect(redactionCount).toBeGreaterThanOrEqual(1);
      expect(redactedContent).toContain('[REDACTED_SECRET]');
      expect(redactedContent).not.toContain('sk-ant-api-');
    });
  });

  describe('tokenEstimator & contextPacker', () => {
    it('estimates tokens consistently for code', () => {
      const code = `
import React from 'react';

export const MyComponent: React.FC = () => {
  return <div>Hello world</div>;
};
`;
      const tokens = estimateTokens(code);
      expect(tokens).toBeGreaterThan(10);
      expect(tokens).toBeLessThan(100);
    });

    it('generates well-formed Claude XML format with directory tree', () => {
      const files = [
        createScannedFile('src/index.ts', 'console.log("index");'),
        createScannedFile('src/App.tsx', 'export function App() { return 1; }'),
      ];

      const xmlOutput = generateContextBundle({
        files,
        format: 'claude-xml',
        systemPrompt: 'Refactor code cleanly',
      });

      expect(xmlOutput).toContain('<codebase>');
      expect(xmlOutput).toContain('<directory_tree>');
      expect(xmlOutput).toContain('<file path="src/index.ts" tokens="');
      expect(xmlOutput).toContain('<task_instruction>');
      expect(xmlOutput).toContain('Refactor code cleanly');
      expect(xmlOutput).toContain('</codebase>');
    });

    it('generates fenced markdown format', () => {
      const files = [
        createScannedFile('src/index.ts', 'const a = 1;'),
      ];

      const mdOutput = generateContextBundle({
        files,
        format: 'markdown',
      });

      expect(mdOutput).toContain('# Project Structure');
      expect(mdOutput).toContain('### src/index.ts');
      expect(mdOutput).toContain('```typescript');
      expect(mdOutput).toContain('const a = 1;');
    });
  });
});
