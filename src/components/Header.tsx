import React from 'react';
import { 
  FolderDown, 
  Upload, 
  Layers, 
  ShieldCheck, 
  ShieldAlert, 
  ChevronDown
} from 'lucide-react';
import type { ModelPreset } from '../types';
import { MODEL_PRESETS } from '../utils/modelPresets';
import { formatTokenCount } from '../utils/tokenEstimator';

interface HeaderProps {
  selectedTokens: number;
  selectedFilesCount: number;
  totalLines: number;
  selectedModel: ModelPreset;
  onSelectModel: (m: ModelPreset) => void;
  secretCount: number;
  onOpenSecretModal: () => void;
  onOpenFolder: () => void;
  onUploadZip: (file: File) => void;
  isProcessing: boolean;
  folderName: string;
}

export const Header: React.FC<HeaderProps> = ({
  selectedTokens,
  selectedFilesCount,
  totalLines,
  selectedModel,
  onSelectModel,
  secretCount,
  onOpenSecretModal,
  onOpenFolder,
  onUploadZip,
  isProcessing,
  folderName,
}) => {
  const [modelDropdownOpen, setModelDropdownOpen] = React.useState(false);
  const zipInputRef = React.useRef<HTMLInputElement>(null);

  const percentUsed = Math.min(100, (selectedTokens / selectedModel.maxTokens) * 100);
  const isOverLimit = selectedTokens > selectedModel.maxTokens;
  const isWarning = percentUsed >= 80 && !isOverLimit;

  // Determine budget bar color
  let barColor = 'bg-[#3B82F6]';
  if (isOverLimit) {
    barColor = 'bg-[#EF4444]'; // crimson
  } else if (isWarning) {
    barColor = 'bg-[#EAB308]'; // amber
  }

  return (
    <header className="h-13 bg-[#111113] border-b border-[#27272A] px-4 flex items-center justify-between select-none">
      {/* Left: Brand & Source Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center shadow-xs">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm tracking-tight text-[#FAFAFA]">ContextForge</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#27272A] text-[#A1A1AA] rounded">v1.0</span>
            </div>
            <p className="text-[10px] text-[#71717A] font-mono truncate max-w-[140px]">
              {folderName || 'No workspace opened'}
            </p>
          </div>
        </div>

        {/* Action Buttons: Open Local Folder + Upload Zip */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#27272A]">
          <button
            onClick={onOpenFolder}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#27272A] hover:bg-[#3F3F46] disabled:opacity-50 text-[#FAFAFA] rounded-md text-xs font-medium transition-all shadow-xs"
          >
            <FolderDown className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Open Local Folder</span>
          </button>

          <button
            onClick={() => zipInputRef.current?.click()}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-transparent hover:bg-[#1C1C1F] text-[#A1A1AA] hover:text-[#FAFAFA] border border-[#27272A] disabled:opacity-50 rounded-md text-xs transition-colors"
            title="Upload project .zip archive"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>.zip</span>
          </button>

          <input
            ref={zipInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                onUploadZip(file);
                e.target.value = '';
              }
            }}
          />
        </div>
      </div>

      {/* Center: Model Budget Bar & Live Metrics */}
      <div className="flex items-center gap-5">
        {/* Model Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1 bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] rounded-md text-xs font-mono text-[#FAFAFA] transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span className="font-sans font-medium">{selectedModel.name}</span>
            <span className="text-[10px] text-[#71717A]">({selectedModel.badge})</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#71717A]" />
          </button>

          {modelDropdownOpen && (
            <div className="absolute left-0 mt-1 w-64 bg-[#141417] border border-[#27272A] rounded-lg shadow-xl py-1 z-30 font-sans">
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase text-[#71717A] tracking-wider border-b border-[#27272A]">
                Context Target Budget
              </div>
              {MODEL_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onSelectModel(preset);
                    setModelDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[#1E1E22] transition-colors ${
                    preset.id === selectedModel.id ? 'text-[#3B82F6] font-medium bg-[#1A1A1E]' : 'text-[#FAFAFA]'
                  }`}
                >
                  <div>
                    <div>{preset.name}</div>
                    <div className="text-[10px] text-[#71717A] font-mono">{preset.provider}</div>
                  </div>
                  <span className="font-mono text-[11px] text-[#A1A1AA] bg-[#27272A] px-1.5 py-0.5 rounded">
                    {preset.badge}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Budget Fill Bar & Metric Numbers */}
        <div className="flex flex-col w-56 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#A1A1AA]">
              {selectedFilesCount} files <span className="text-[#52525B]">({totalLines.toLocaleString()} loc)</span>
            </span>
            <span className={`font-semibold ${isOverLimit ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-[#FAFAFA]'}`}>
              {formatTokenCount(selectedTokens)} <span className="text-[#71717A] font-normal">/ {selectedModel.badge}</span>
            </span>
          </div>

          <div className="w-full h-1.5 bg-[#27272A] rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} transition-all duration-300`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>
      </div>

      {/* Right: Security Pill & Privacy Guarantees */}
      <div className="flex items-center gap-3">
        {/* Security Scan Pill */}
        <button
          onClick={onOpenSecretModal}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-colors border ${
            secretCount > 0
              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
          }`}
        >
          {secretCount > 0 ? (
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>{secretCount > 0 ? `${secretCount} Secrets Found` : '0 Secrets Detected'}</span>
        </button>

        {/* Local Only Tag */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 text-[11px] text-[#A1A1AA] bg-[#18181B] border border-[#27272A] rounded-md font-mono" title="No backend server. 100% in-browser RAM.">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span>100% Local</span>
        </div>
      </div>
    </header>
  );
};
