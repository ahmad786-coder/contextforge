import React from 'react';
import { 
  Folder, 
  FolderOpen, 
  Search, 
  Filter, 
  CheckSquare, 
  Square, 
  MinusSquare,
  AlertTriangle,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import type { TreeNode, ScannedFile } from '../types';
import { FileIcon } from './FileIcon';
import { formatTokenCount } from '../utils/tokenEstimator';

interface FileTreeProps {
  rootNode: TreeNode;
  onToggleSelect: (path: string, isDirectory: boolean) => void;
  onSelectAll: (select: boolean) => void;
  onFileClick: (file: ScannedFile) => void;
  activeFilePath: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  quickFilter: 'all' | 'src-only' | 'heavy';
  onQuickFilterChange: (f: 'all' | 'src-only' | 'heavy') => void;
}

export const FileTree: React.FC<FileTreeProps> = ({
  rootNode,
  onToggleSelect,
  onSelectAll,
  onFileClick,
  activeFilePath,
  searchQuery,
  onSearchChange,
  quickFilter,
  onQuickFilterChange,
}) => {
  const [collapsedPaths, setCollapsedPaths] = React.useState<Set<string>>(new Set());

  const toggleCollapse = (path: string) => {
    setCollapsedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth = 0) => {
    if (!node.path && node.id === 'root') {
      return (
        <div key="root-children" className="space-y-0.5">
          {node.children?.map(child => renderNode(child, 0))}
        </div>
      );
    }

    const isCollapsed = collapsedPaths.has(node.path);
    const isDir = node.isDirectory;

    // Filter check based on search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSelf = node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
      const matchesChild = node.children && hasMatchingChild(node, q);
      if (!matchesSelf && !matchesChild) {
        return null;
      }
    }

    // Quick filter check
    if (!isDir && node.file) {
      if (quickFilter === 'src-only' && !node.file.path.startsWith('src/')) {
        return null;
      }
      if (quickFilter === 'heavy' && node.file.tokens < 5000) {
        return null;
      }
    }

    // Checkbox state
    let checkState: 'checked' | 'unchecked' | 'indeterminate' = 'unchecked';
    if (isDir) {
      if (node.selectedFiles === node.totalFiles && node.totalFiles > 0) {
        checkState = 'checked';
      } else if (node.selectedFiles > 0) {
        checkState = 'indeterminate';
      }
    } else {
      checkState = node.file?.selected ? 'checked' : 'unchecked';
    }

    const isActive = !isDir && node.path === activeFilePath;

    return (
      <div key={node.id} className="select-none text-xs">
        <div
          className={`flex items-center gap-1.5 py-1 px-2 rounded group transition-colors cursor-pointer ${
            isActive
              ? 'bg-[#27272A] text-white font-medium'
              : 'hover:bg-[#18181B] text-[#A1A1AA] hover:text-[#FAFAFA]'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 14 + 8)}px` }}
        >
          {/* Collapse Arrow for Directories */}
          {isDir ? (
            <button
              onClick={e => {
                e.stopPropagation();
                toggleCollapse(node.path);
              }}
              className="p-0.5 hover:text-white text-[#71717A] rounded transition-transform"
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          ) : (
            <span className="w-3.5" />
          )}

          {/* Tri-state Checkbox */}
          <button
            onClick={e => {
              e.stopPropagation();
              onToggleSelect(node.path, isDir);
            }}
            className="p-0.5 text-[#71717A] hover:text-white transition-colors"
          >
            {checkState === 'checked' ? (
              <CheckSquare className="w-3.5 h-3.5 text-[#3B82F6]" />
            ) : checkState === 'indeterminate' ? (
              <MinusSquare className="w-3.5 h-3.5 text-[#3B82F6]" />
            ) : (
              <Square className="w-3.5 h-3.5 text-[#52525B]" />
            )}
          </button>

          {/* Node Icon */}
          <div
            className="flex items-center gap-1.5 flex-1 min-w-0"
            onClick={() => {
              if (isDir) {
                toggleCollapse(node.path);
              } else if (node.file) {
                onFileClick(node.file);
              }
            }}
          >
            {isDir ? (
              isCollapsed ? (
                <Folder className="w-3.5 h-3.5 text-[#EAB308] shrink-0" />
              ) : (
                <FolderOpen className="w-3.5 h-3.5 text-[#EAB308] shrink-0" />
              )
            ) : (
              <FileIcon fileName={node.name} className="w-3.5 h-3.5 shrink-0" />
            )}

            <span className="truncate font-mono text-[11px]">{node.name}</span>

            {/* Secret alert indicator on file */}
            {!isDir && node.file?.isSecretWarning && (
              <span
                title="Potential secret or sensitive .env file detected"
                className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.2 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded text-[9px]"
              >
                <AlertTriangle className="w-2.5 h-2.5" />
              </span>
            )}
          </div>

          {/* Token badge in JetBrains Mono */}
          <span className="text-[10px] font-mono text-[#52525B] group-hover:text-[#71717A] shrink-0 tabular-nums">
            {isDir ? formatTokenCount(node.selectedTokens) : formatTokenCount(node.file?.tokens || 0)}
          </span>
        </div>

        {/* Render children if directory and expanded */}
        {isDir && !isCollapsed && node.children && (
          <div>{node.children.map(child => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  function hasMatchingChild(node: TreeNode, query: string): boolean {
    if (!node.children) return false;
    for (const child of node.children) {
      if (
        child.name.toLowerCase().includes(query) ||
        child.path.toLowerCase().includes(query) ||
        (child.isDirectory && hasMatchingChild(child, query))
      ) {
        return true;
      }
    }
    return false;
  }

  return (
    <div className="flex flex-col h-full bg-[#111113] border-r border-[#27272A]">
      {/* Search Input Bar */}
      <div className="p-2.5 border-b border-[#27272A] space-y-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#71717A]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Filter files (Ctrl+K or /)..."
            className="w-full bg-[#18181B] border border-[#27272A] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#FAFAFA] placeholder-[#71717A] focus:outline-none focus:border-[#3B82F6] font-mono transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2 text-[#71717A] hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1 text-[11px]">
          <button
            onClick={() => onQuickFilterChange('all')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              quickFilter === 'all'
                ? 'bg-[#27272A] text-white font-semibold'
                : 'text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#18181B]'
            }`}
          >
            All Code
          </button>
          <button
            onClick={() => onQuickFilterChange('src-only')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              quickFilter === 'src-only'
                ? 'bg-[#3B82F6]/20 text-[#60A5FA] border border-[#3B82F6]/30 font-semibold'
                : 'text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#18181B]'
            }`}
          >
            Src Only
          </button>
          <button
            onClick={() => onQuickFilterChange('heavy')}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              quickFilter === 'heavy'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold'
                : 'text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#18181B]'
            }`}
            title="Files with >5,000 tokens"
          >
            &gt;5k Tokens
          </button>
        </div>
      </div>

      {/* Explorer Tree Action Bar */}
      <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-[#71717A] border-b border-[#27272A] bg-[#0E0E10]">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold uppercase tracking-wider text-[10px] text-[#A1A1AA]">
            EXPLORER
          </span>
          <span className="text-[10px] font-mono text-[#52525B]">
            ({rootNode.selectedFiles}/{rootNode.totalFiles})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectAll(true)}
            className="hover:text-white transition-colors text-[10px]"
          >
            Select All
          </button>
          <span>•</span>
          <button
            onClick={() => onSelectAll(false)}
            className="hover:text-white transition-colors text-[10px]"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Scrollable File Tree */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 font-sans">
        {rootNode.totalFiles === 0 ? (
          <div className="p-6 text-center text-[#71717A] text-xs space-y-2">
            <Filter className="w-6 h-6 mx-auto text-[#3F3F46]" />
            <p>No files match current filters</p>
          </div>
        ) : (
          renderNode(rootNode)
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-2 border-t border-[#27272A] bg-[#0E0E10] text-[10px] text-[#71717A] flex items-center justify-between font-mono">
        <span>Selected: {rootNode.selectedFiles} files</span>
        <span className="text-[#3B82F6]">{formatTokenCount(rootNode.selectedTokens)} tokens</span>
      </div>
    </div>
  );
};
