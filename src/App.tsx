import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { ScannedFile, ContextFormat, ModelPreset, SecretFinding } from './types';
import { DEMO_PROJECT_FILES } from './utils/demoData';
import { MODEL_PRESETS } from './utils/modelPresets';
import { buildFileTree } from './utils/fileScanner';
import { scanDirectoryHandle, scanFileList, scanZipArchive } from './utils/fileLoader';
import { generateContextBundle } from './utils/contextPacker';
import { scanFileForSecrets } from './utils/secretGuard';
import { Header } from './components/Header';
import { FileTree } from './components/FileTree';
import { OutputPreview } from './components/OutputPreview';
import { SecretModal } from './components/SecretModal';

export function App() {
  // Primary State
  const [files, setFiles] = useState<ScannedFile[]>(DEMO_PROJECT_FILES);
  const [folderName, setFolderName] = useState<string>('contextforge-sample-repo');
  const [activeFilePath, setActiveFilePath] = useState<string | null>('src/App.tsx');
  const [format, setFormat] = useState<ContextFormat>('claude-xml');
  const [selectedModel, setSelectedModel] = useState<ModelPreset>(MODEL_PRESETS[0]);
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [redactSecrets, setRedactSecrets] = useState<boolean>(true);
  const [compactLines, setCompactLines] = useState<boolean>(false);
  const [customPatterns, setCustomPatterns] = useState<string>('');
  const [includeSvg, setIncludeSvg] = useState<boolean>(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'src-only' | 'heavy'>('all');

  // UI Modals & Progress
  const [isSecretModalOpen, setIsSecretModalOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Hidden folder input fallback for non-Chrome browsers
  const folderInputRef = React.useRef<HTMLInputElement>(null);

  // Hotkey: Ctrl+K or / to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Filter files"]') as HTMLInputElement;
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute live secrets list across all files
  const secretFindings = useMemo<SecretFinding[]>(() => {
    const allFindings: SecretFinding[] = [];
    for (const f of files) {
      const findings = scanFileForSecrets(f.path, f.content);
      allFindings.push(...findings);
    }
    return allFindings;
  }, [files]);

  // Compute aggregated live metrics
  const selectedFiles = useMemo(() => files.filter(f => f.selected), [files]);
  const selectedTokens = useMemo(() => selectedFiles.reduce((acc, f) => acc + f.tokens, 0), [selectedFiles]);
  const totalLines = useMemo(() => selectedFiles.reduce((acc, f) => acc + f.lines, 0), [selectedFiles]);

  // Hierarchical File Tree structure
  const rootNode = useMemo(() => buildFileTree(files), [files]);

  // Generate real-time bundled prompt
  const bundledText = useMemo(() => {
    return generateContextBundle({
      files,
      format,
      systemPrompt,
      redactSecrets,
      compactLines,
    });
  }, [files, format, systemPrompt, redactSecrets, compactLines]);

  // Active file object
  const activeFile = useMemo(() => {
    return files.find(f => f.path === activeFilePath) || null;
  }, [files, activeFilePath]);

  // Toggle selection for a specific file or all files in a directory
  const handleToggleSelect = useCallback((targetPath: string, isDirectory: boolean) => {
    setFiles(prev => {
      if (isDirectory) {
        // Toggle all children under this path
        const prefix = targetPath + '/';
        const children = prev.filter(f => f.path.startsWith(prefix));
        const allSelected = children.every(f => f.selected);
        const newSelected = !allSelected;

        return prev.map(f => {
          if (f.path.startsWith(prefix)) {
            return { ...f, selected: newSelected };
          }
          return f;
        });
      } else {
        return prev.map(f => {
          if (f.path === targetPath) {
            return { ...f, selected: !f.selected };
          }
          return f;
        });
      }
    });
  }, []);

  // Select all or clear all files
  const handleSelectAll = useCallback((select: boolean) => {
    setFiles(prev => prev.map(f => ({ ...f, selected: select })));
  }, []);

  // Native File System Access API with automatic fallback
  const handleOpenFolder = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore
        const dirHandle = await window.showDirectoryPicker();
        setIsProcessing(true);
        setProgressMsg('Scanning directory structure...');
        setFolderName(dirHandle.name);

        const customPats = customPatterns ? customPatterns.split(',').map(s => s.trim()) : [];
        const scanned = await scanDirectoryHandle(
          dirHandle,
          customPats,
          includeSvg,
          (count, path) => setProgressMsg(`Loaded ${count} files (${path})...`)
        );

        if (scanned.length > 0) {
          setFiles(scanned);
          setActiveFilePath(scanned[0].path);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('DirectoryPicker error, trying fallback', err);
          folderInputRef.current?.click();
        }
      } finally {
        setIsProcessing(false);
        setProgressMsg('');
      }
    } else {
      folderInputRef.current?.click();
    }
  };

  // Fallback directory input change
  const handleDirectoryInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsProcessing(true);
      setProgressMsg('Reading directory files...');
      const firstFile = e.target.files[0];
      const rootDir = firstFile.webkitRelativePath.split('/')[0] || 'uploaded-project';
      setFolderName(rootDir);

      const customPats = customPatterns ? customPatterns.split(',').map(s => s.trim()) : [];
      const scanned = await scanFileList(
        e.target.files,
        customPats,
        includeSvg,
        (count) => setProgressMsg(`Loaded ${count} files...`)
      );

      if (scanned.length > 0) {
        setFiles(scanned);
        setActiveFilePath(scanned[0].path);
      }
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Handle .zip archive upload
  const handleUploadZip = async (file: File) => {
    setIsProcessing(true);
    setProgressMsg(`Extracting ${file.name} in memory...`);
    setFolderName(file.name.replace(/\.zip$/i, ''));

    try {
      const customPats = customPatterns ? customPatterns.split(',').map(s => s.trim()) : [];
      const scanned = await scanZipArchive(
        file,
        customPats,
        includeSvg,
        (count) => setProgressMsg(`Loaded ${count} files from zip...`)
      );

      if (scanned.length > 0) {
        setFiles(scanned);
        setActiveFilePath(scanned[0].path);
      }
    } catch (err) {
      console.error('Failed reading zip file', err);
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  // Drag and Drop support anywhere in the workspace
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const firstItem = e.dataTransfer.files[0];
      if (firstItem.name.endsWith('.zip')) {
        await handleUploadZip(firstItem);
      } else {
        // Normal file drop
        await scanFileList(e.dataTransfer.files, [], false);
      }
    }
  };

  return (
    <div 
      className="flex flex-col h-screen w-screen bg-[#09090B] text-[#FAFAFA] overflow-hidden select-none"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden input for cross-browser folder selection */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-ignore: non-standard webkit directory attributes
        webkitdirectory="true"
        directory="true"
        multiple
        className="hidden"
        onChange={handleDirectoryInputChange}
      />

      {/* Top Header & Model Budget Bar */}
      <Header
        selectedTokens={selectedTokens}
        selectedFilesCount={selectedFiles.length}
        totalLines={totalLines}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        secretCount={secretFindings.length}
        onOpenSecretModal={() => setIsSecretModalOpen(true)}
        onOpenFolder={handleOpenFolder}
        onUploadZip={handleUploadZip}
        isProcessing={isProcessing}
        folderName={folderName}
      />

      {/* Main 3-Pane Developer Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Resizable File Explorer Tree */}
        <div className="w-80 shrink-0 h-full border-r border-[#27272A] bg-[#111113] overflow-hidden flex flex-col">
          <FileTree
            rootNode={rootNode}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            onFileClick={f => setActiveFilePath(f.path)}
            activeFilePath={activeFilePath}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            quickFilter={quickFilter}
            onQuickFilterChange={setQuickFilter}
          />
        </div>

        {/* Center / Right Pane: Live Output Preview & Prompt Wrapper */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <OutputPreview
            bundledText={bundledText}
            files={files}
            format={format}
            onFormatChange={setFormat}
            systemPrompt={systemPrompt}
            onSystemPromptChange={setSystemPrompt}
            redactSecrets={redactSecrets}
            onToggleRedact={setRedactSecrets}
            compactLines={compactLines}
            onToggleCompact={setCompactLines}
            activeFile={activeFile}
            selectedModel={selectedModel}
            customPatterns={customPatterns}
            onCustomPatternsChange={setCustomPatterns}
            includeSvg={includeSvg}
            onToggleSvg={setIncludeSvg}
          />
        </div>
      </div>

      {/* Secret Findings Modal */}
      <SecretModal
        isOpen={isSecretModalOpen}
        onClose={() => setIsSecretModalOpen(false)}
        findings={secretFindings}
        redactEnabled={redactSecrets}
        onToggleRedact={setRedactSecrets}
        onOpenFile={path => setActiveFilePath(path)}
      />

      {/* Processing Loader Backdrop */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs">
          <div className="p-5 bg-[#141417] border border-[#27272A] rounded-xl shadow-2xl flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin" />
            <div className="text-xs font-mono text-[#FAFAFA]">{progressMsg || 'Processing codebase...'}</div>
          </div>
        </div>
      )}

      {/* Drag Over Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center bg-[#3B82F6]/10 border-2 border-dashed border-[#3B82F6] m-4 rounded-xl">
          <div className="bg-[#111113] p-4 rounded-lg shadow-xl text-center">
            <span className="text-sm font-semibold text-[#FAFAFA]">Drop local folder or .zip here</span>
            <p className="text-xs text-[#71717A] mt-1">Files will be parsed 100% locally in browser memory</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
