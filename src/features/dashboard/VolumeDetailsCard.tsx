import React, { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { formatBytes } from "../../utils/formatters";
import { SystemDrive } from "../../types";
import { Card } from "../../components/ui/Card";
import { Skeleton } from "../../components/ui/Skeleton";
import { HardDrive, UploadCloud, FolderOpen, BarChart3, PieChart, Layers } from "lucide-react";
import { Button } from "../../components/ui/Button";

interface VolumeDetailsCardProps {
  systemDrive: SystemDrive;
  isLoading?: boolean;
  onScanPath: (path: string) => void;
  onSelectFolder?: () => void;
}

export const VolumeDetailsCard: React.FC<VolumeDetailsCardProps> = ({
  systemDrive,
  isLoading,
  onScanPath,
  onSelectFolder,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  // Listen to Tauri's global file drag and drop events
  useEffect(() => {
    const pOver = listen("tauri://drag-over", () => {
      setIsDragging(true);
    });
    const pLeave = listen("tauri://drag-leave", () => {
      setIsDragging(false);
    });
    const pDrop = listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
      setIsDragging(false);
      const paths = event.payload.paths;
      if (paths && paths.length > 0) {
        onScanPath(paths[0]);
      }
    });

    return () => {
      pOver.then((unlisten) => unlisten());
      pLeave.then((unlisten) => unlisten());
      pDrop.then((unlisten) => unlisten());
    };
  }, [onScanPath]);

  if (isLoading) {
    return (
      <Card padding="lg" className="flex flex-col md:flex-row items-center gap-8 justify-between bg-slate-900/30 border border-slate-800/40 select-none">
        {/* SVG Circular Ring Skeleton */}
        <div className="w-40 h-40 flex items-center justify-center shrink-0">
          <Skeleton width={130} height={130} rounded="full" />
        </div>
        
        {/* Metadata Skeleton */}
        <div className="flex-1 space-y-4 w-full">
          <div className="space-y-2">
            <Skeleton width={180} height={16} rounded="sm" />
            <Skeleton width={320} height={10} rounded="sm" />
          </div>
          
          <div className="space-y-2">
            <Skeleton height={8} rounded="full" className="w-full" />
            <div className="flex justify-between">
              <Skeleton width={80} height={10} rounded="sm" />
              <Skeleton width={140} height={10} rounded="sm" />
            </div>
          </div>
          
          <div className="flex gap-3">
            <Skeleton width={130} height={28} rounded="md" />
            <Skeleton width={130} height={28} rounded="md" />
          </div>
        </div>
      </Card>
    );
  }

  const total = systemDrive.total_space || 512000000000;
  const available = systemDrive.available_space || 455820000000;
  const used = total > available ? total - available : 0;
  const usedPercent = total > 0 ? (used / total) * 100 : 0;

  const totalStr = formatBytes(total);
  const usedStr = formatBytes(used);
  const availableStr = formatBytes(available);

  return (
    <Card
      variant="default"
      padding="lg"
      className={`bg-surface/30 border p-6 flex flex-col md:flex-row items-center gap-8 justify-between relative overflow-hidden select-none transition-all duration-300 ${
        isDragging 
          ? "border-sky-500 bg-sky-500/5 shadow-[0_0_35px_rgba(14,165,233,0.1)]" 
          : "border-surface-border/40"
      }`}
    >
      {/* Top-Left Glossy Radial Glow */}
      <div className="absolute -left-12 -top-12 w-48 h-48 bg-white/[0.06] rounded-full blur-3xl pointer-events-none" />
      
      {/* Diagonal Shine Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />
      <div className="flex-1 flex flex-col sm:flex-row items-center gap-8 w-full">
        
        {/* Interactive Glowing Circular Target Zone Wrapper with Sparkles & Aura */}
        <div className="relative shrink-0 flex flex-col items-center select-none">
          {/* Interactive Glowing Circular Target Zone */}
          <div 
            onClick={() => onScanPath(systemDrive.mount_point)}
            className={`relative w-40 h-40 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 shrink-0 select-none group/circle z-10 ${
              isDragging 
                ? "bg-sky-500/10 border-sky-400 border scale-[1.03] shadow-[0_0_30px_rgba(14,165,233,0.25)] animate-pulse" 
                : "bg-surface/40 border border-surface-border hover:border-slate-700/80 hover:shadow-[0_0_20px_rgba(255,255,255,0.02)]"
            }`}
          >
            {/* Circular SVG Progress Ring */}
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full transform -rotate-90">
              {/* Background Track */}
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="transparent"
                stroke="rgba(255,255,255,0.02)"
                strokeWidth="5"
              />
              {/* Progress Fill */}
              <circle
                cx="50"
                cy="50"
                r="44"
                fill="transparent"
                stroke="url(#volume-circle-rainbow)"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray="276.4"
                strokeDashoffset={276.4 - (276.4 * (usedPercent / 100))}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="volume-circle-rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00b0ff" />
                  <stop offset="50%" stopColor="#0077ff" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </svg>

            {/* Central content */}
            <div className="flex flex-col items-center justify-center text-center px-4 relative z-10">
              {isDragging ? (
                <>
                  <UploadCloud className="w-8 h-8 text-sky-400 animate-bounce" />
                  <span className="text-[10px] font-bold text-sky-300 uppercase tracking-widest mt-1.5">Drop to Scan</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-5 h-5 text-slate-500 group-hover/circle:text-slate-350 transition-colors" />
                  <span className="text-xl font-bold font-mono text-slate-100 tracking-tight mt-1">{usedPercent.toFixed(0)}%</span>
                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Used</span>
                  <span className="text-[9px] font-bold text-sky-400 mt-1 font-mono">{availableStr} Free</span>
                </>
              )}
            </div>

            {/* Outer ripple during drag */}
            {isDragging && (
              <div className="absolute inset-0 rounded-full animate-ping border border-sky-500/20 pointer-events-none" />
            )}

            {/* Hover instruction layer overlay */}
            {!isDragging && (
              <div className="absolute inset-0 rounded-full bg-slate-950/85 opacity-0 group-hover/circle:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-center p-3">
                <UploadCloud className="w-6 h-6 text-sky-400 mb-1" />
                <span className="text-[9px] font-bold text-slate-200 uppercase tracking-wider">Drag & Drop</span>
                <span className="text-[8px] text-slate-400 mt-0.5 leading-relaxed">any folder or volume to scan</span>
              </div>
            )}
          </div>

          {/* Bottom glowing aura pool */}
          <div className="absolute -bottom-3 w-32 h-6 bg-sky-500/20 blur-xl rounded-full pointer-events-none" />
          
          {/* Sparkling stars around the circle */}
          <div className="absolute w-1 h-1 rounded-full bg-sky-300 animate-pulse top-2 right-4 shadow-[0_0_8px_#38bdf8] z-0" />
          <div className="absolute w-1 h-1 rounded-full bg-purple-400 animate-pulse top-10 left-1 shadow-[0_0_6px_#c084fc] z-0" style={{ animationDelay: '0.6s' }} />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-indigo-300 animate-pulse bottom-8 left-0.5 shadow-[0_0_8px_#818cf8] z-0" style={{ animationDelay: '1.2s' }} />
          <div className="absolute w-1 h-1 rounded-full bg-pink-400 animate-pulse bottom-12 right-1.5 shadow-[0_0_6px_#f472b6] z-0" style={{ animationDelay: '1.8s' }} />
        </div>

        {/* Volume Metadata Statistics List */}
        <div className="flex-1 space-y-4 w-full text-center sm:text-left">
          <div>
            <h3 className="text-base font-bold text-slate-100 tracking-tight flex items-center justify-center sm:justify-start gap-2">
              <span className="text-slate-200">Storage Overview</span>
              <span className="text-slate-400">/</span>
              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-sans tracking-wider">{systemDrive.file_system}</span>
            </h3>
            <p className="text-xs text-slate-450 mt-1">
              Drag and drop any folder or volume onto the circle to analyze storage, or use the shortcuts below.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950/45 p-4 rounded-xl border border-slate-800/40 text-center sm:text-left">
            <div className="flex items-center gap-3 justify-center sm:justify-start md:border-r border-slate-800/60 pr-2">
              <HardDrive className="w-5 h-5 text-slate-500 shrink-0" />
              <div>
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total capacity</span>
                <span className="text-xs font-bold text-slate-200 font-mono mt-0.5 block">{totalStr}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center sm:justify-start md:border-r border-slate-800/60 md:pl-2 pr-2">
              <BarChart3 className="w-5 h-5 text-slate-500 shrink-0" />
              <div>
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Used space</span>
                <span className="text-xs font-bold text-slate-200 font-mono mt-0.5 block">{usedStr}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center sm:justify-start md:border-r border-slate-800/60 md:pl-2 pr-2">
              <PieChart className="w-5 h-5 text-slate-500 shrink-0" />
              <div>
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">Available free</span>
                <span className="text-xs font-bold text-sky-400 font-mono mt-0.5 block">{availableStr}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-center sm:justify-start md:pl-2">
              <Layers className="w-5 h-5 text-slate-500 shrink-0" />
              <div>
                <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">File system</span>
                <span className="text-xs font-bold text-slate-200 font-mono mt-0.5 block">{systemDrive.file_system.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Trigger Scan Detailed Map Action */}
          <div className="flex flex-wrap items-center gap-3 justify-center sm:justify-start">
            <Button
              variant="primary"
              size="sm"
              onClick={() => onScanPath(systemDrive.mount_point)}
              leftIcon={<HardDrive className="w-3.5 h-3.5" />}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-none font-bold text-xs rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.35),0_4px_12px_rgba(37,99,235,0.2)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5),0_4px_15px_rgba(37,99,235,0.3)] transition-all hover:scale-102 active:scale-98"
            >
              Scan Primary Disk
            </Button>
            {onSelectFolder && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onSelectFolder}
                leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
                className="border-slate-800 hover:border-slate-700 bg-slate-900/60 hover:bg-slate-900 text-slate-300 font-bold text-xs rounded-xl shadow-md transition-all hover:scale-105 active:scale-95"
              >
                Select Folder
              </Button>
            )}
          </div>
        </div>

      </div>
    </Card>
  );
};
