import React from "react";
import { formatBytes } from "../../utils/formatters";
import { LargeFile } from "../../types";
import { Card } from "../../components/ui/Card";

import { invoke } from "@tauri-apps/api/core";
import { Skeleton } from "../../components/ui/Skeleton";

interface LargestFilesCardProps {
  largeFiles: LargeFile[];
  isLoading?: boolean;
}

export const LargestFilesCard: React.FC<LargestFilesCardProps> = ({ largeFiles, isLoading }) => {
  const handleRevealFile = async (path: string) => {
    try {
      await invoke("reveal_target_item", { targetPath: path });
    } catch (err) {
      console.error("Failed to reveal file:", err);
    }
  };

  if (isLoading) {
    return (
      <Card variant='default' padding='none' className='p-3.5 space-y-3 flex flex-col flex-1'>
        <div>
          <Skeleton width={120} height={12} rounded='sm' />
        </div>
        <div className='space-y-2'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className='flex items-center justify-between text-[10px] bg-slate-950/20 px-2.5 py-2 rounded-xl border border-surface-border/20 gap-3'
            >
              <div className='min-w-0 flex-1 flex items-center gap-2'>
                <Skeleton width={12} height={12} rounded='sm' className='shrink-0' />
                <div className='min-w-0 flex-1 space-y-1.5'>
                  <Skeleton width={120} height={10} rounded='sm' />
                  <Skeleton width={80} height={8} rounded='sm' />
                </div>
              </div>
              <Skeleton width={40} height={10} rounded='sm' />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card variant='default' padding='none' className='p-3.5 space-y-3 flex flex-col flex-1'>
      <div>
        <h3 className='text-xs font-extrabold uppercase tracking-wider text-slate-400'>Largest Files</h3>
      </div>

      <div className='space-y-2'>
        {largeFiles.length === 0 ? (
          <div className='text-[10px] text-slate-500 text-center py-12 font-semibold'>No large files found</div>
        ) : (
          largeFiles.slice(0, 5).map((file, idx) => (
            <div
              key={idx}
              onClick={() => handleRevealFile(file.path)}
              className='group flex items-center justify-between text-[10px] bg-slate-950/20 hover:bg-surface/50 px-2.5 py-2 rounded-xl border border-surface-border/20 hover:border-surface-border/60 transition-all duration-200 gap-3 cursor-pointer'
            >
              <div className='min-w-0 flex-1 flex items-center gap-2'>
                <span className='text-[9px] font-bold text-slate-500 group-hover:text-purple-400 transition-colors shrink-0'>
                  0{idx + 1}
                </span>
                <div className='min-w-0 flex-1'>
                  <div className='font-bold text-slate-200 group-hover:text-white truncate' title={file.name}>
                    {file.name}
                  </div>
                  <div className='font-mono text-slate-500 text-[8px] truncate mt-0.5' title={file.path}>
                    {file.path}
                  </div>
                </div>
              </div>
              <span className='font-mono font-bold text-slate-200 px-1.5 py-0.5 rounded text-[10px] shrink-0'>
                {formatBytes(file.size)}
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
