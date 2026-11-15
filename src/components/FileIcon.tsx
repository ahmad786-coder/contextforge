import React from 'react';
import { 
  FileCode, 
  FileText, 
  FileJson, 
  Settings, 
  File, 
  Cpu, 
  Palette,
  Terminal,
  Database
} from 'lucide-react';

interface FileIconProps {
  fileName: string;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({ fileName, className = 'w-4 h-4' }) => {
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';

  switch (ext) {
    case 'ts':
    case 'tsx':
      return <FileCode className={`${className} text-[#3B82F6]`} />;
    case 'js':
    case 'jsx':
    case 'mjs':
      return <FileCode className={`${className} text-[#EAB308]`} />;
    case 'json':
      return <FileJson className={`${className} text-[#F97316]`} />;
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return <Palette className={`${className} text-[#06B6D4]`} />;
    case 'html':
      return <FileCode className={`${className} text-[#EF4444]`} />;
    case 'md':
    case 'txt':
    case 'rst':
      return <FileText className={`${className} text-[#A1A1AA]`} />;
    case 'py':
      return <Cpu className={`${className} text-[#10B981]`} />;
    case 'rs':
      return <Cpu className={`${className} text-[#F97316]`} />;
    case 'go':
      return <Cpu className={`${className} text-[#06B6D4]`} />;
    case 'sql':
      return <Database className={`${className} text-[#8B5CF6]`} />;
    case 'sh':
    case 'bash':
    case 'zsh':
      return <Terminal className={`${className} text-[#10B981]`} />;
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'env':
      return <Settings className={`${className} text-[#EC4899]`} />;
    default:
      if (fileName.startsWith('.env')) {
        return <Settings className={`${className} text-[#EAB308]`} />;
      }
      return <File className={`${className} text-[#71717A]`} />;
  }
};
