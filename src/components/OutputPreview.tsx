import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Download, 
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Scissors
} from 'lucide-react';
import type { ContextFormat, ScannedFile, ModelPreset } from '../types';
import { formatTokenCount } from '../utils/tokenEstimator';
import { splitContextIntoChunks } from '../utils/contextPacker';
import JSZip from 'jszip';

interface OutputPreviewProps {
  bundledText: string;
  files: ScannedFile[];
  format: ContextFormat;
  onFormatChange: (fmt: ContextFormat) => void;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  redactSecrets: boolean;
  onToggleRedact: (val: boolean) => void;
  compactLines: boolean;
  onToggleCompact: (val: boolean) => void;
  activeFile: ScannedFile | null;
  selectedModel: ModelPreset;
  customPatterns: string;
  onCustomPatternsChange: (patterns: string) => void;
  includeSvg: boolean;
  onToggleSvg: (include: boolean) => void;
}

export const OutputPreview: React.FC<OutputPreviewProps> = ({
  bundledText,
  files,
  format,
  onFormatChange,
  systemPrompt,
  onSystemPromptChange,
  redactSecrets,
  onToggleRedact,
  compactLines,
  onToggleCompact,
  activeFile,
  selectedModel,
  customPatterns,
  onCustomPatternsChange,
  includeSvg,
  onToggleSvg,
}) => {
  const [viewMode, setViewMode] = useState<'bundle' | 'single'>('bundle');
  const [copied, setCopied] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [promptBoxExpanded, setPromptBoxExpanded] = useState(true);

  const selectedFiles = files.filter(f => f.selected);
  const totalTokens = selectedFiles.reduce((acc, f) => acc + f.tokens, 0);

  // Copy full context CTA
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bundledText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Download single file
  const handleDownload = () => {
    const ext = format === 'claude-xml' ? 'xml' : format === 'markdown' ? 'md' : 'txt';
    const blob = new Blob([bundledText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contextforge_bundle.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Smart Split Export (.zip)
  const handleSmartSplitZip = async () => {
    setIsSplitting(true);
    try {
      const chunkLimit = Math.max(10_000, Math.floor(selectedModel.maxTokens * 0.85));
      const chunks = splitContextIntoChunks(files, chunkLimit, {
        format,
        systemPrompt,
        redactSecrets,
        compactLines,
      });

      const zip = new JSZip();
      const ext = format === 'claude-xml' ? 'xml' : format === 'markdown' ? 'md' : 'txt';

      // Add instruction README to zip
      const readme = `# ContextForge Multi-Part Context Export
Total Parts: ${chunks.length}
Target Model: ${selectedModel.name} (${selectedModel.badge})
Total Bundled Files: ${selectedFiles.length}

HOW TO FEED TO YOUR LLM:
1. Upload or paste Part 1 first. Prompt the LLM: "I am providing a large codebase in multiple parts. Acknowledge receipt of Part 1, but do NOT begin responding yet until I say READY."
2. Provide Part 2 through Part ${chunks.length}.
3. Once all parts are ingested, instruct the LLM: "All parts are loaded. Now execute the instructions."
`;
      zip.file('README.txt', readme);

      // Add each chunk
      for (const chunk of chunks) {
        zip.file(`context_part_${chunk.index}_of_${chunk.total}.${ext}`, chunk.content);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contextforge_split_parts_${chunks.length}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Split export failed', err);
    } finally {
      setIsSplitting(false);
    }
  };

  // Code preview pagination / virtual slice for snappiness on huge bundles
  const previewLines = React.useMemo(() => {
    const textToView = viewMode === 'single' && activeFile ? activeFile.content : bundledText;
    const all = textToView.split('\n');
    return all.slice(0, 1500); // render first 1500 lines instantly without DOM lag
  }, [viewMode, activeFile, bundledText]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#09090B] overflow-hidden">
      {/* Top Toolbar: Format Tabs, Filters & Actions */}
      <div className="h-12 border-b border-[#27272A] bg-[#111113] px-4 flex items-center justify-between shrink-0 select-none">
        {/* Left: Format Tabs */}
        <div className="flex items-center gap-1 bg-[#18181B] p-1 rounded-lg border border-[#27272A]">
          <button
            onClick={() => onFormatChange('claude-xml')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              format === 'claude-xml'
                ? 'bg-[#27272A] text-white shadow-xs'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            Claude XML <span className="text-[10px] text-[#3B82F6] font-semibold">(Best)</span>
          </button>
          <button
            onClick={() => onFormatChange('markdown')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              format === 'markdown'
                ? 'bg-[#27272A] text-white shadow-xs'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            Markdown Fenced
          </button>
          <button
            onClick={() => onFormatChange('compact')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              format === 'compact'
                ? 'bg-[#27272A] text-white shadow-xs'
                : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            Plain Minified
          </button>
        </div>

        {/* Center: View Toggle (Full Bundle vs Single File) */}
        <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA]">
          <button
            onClick={() => setViewMode('bundle')}
            className={`px-2.5 py-1 rounded text-xs transition-colors ${
              viewMode === 'bundle'
                ? 'bg-[#27272A] text-white font-medium'
                : 'hover:text-white'
            }`}
          >
            Full Prompt Output
          </button>
          <span>/</span>
          <button
            onClick={() => setViewMode('single')}
            disabled={!activeFile}
            className={`px-2.5 py-1 rounded text-xs transition-colors disabled:opacity-40 ${
              viewMode === 'single'
                ? 'bg-[#27272A] text-white font-medium'
                : 'hover:text-white'
            }`}
          >
            Inspect: {activeFile ? activeFile.name : 'Click a file'}
          </button>
        </div>

        {/* Right: Primary CTAs & Export Buttons */}
        <div className="flex items-center gap-2">
          {/* Quick Option: Minify Toggle */}
          <button
            onClick={() => onToggleCompact(!compactLines)}
            className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
              compactLines
                ? 'bg-[#3B82F6]/15 text-[#60A5FA] border-[#3B82F6]/40'
                : 'text-[#71717A] border-[#27272A] hover:text-[#FAFAFA]'
            }`}
            title="Strip blank lines & single-line comments (-15% tokens)"
          >
            Strip Empty Lines
          </button>

          {/* Config Bar Toggle */}
          <button
            onClick={() => setShowConfigDrawer(!showConfigDrawer)}
            className="p-1.5 text-[#A1A1AA] hover:text-white hover:bg-[#27272A] rounded-md transition-colors border border-[#27272A]"
            title="Open Ignore & Exclusion Rules"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Download Single File */}
          <button
            onClick={handleDownload}
            className="p-1.5 text-[#A1A1AA] hover:text-white hover:bg-[#27272A] rounded-md transition-colors border border-[#27272A]"
            title={`Download .${format === 'claude-xml' ? 'xml' : format === 'markdown' ? 'md' : 'txt'}`}
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Smart Split Export .zip */}
          <button
            onClick={handleSmartSplitZip}
            disabled={isSplitting || selectedFiles.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#18181B] hover:bg-[#27272A] text-[#FAFAFA] border border-[#27272A] rounded-md text-xs font-mono transition-colors disabled:opacity-50"
            title="Split into ordered chunk parts for LLM context"
          >
            <Scissors className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Smart Split (.zip)</span>
          </button>

          {/* Primary CTA: Copy Full Context */}
          <button
            onClick={handleCopy}
            disabled={selectedFiles.length === 0}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all shadow-sm ${
              copied
                ? 'bg-[#10B981] text-white hover:bg-[#059669]'
                : 'bg-[#3B82F6] hover:bg-[#2563EB] text-white'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied {formatTokenCount(totalTokens)} tokens!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Full Context</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Slide-down Drawer: Custom Ignore Bar */}
      {showConfigDrawer && (
        <div className="bg-[#141417] border-b border-[#27272A] px-4 py-2.5 flex items-center justify-between text-xs animate-in slide-in-from-top-1">
          <div className="flex items-center gap-3 flex-1 max-w-2xl">
            <span className="text-[#A1A1AA] font-mono text-[11px] shrink-0">Custom Ignore Glob:</span>
            <input
              type="text"
              value={customPatterns}
              onChange={e => onCustomPatternsChange(e.target.value)}
              placeholder="e.g. *.test.ts, docs/*, mock/*"
              className="flex-1 bg-[#18181B] border border-[#27272A] rounded px-2.5 py-1 text-xs text-[#FAFAFA] placeholder-[#71717A] font-mono focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          <div className="flex items-center gap-4 text-xs text-[#A1A1AA]">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeSvg}
                onChange={e => onToggleSvg(e.target.checked)}
                className="rounded border-[#27272A] bg-[#18181B] text-[#3B82F6] focus:ring-0"
              />
              <span>Include .svg icons</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={redactSecrets}
                onChange={e => onToggleRedact(e.target.checked)}
                className="rounded border-[#27272A] bg-[#18181B] text-[#3B82F6] focus:ring-0"
              />
              <span>Auto-Redact Secrets</span>
            </label>
          </div>
        </div>
      )}

      {/* Task / System Instruction Prepend Box */}
      <div className="border-b border-[#27272A] bg-[#0E0E10]">
        <div
          onClick={() => setPromptBoxExpanded(!promptBoxExpanded)}
          className="px-4 py-1.5 flex items-center justify-between cursor-pointer text-xs text-[#A1A1AA] hover:text-[#FAFAFA] select-none"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[11px] uppercase tracking-wider text-[#71717A]">
              Task / Prepend Instruction Wrapper
            </span>
            {systemPrompt.trim() && (
              <span className="text-[10px] text-emerald-400 font-mono">
                (Active)
              </span>
            )}
          </div>
          {promptBoxExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#71717A]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#71717A]" />
          )}
        </div>

        {promptBoxExpanded && (
          <div className="px-4 pb-3">
            <textarea
              value={systemPrompt}
              onChange={e => onSystemPromptChange(e.target.value)}
              placeholder="Prepend instructions to your prompt (e.g. 'Review this architecture for concurrency bugs and refactor into clean modular hooks...')"
              rows={2}
              className="w-full bg-[#141417] border border-[#27272A] rounded-md p-2.5 text-xs text-[#FAFAFA] placeholder-[#52525B] focus:outline-none focus:border-[#3B82F6] font-mono resize-none transition-colors"
            />
          </div>
        )}
      </div>

      {/* Live Code Preview Window */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto bg-[#09090B] font-mono text-[11px] leading-relaxed p-4 select-text">
          <div className="table w-full border-collapse">
            {previewLines.map((line, idx) => (
              <div key={idx} className="table-row hover:bg-[#141417]/70 transition-colors">
                <span className="table-cell pr-4 text-right text-[#3F3F46] select-none w-10 shrink-0 font-mono text-[10px]">
                  {idx + 1}
                </span>
                <span className="table-cell text-[#D4D4D8] whitespace-pre font-mono">
                  {line}
                </span>
              </div>
            ))}
          </div>

          {bundledText.split('\n').length > 1500 && (
            <div className="mt-4 p-3 bg-[#111113] border border-[#27272A] rounded text-[#71717A] text-center text-xs">
              ... Remaining {bundledText.split('\n').length - 1500} lines truncated for fluid browser rendering. Full contents will be copied on click.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
