import React, { useMemo } from "react";
import { formatBytes } from "../utils/formatters";
import { SystemDrive, UserFolder } from "../types";
import { VolumeDetailsCard } from "../features/dashboard/VolumeDetailsCard";
import { TargetSelectorCard } from "../features/dashboard/TargetSelectorCard";

interface DashboardPageProps {
  drives: SystemDrive[];
  drivesLoading?: boolean;
  folders: UserFolder[];
  onScanPath: (path: string) => void;
  onNavigateTab: (tab: string) => void;
  onSelectFolder?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = React.memo(
  ({
    drives,
    drivesLoading,
    folders,
    onScanPath,
    onNavigateTab,
    onSelectFolder,
  }) => {
    // Find active system partition
    const systemDrive = useMemo(() => {
      return drives.find((d) => d.mount_point === "/" || d.mount_point.toLowerCase().startsWith("c:")) || drives[0];
    }, [drives]);

    return (
      <div className='flex-1 overflow-y-auto p-6 select-none scrollbar-none animate-in fade-in duration-300'>
        <div className='max-w-4xl mx-auto space-y-6'>
          {/* Card 1: Volume Details */}
          {systemDrive && (
            <VolumeDetailsCard 
              systemDrive={systemDrive} 
              isLoading={drivesLoading} 
              onScanPath={onScanPath} 
              onSelectFolder={onSelectFolder}
            />
          )}

          {/* Card 2: Target Selector (Option 1) */}
          <TargetSelectorCard 
            onScanPath={onScanPath} 
            onSelectFolder={onSelectFolder} 
            onNavigateTab={onNavigateTab}
            systemDrivePath={systemDrive?.mount_point}
            systemDriveFreeSpace={systemDrive ? formatBytes(systemDrive.available_space) : undefined}
            systemDriveTotalSpace={systemDrive ? formatBytes(systemDrive.total_space) : undefined}
            systemDriveUsedSpace={systemDrive ? formatBytes(systemDrive.total_space - systemDrive.available_space) : undefined}
            systemDriveTotalBytes={systemDrive?.total_space}
            systemDriveAvailableBytes={systemDrive?.available_space}
            folders={folders}
          />
        </div>
      </div>
    );
  },
);

DashboardPage.displayName = "DashboardPage";
