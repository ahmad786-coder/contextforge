import React from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  X, 
  Lock, 
  CheckCircle2, 
  FileText
} from 'lucide-react';
import type { SecretFinding } from '../types';

interface SecretModalProps {
  isOpen: boolean;
  onClose: () => void;
  findings: SecretFinding[];
  redactEnabled: boolean;
  onToggleRedact: (enabled: boolean) => void;
  onOpenFile: (filePath: string) => void;
}

export const SecretModal: React.FC<SecretModalProps> = ({
  isOpen,
  onClose,
  findings,
  redactEnabled,
  onToggleRedact,
  onOpenFile,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#111113] border border-[#27272A] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#27272A] flex items-center justify-between bg-[#141417]">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${findings.length > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              {findings.length > 0 ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#FAFAFA] flex items-center gap-2">
                Secret & API Key Guard
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${findings.length > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                  {findings.length} findings
                </span>
              </h3>
              <p className="text-xs text-[#A1A1AA] mt-0.5">
                Zero file uploads. Pattern scanning executes 100% locally in browser memory.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#71717A] hover:text-[#FAFAFA] hover:bg-[#27272A] rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Redaction Toggle Bar */}
        <div className="px-5 py-3 bg-[#18181B] border-b border-[#27272A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-[#3B82F6]" />
            <span className="text-xs font-medium text-[#FAFAFA]">
              Redact Secrets Before Packing
            </span>
            <span className="text-[11px] text-[#A1A1AA]">
              (Replaces keys with <code className="bg-[#27272A] text-amber-300 px-1 py-0.5 rounded text-[10px] font-mono">[REDACTED_SECRET]</code> in prompt)
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={redactEnabled}
              onChange={e => onToggleRedact(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[#27272A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3B82F6]"></div>
          </label>
        </div>

        {/* Findings List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {findings.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-medium text-[#FAFAFA]">No Exposed Secrets Found</h4>
              <p className="text-xs text-[#71717A] max-w-sm mx-auto">
                No high-risk API keys, Bearer tokens, or private RSA keys were detected in the currently scanned files.
              </p>
            </div>
          ) : (
            findings.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-[#0E0E10] border border-[#27272A] hover:border-[#3F3F46] rounded-lg text-xs space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-500/10 text-red-400 border border-red-500/30">
                      {item.severity.toUpperCase()}
                    </span>
                    <span className="font-medium text-[#FAFAFA]">{item.ruleName}</span>
                  </div>
                  <button
                    onClick={() => {
                      onOpenFile(item.filePath);
                      onClose();
                    }}
                    className="flex items-center gap-1 text-[11px] text-[#3B82F6] hover:underline font-mono"
                  >
                    <FileText className="w-3 h-3" />
                    {item.filePath}:{item.line}
                  </button>
                </div>

                <div className="p-2 bg-[#18181B] rounded font-mono text-[11px] text-[#A1A1AA] overflow-x-auto border border-[#27272A]/50 flex items-center justify-between gap-4">
                  <span className="truncate">{item.snippet}</span>
                  {redactEnabled ? (
                    <span className="text-emerald-400 text-[10px] font-semibold shrink-0">
                      Will Redact ✓
                    </span>
                  ) : (
                    <span className="text-amber-400 text-[10px] font-semibold shrink-0">
                      Exposed in Prompt ⚠
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#27272A] bg-[#141417] flex items-center justify-between">
          <p className="text-[11px] text-[#71717A]">
            Note: Redaction only applies to the generated context prompt. Your local disk files remain unmodified.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#27272A] hover:bg-[#3F3F46] text-[#FAFAFA] rounded-md text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
