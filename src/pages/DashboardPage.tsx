import React, { useMemo } from "react";
import { formatBytes } from "../utils/formatters";
import { SystemDrive, UserFolder, LargeFile, CleanupSuggestion } from "../types";
import { VolumeDetailsCard } from "../features/dashboard/VolumeDetailsCard";
import { TopFoldersCard } from "../features/dashboard/TopFoldersCard";
import { LargestFilesCard } from "../features/dashboard/LargestFilesCard";
import { CleanupInsightsCard } from "../features/dashboard/CleanupInsightsCard";

interface DashboardPageProps {
  drives: SystemDrive[];
  folders: UserFolder[];
  systemRootFolders: UserFolder[];
  largeFiles: LargeFile[];
  cleanupSuggestions: CleanupSuggestion[];
  drivesLoading?: boolean;
  foldersLoading?: boolean;
  largeFilesLoading?: boolean;
  cleanupLoading?: boolean;
  onScanPath: (path: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = React.memo(
  ({
    drives,
    folders,
    systemRootFolders,
    largeFiles,
    cleanupSuggestions,
    drivesLoading,
    foldersLoading,
    largeFilesLoading,
    cleanupLoading,
    onScanPath,
    onNavigateTab,
  }) => {
    // Find active system partition
    const systemDrive = useMemo(() => {
      return drives.find((d) => d.mount_point === "/" || d.mount_point.toLowerCase().startsWith("c:")) || drives[0];
    }, [drives]);

    // Calculate dynamic cleanup suggestion sizes
    const { junkSizeStr, tempSizeStr } = useMemo(() => {
      let junk = 0;
      let temp = 0;
      cleanupSuggestions.forEach((item) => {
        if (["system_logs", "package_caches", "dev_caches", "thumbnail_caches"].includes(item.id)) {
          junk += item.size;
        } else if (["caches", "crash_reports"].includes(item.id)) {
          temp += item.size;
        }
      });

      return {
        junkSizeStr: formatBytes(junk),
        tempSizeStr: formatBytes(temp),
      };
    }, [cleanupSuggestions]);

    // Folder treemap layout: select top 6 largest items
    const topFolders = useMemo(() => {
      return [...systemRootFolders, ...folders]
        .filter((f) => f.exists && f.size !== undefined && f.size > 0)
        .filter((folder, idx, self) => self.findIndex((t) => t.path === folder.path) === idx)
        .sort((a, b) => (b.size || 0) - (a.size || 0))
        .slice(0, 6);
    }, [systemRootFolders, folders]);

    return (
      <div className='flex-1 overflow-y-auto p-6 space-y-6 select-none scrollbar-none animate-in fade-in duration-300'>
        {/* 2-Column Dashboard Grid */}
        <div className='grid grid-cols-12 gap-6'>
          {/* Left Column: Volume Card & Top Folders Treemap */}
          <div className='col-span-12 lg:col-span-8 space-y-6'>
            {/* Card 1: Volume Details */}
            {systemDrive && <VolumeDetailsCard systemDrive={systemDrive} isLoading={drivesLoading} onScanPath={onScanPath} />}

            {/* Card 2: Top Folders Treemap */}
            <TopFoldersCard topFolders={topFolders} isLoading={foldersLoading} onScanPath={onScanPath} onNavigateTab={onNavigateTab} />
          </div>

          {/* Right Column: Largest Files list & Cleanup Recommendation Insights */}
          <div className='col-span-12 lg:col-span-4 flex flex-col gap-6'>
            {/* Card 3: Largest Files */}
            <LargestFilesCard largeFiles={largeFiles} isLoading={largeFilesLoading} />

            {/* Card 4: Cleanup & Insights */}
            <CleanupInsightsCard
              junkSizeStr={junkSizeStr}
              tempSizeStr={tempSizeStr}
              isLoading={cleanupLoading}
              onNavigateTab={onNavigateTab}
            />
          </div>
        </div>
      </div>
    );
  },
);

DashboardPage.displayName = "DashboardPage";
