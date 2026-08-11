import React from "react";
import { formatBytes } from "../../utils/formatters";
import { SystemDrive } from "../../types";
import { Card } from "../../components/ui/Card";

import { Skeleton } from "../../components/ui/Skeleton";

interface VolumeDetailsCardProps {
  systemDrive: SystemDrive;
  isLoading?: boolean;
  onScanPath: (path: string) => void;
}

export const VolumeDetailsCard: React.FC<VolumeDetailsCardProps> = ({
  systemDrive,
  isLoading,
  onScanPath,
}) => {
  if (isLoading) {
    return (
      <Card padding="lg" className="flex flex-col md:flex-row items-center gap-8 justify-between bg-slate-900/30 border border-slate-800/40 select-none">
        {/* SVG Circular Ring Skeleton */}
        <div className="w-32 h-32 flex items-center justify-center shrink-0">
          <Skeleton width={110} height={110} rounded="full" />
        </div>
        
        {/* Metadata Skeleton */}
        <div className="flex-1 space-y-4 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-2">
              <Skeleton width={180} height={16} rounded="sm" />
              <Skeleton width={110} height={10} rounded="sm" />
            </div>
            <Skeleton width={120} height={18} rounded="full" />
          </div>
          
          {/* Progress bar and text */}
          <div className="space-y-2">
            <Skeleton height={8} rounded="full" className="w-full" />
            <div className="flex justify-between">
              <Skeleton width={80} height={10} rounded="sm" />
              <Skeleton width={140} height={10} rounded="sm" />
            </div>
          </div>
          
          <Skeleton width={110} height={28} rounded="md" />
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
      className="bg-slate-900/30 border border-slate-800/40 p-6 flex flex-col md:flex-row items-center gap-8 justify-between relative overflow-hidden select-none"
    >
      {/* Top-Left Glossy Radial Glow */}
      <div className="absolute -left-12 -top-12 w-48 h-48 bg-white/[0.06] rounded-full blur-3xl pointer-events-none" />
      
      {/* Diagonal Shine Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />
      <div className="flex-1 flex flex-col sm:flex-row items-center gap-8 w-full">
        
        {/* Semicircular Gauge Widget */}
        <div className="relative w-full max-w-[210px] flex flex-col items-center shrink-0">
          <svg viewBox="0 0 100 55" className="w-full">
            {/* Background Track */}
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="9"
              strokeLinecap="round"
            />
            {/* Semicircle Used Progress */}
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="url(#volume-arc-rainbow)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray="125.6"
              strokeDashoffset={125.6 - (125.6 * (usedPercent / 100))}
              className="transition-all duration-1000 ease-out"
            />
            <defs>
              <linearGradient id="volume-arc-rainbow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00b0ff" />
                <stop offset="70%" stopColor="#0077ff" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
          


          {/* Semicircle End Cap Indicators */}
          <div className="w-full flex justify-between px-2 text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-wider">
            <span>Free</span>
            <span>Used</span>
          </div>
        </div>

        {/* Volume Metadata Statistics List */}
        <div className="flex-1 space-y-3.5 w-full text-center sm:text-left">
          <div>
            <h3 className="text-sm font-bold text-slate-100 tracking-tight">
              Volume Detail: {systemDrive.mount_point} ({systemDrive.file_system})
            </h3>
          </div>

          <div className="space-y-1.5 text-xs text-slate-350">
            <div className="flex items-center gap-1 justify-center sm:justify-start">
              <span className="font-semibold text-slate-400">Total Capacity:</span>
              <span className="font-bold text-slate-200 font-mono">{totalStr}</span>
            </div>
            <div className="flex items-center gap-1 justify-center sm:justify-start">
              <span className="font-semibold text-slate-400">Used:</span>
              <span className="font-bold text-slate-200 font-mono">{usedStr}</span>
            </div>
            <div className="flex items-center gap-1 justify-center sm:justify-start">
              <span className="font-semibold text-slate-400">Available:</span>
              <span className="font-bold text-sky-400 font-mono">{availableStr}</span>
            </div>
          </div>

          {/* Trigger Scan Detailed Map Action */}
          <div className="pt-1 flex justify-center sm:justify-start">
            <button
              onClick={() => onScanPath(systemDrive.mount_point)}
              className="flex items-center gap-2 font-bold text-[10px] h-7 px-3.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="9" rx="1.5" />
                <rect x="14" y="3" width="7" height="5" rx="1.5" />
                <rect x="14" y="12" width="7" height="9" rx="1.5" />
                <rect x="3" y="16" width="7" height="5" rx="1.5" />
              </svg>
              Detailed Map
            </button>
          </div>
        </div>

      </div>
    </Card>
  );
};
