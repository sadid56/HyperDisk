import React from "react";
import { formatBytes } from "../../utils/formatters";
import { UserFolder } from "../../types";
import { Card } from "../../components/ui/Card";

import { Skeleton } from "../../components/ui/Skeleton";

interface TopFoldersCardProps {
  topFolders: UserFolder[];
  isLoading?: boolean;
  onScanPath: (path: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const TopFoldersCard: React.FC<TopFoldersCardProps> = ({
  topFolders,
  isLoading,
  onScanPath,
  onNavigateTab,
}) => {
  if (isLoading || topFolders.length < 6) {
    return (
      <Card variant="default" padding="md" className="space-y-4">
        <div className="flex items-center justify-between border-b border-surface-border/40 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Top Folders</h3>
          <button
            onClick={() => onNavigateTab("folders")}
            className="text-[10px] font-extrabold text-slate-450 hover:text-white hover:underline transition-colors cursor-pointer"
          >
            View all
          </button>
        </div>
        <div className="grid grid-cols-12 gap-3 h-[220px]">
          {/* Left Column Skeleton */}
          <div className="col-span-4 rounded-2xl bg-slate-900/30 border border-slate-800/40 p-4 flex flex-col justify-center items-center gap-2">
            <Skeleton width={50} height={16} rounded="sm" />
            <Skeleton width={60} height={12} rounded="sm" />
          </div>
          {/* Right Section Skeleton (col-span-8) */}
          <div className="col-span-8 flex flex-col gap-3 h-full">
            {/* Top Row */}
            <div className="h-[60%] flex gap-3">
              <div className="w-1/2 h-full rounded-2xl bg-slate-900/30 border border-slate-800/40 p-4 flex flex-col justify-center items-center gap-2">
                <Skeleton width={60} height={16} rounded="sm" />
                <Skeleton width={50} height={12} rounded="sm" />
              </div>
              <div className="w-1/2 h-full rounded-2xl bg-slate-900/30 border border-slate-800/40 p-4 flex flex-col justify-center items-center gap-2">
                <Skeleton width={60} height={16} rounded="sm" />
                <Skeleton width={50} height={12} rounded="sm" />
              </div>
            </div>
            {/* Bottom Row */}
            <div className="h-[40%] flex gap-3">
              <div className="w-1/3 h-full rounded-2xl bg-slate-900/20 border border-slate-800/20 p-2 flex flex-col justify-center items-center gap-1.5">
                <Skeleton width={40} height={12} rounded="sm" />
                <Skeleton width={50} height={10} rounded="sm" />
              </div>
              <div className="w-1/3 h-full rounded-2xl bg-slate-900/20 border border-slate-800/20 p-2 flex flex-col justify-center items-center gap-1.5">
                <Skeleton width={40} height={12} rounded="sm" />
                <Skeleton width={50} height={10} rounded="sm" />
              </div>
              <div className="w-1/3 h-full rounded-2xl bg-slate-900/20 border border-slate-800/20 p-2 flex flex-col justify-center items-center gap-1.5">
                <Skeleton width={60} height={12} rounded="sm" />
                <Skeleton width={40} height={10} rounded="sm" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const f0 = topFolders[0];
  const f1 = topFolders[1];
  const f2 = topFolders[2];
  const f3 = topFolders[3];
  const f4 = topFolders[4];
  const f5 = topFolders[5];

  return (
    <Card variant="default" padding="md" className="space-y-4">
      <div className="flex items-center justify-between border-b border-surface-border/40 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Top Folders</h3>
        <button
          onClick={() => onNavigateTab("folders")}
          className="text-[10px] font-extrabold text-slate-455 hover:text-white hover:underline transition-colors cursor-pointer"
        >
          View all
        </button>
      </div>

      <div className="grid grid-cols-12 gap-3 h-[220px]">
        {/* Left Column: Folder 0 */}
        <div
          onClick={() => onScanPath(f0.path)}
          className="col-span-4 rounded-2xl bg-[#4c1d95]/30 hover:bg-[#4c1d95]/40 border border-[#7c3aed]/20 hover:border-[#7c3aed]/40 p-4 flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-200 hover:scale-[1.01] select-none"
        >
          <span className="text-xs font-bold text-slate-100 truncate w-full" title={f0.name}>{f0.name}</span>
          <span className="text-[10px] text-slate-400 font-mono mt-1 font-semibold">{formatBytes(f0.size || 0)}</span>
        </div>

        {/* Right Section: Folders 1-5 */}
        <div className="col-span-8 flex flex-col gap-3 h-full">
          {/* Top Row: Folder 1 & 2 */}
          <div className="h-[60%] flex gap-3">
            <div
              onClick={() => onScanPath(f1.path)}
              className="w-1/2 h-full rounded-2xl bg-[#1e3a8a]/30 border border-[#2563eb]/20 hover:border-[#2563eb]/40 p-4 flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-200 hover:scale-[1.01] relative group select-none"
            >
              <span className="text-xs font-bold text-slate-100 truncate w-full" title={f1.name}>{f1.name}</span>
              <span className="text-[10px] text-slate-400 font-mono mt-1 font-semibold">{formatBytes(f1.size || 0)}</span>
            </div>
            <div
              onClick={() => onScanPath(f2.path)}
              className="w-1/2 h-full rounded-2xl bg-[#581c87]/20 hover:bg-[#581c87]/30 border border-[#a855f7]/15 hover:border-[#a855f7]/35 p-4 flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-200 hover:scale-[1.01] select-none"
            >
              <span className="text-xs font-bold text-slate-100 truncate w-full" title={f2.name}>{f2.name}</span>
              <span className="text-[10px] text-slate-400 font-mono mt-1 font-semibold">{formatBytes(f2.size || 0)}</span>
            </div>
          </div>
          
          {/* Bottom Row: Folder 3, 4, 5 */}
          <div className="h-[40%] flex gap-3">
            <div
              onClick={() => onScanPath(f3.path)}
              className="w-1/3 h-full rounded-2xl bg-[#1e293b]/50 border border-slate-800 hover:border-slate-700 p-2 flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-200 hover:scale-[1.01] select-none"
            >
              <span className="text-[10px] font-bold text-slate-200 truncate max-w-full" title={f3.name}>{f3.name}</span>
              <span className="text-[8px] text-slate-500 font-mono mt-0.5">{formatBytes(f3.size || 0)}</span>
            </div>
            <div
              onClick={() => onScanPath(f4.path)}
              className="w-1/3 h-full rounded-2xl bg-[#0f172a]/50 border border-slate-800/80 hover:border-slate-700 p-2 flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-200 hover:scale-[1.01] select-none"
            >
              <span className="text-[10px] font-bold text-slate-200 truncate max-w-full" title={f4.name}>{f4.name}</span>
              <span className="text-[8px] text-slate-500 font-mono mt-0.5">{formatBytes(f4.size || 0)}</span>
            </div>
            <div
              onClick={() => onScanPath(f5.path)}
              className="w-1/3 h-full rounded-2xl bg-[#1e293b]/40 border border-slate-800 hover:border-slate-700 p-2 flex flex-col justify-center items-center text-center cursor-pointer transition-all duration-200 hover:scale-[1.01] select-none"
            >
              <span className="text-[10px] font-bold text-slate-200 truncate max-w-full" title={f5.name}>{f5.name}</span>
              <span className="text-[8px] text-slate-500 font-mono mt-0.5">{formatBytes(f5.size || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
