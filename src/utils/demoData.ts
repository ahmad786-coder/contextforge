import type { ScannedFile } from '../types';

export const DEMO_PROJECT_FILES: ScannedFile[] = [
  {
    id: 'package.json',
    path: 'package.json',
    name: 'package.json',
    extension: '.json',
    size: 680,
    content: `{
  "name": "contextforge-demo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^1.73.0"
  }
}`,
    lines: 16,
    tokens: 92,
    selected: true,
  },
  {
    id: 'src/main.tsx',
    path: 'src/main.tsx',
    name: 'main.tsx',
    extension: '.tsx',
    size: 320,
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    lines: 11,
    tokens: 65,
    selected: true,
  },
  {
    id: 'src/App.tsx',
    path: 'src/App.tsx',
    name: 'App.tsx',
    extension: '.tsx',
    size: 1450,
    content: `import React, { useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { CodeViewer } from './components/CodeViewer';

export function App() {
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [selectedFile, setSelectedFile] = useState<string | null>('src/App.tsx');

  return (
    <div className="flex h-screen bg-[#09090B] text-[#FAFAFA]">
      <Sidebar onSelectFile={setSelectedFile} activeFile={selectedFile} />
      <main className="flex-1 flex flex-col">
        <Header activeTab={activeTab} onTabChange={setActiveTab} />
        <CodeViewer file={selectedFile} />
      </main>
    </div>
  );
}`,
    lines: 21,
    tokens: 172,
    selected: true,
  },
  {
    id: 'src/components/Header.tsx',
    path: 'src/components/Header.tsx',
    name: 'Header.tsx',
    extension: '.tsx',
    size: 980,
    content: `import React from 'react';
import { Terminal, Shield, Zap } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  return (
    <header className="h-12 border-b border-[#27272A] bg-[#111113] px-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Terminal className="w-4 h-4 text-blue-500" />
        <span className="font-semibold text-sm">ContextForge</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-[#A1A1AA]">
        <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-emerald-500" /> Zero Telemetry</span>
        <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-500" /> Local RAM</span>
      </div>
    </header>
  );
};`,
    lines: 24,
    tokens: 188,
    selected: true,
  },
  {
    id: 'src/components/Sidebar.tsx',
    path: 'src/components/Sidebar.tsx',
    name: 'Sidebar.tsx',
    extension: '.tsx',
    size: 1120,
    content: `import React from 'react';
import { Folder, FileCode, ChevronRight } from 'lucide-react';

interface SidebarProps {
  activeFile: string | null;
  onSelectFile: (file: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeFile, onSelectFile }) => {
  return (
    <aside className="w-64 border-r border-[#27272A] bg-[#0E0E10] p-3 text-sm">
      <div className="text-xs uppercase tracking-wider text-[#71717A] mb-2 font-mono">Project Files</div>
      <div className="space-y-1">
        <div 
          onClick={() => onSelectFile('src/App.tsx')}
          className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#1C1C1F] text-[#FAFAFA]"
        >
          <FileCode className="w-4 h-4 text-blue-400" />
          <span>App.tsx</span>
        </div>
      </div>
    </aside>
  );
};`,
    lines: 24,
    tokens: 165,
    selected: true,
  },
  {
    id: 'src/components/CodeViewer.tsx',
    path: 'src/components/CodeViewer.tsx',
    name: 'CodeViewer.tsx',
    extension: '.tsx',
    size: 1300,
    content: `import React from 'react';

interface CodeViewerProps {
  file: string | null;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ file }) => {
  return (
    <div className="flex-1 p-4 font-mono text-xs bg-[#09090B] overflow-auto">
      <div className="text-[#71717A] mb-2">// Viewing {file || 'No file selected'}</div>
      <div className="text-[#A1A1AA]">
        Ready to pack into token-optimized AI bundle.
      </div>
    </div>
  );
};`,
    lines: 17,
    tokens: 114,
    selected: true,
  },
  {
    id: 'src/services/apiClient.ts',
    path: 'src/services/apiClient.ts',
    name: 'apiClient.ts',
    extension: '.ts',
    size: 890,
    content: `// Sample API Client
export async function fetchProjectMetadata(projectId: string) {
  const endpoint = \`/api/projects/\${projectId}\`;
  const res = await fetch(endpoint, {
    headers: {
      'Content-Type': 'application/json',
      // Safe placeholder - scanner verifies high entropy keys
      'Authorization': 'Bearer test_user_session_token_xyz'
    }
  });
  return res.json();
}`,
    lines: 13,
    tokens: 88,
    selected: true,
  },
  {
    id: '.env.example',
    path: '.env.example',
    name: '.env.example',
    extension: '.example',
    size: 210,
    content: `# Sample environment variables (safe template)
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
OPENAI_API_KEY=your_api_key_here
`,
    lines: 5,
    tokens: 42,
    selected: false,
    isSecretWarning: true,
    secretCount: 1,
  },
];
