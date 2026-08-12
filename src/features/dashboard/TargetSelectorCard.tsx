import React from "react";
import { HardDrive, FolderOpen, Trash2, FileSearch, ArrowRight, MoreVertical, RotateCw, ArrowDown, Layers } from "lucide-react";
import { useScanHistory } from "../../hooks/useScanHistory";
import CardDisk from "../../assets/card_disk.png";
import CardHome from "../../assets/card_home.png";
import CardTrash from "../../assets/card_trash.png";
import CardLarge from "../../assets/card_large.png";
import { formatBytes } from "../../utils/formatters";
import { UserFolder } from "../../types";

interface TargetSelectorCardProps {
  onScanPath: (path: string) => void;
  onSelectFolder?: () => void;
  onNavigateTab: (tab: string) => void;
  systemDrivePath?: string;
  systemDriveFreeSpace?: string;
  systemDriveTotalSpace?: string;
  systemDriveUsedSpace?: string;
  systemDriveTotalBytes?: number;
  systemDriveAvailableBytes?: number;
  folders?: UserFolder[];
}

const formatScanTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  // Yesterday logic helper
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (isToday) {
    return `Today, ${timeStr}`;
  } else if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  } else {
    return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${timeStr}`;
  }
};

export const TargetSelectorCard: React.FC<TargetSelectorCardProps> = React.memo(
  ({
    onScanPath,
    onSelectFolder: _onSelectFolder,
    onNavigateTab,
    systemDrivePath = "/",
    systemDriveFreeSpace: _systemDriveFreeSpace = "Calculating...",
    systemDriveTotalSpace: _systemDriveTotalSpace,
    systemDriveUsedSpace,
    systemDriveTotalBytes,
    systemDriveAvailableBytes,
    folders = [],
  }) => {
    const { recentScans, clearHistory: _clearHistory } = useScanHistory();

    const totalBytes = systemDriveTotalBytes || 250000000000;
    const availableBytes = systemDriveAvailableBytes || 100000000000;
    const usedBytes = Math.max(0, totalBytes - availableBytes);

    const appFolder = folders.find(f => f.name.toLowerCase() === "applications" || f.name.toLowerCase() === "apps");
    const docFolder = folders.find(f => f.name.toLowerCase() === "documents" || f.name.toLowerCase() === "docs");
    const mediaFolders = folders.filter(f => 
      ["pictures", "movies", "music", "audio", "video", "photos", "downloads"].includes(f.name.toLowerCase())
    );
    const mediaBytes = mediaFolders.reduce((sum, f) => sum + (f.size || 0), 0);

    const appsBytes = appFolder?.size || (usedBytes * 0.32);
    const docsBytes = docFolder?.size || (usedBytes * 0.22);
    const resolvedMediaBytes = mediaBytes || (usedBytes * 0.19);
    const systemBytes = (usedBytes * 0.15);
    const otherBytes = (usedBytes * 0.12);

    const appsSizeStr = formatBytes(appsBytes);
    const docsSizeStr = formatBytes(docsBytes);
    const mediaSizeStr = formatBytes(resolvedMediaBytes);
    const systemSizeStr = formatBytes(systemBytes);
    const otherSizeStr = formatBytes(otherBytes);

    const resolvedDownloadsPath = folders.find(f => f.name.toLowerCase() === "downloads")?.path || 
      (systemDrivePath.endsWith("/") ? `${systemDrivePath}Users/sadid/Downloads` : `${systemDrivePath}/Users/sadid/Downloads`);
    
    const resolvedAppsPath = folders.find(f => f.name.toLowerCase() === "applications" || f.name.toLowerCase() === "apps")?.path || 
      (systemDrivePath.endsWith("/") ? `${systemDrivePath}Applications` : `${systemDrivePath}/Applications`);

    const displayScans =
      recentScans.length > 0
        ? recentScans
        : [
            { path: systemDrivePath, timestamp: Date.now() },
            {
              path: resolvedDownloadsPath,
              timestamp: Date.now() - 86400000,
            },
            {
              path: resolvedAppsPath,
              timestamp: Date.now() - 86400000 * 3,
            },
          ];

    return (
      <div className='space-y-6'>
        {/* Preset Actions Grid */}
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
          {/* Presets 1: Scan Primary Disk */}
          <div
            onClick={() => onScanPath(systemDrivePath)}
            className='group p-5 bg-[#12121a]/30 border border-slate-800/40 hover:border-slate-700/60 rounded-2xl flex flex-col justify-between min-h-[160px] relative overflow-hidden transition-all hover:scale-[1.01] hover:bg-slate-900/10 cursor-pointer'
          >
            {/* 3D Platter Background Image */}
            <img 
              src={CardDisk} 
              className="absolute -right-4 top-1/2 -translate-y-1/2 w-32 h-32 opacity-[0.24] pointer-events-none z-0 transition-transform duration-500 group-hover:scale-[1.06] object-contain" 
              alt="3D Hard Drive"
            />

            <div className='space-y-4 relative z-10'>
              <div className='p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 w-fit'>
                <HardDrive className='w-5 h-5' />
              </div>
              <div>
                <h4 className='text-xs font-bold text-slate-200'>Scan Primary Disk</h4>
                <p className='text-[10px] text-slate-500 mt-1 leading-relaxed'>Deep scan your entire disk for a detailed analysis.</p>
              </div>
            </div>
            <div className='absolute bottom-4 right-4 w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all z-10'>
              <ArrowRight className='w-3 h-3' />
            </div>
          </div>

          {/* Presets 2: Scan Home Folder */}
          <div
            onClick={() => onScanPath("~")}
            className='group p-5 bg-[#12121a]/30 border border-slate-800/40 hover:border-slate-700/60 rounded-2xl flex flex-col justify-between min-h-[160px] relative overflow-hidden transition-all hover:scale-[1.01] hover:bg-slate-900/10 cursor-pointer'
          >
            {/* 3D House Background Image */}
            <img 
              src={CardHome} 
              className="absolute -right-4 top-1/2 -translate-y-1/2 w-32 h-32 opacity-[0.24] pointer-events-none z-0 transition-transform duration-500 group-hover:scale-[1.06] object-contain" 
              alt="3D Home"
            />

            <div className='space-y-4 relative z-10'>
              <div className='p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 w-fit'>
                <FolderOpen className='w-5 h-5' />
              </div>
              <div>
                <h4 className='text-xs font-bold text-slate-200'>Scan Home Folder</h4>
                <p className='text-[10px] text-slate-500 mt-1 leading-relaxed'>Analyze your user home directory and find clutter.</p>
              </div>
            </div>
            <div className='absolute bottom-4 right-4 w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-405 group-hover:bg-purple-600 group-hover:text-white transition-all z-10'>
              <ArrowRight className='w-3 h-3' />
            </div>
          </div>

          {/* Presets 3: Analyze Junk Files */}
          <div
            onClick={() => onNavigateTab("cleanup")}
            className='group p-5 bg-[#12121a]/30 border border-slate-800/40 hover:border-slate-700/60 rounded-2xl flex flex-col justify-between min-h-[160px] relative overflow-hidden transition-all hover:scale-[1.01] hover:bg-slate-900/10 cursor-pointer'
          >
            {/* 3D Trash Background Image */}
            <img 
              src={CardTrash} 
              className="absolute -right-4 top-1/2 -translate-y-1/2 w-32 h-32 opacity-[0.24] pointer-events-none z-0 transition-transform duration-500 group-hover:scale-[1.06] object-contain" 
              alt="3D Trash"
            />

            <div className='space-y-4 relative z-10'>
              <div className='p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 w-fit'>
                <Trash2 className='w-5 h-5' />
              </div>
              <div>
                <h4 className='text-xs font-bold text-slate-200'>Analyze Junk Files</h4>
                <p className='text-[10px] text-slate-500 mt-1 leading-relaxed'>Clean caches, logs and unnecessary system files.</p>
              </div>
            </div>
            <div className='absolute bottom-4 right-4 w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all z-10'>
              <ArrowRight className='w-3 h-3' />
            </div>
          </div>

          {/* Presets 4: Find Large Files */}
          <div
            onClick={() => onNavigateTab("large-files")}
            className='group p-5 bg-[#12121a]/30 border border-slate-800/40 hover:border-slate-700/60 rounded-2xl flex flex-col justify-between min-h-[160px] relative overflow-hidden transition-all hover:scale-[1.01] hover:bg-slate-900/10 cursor-pointer'
          >
            {/* 3D Large Files Background Image */}
            <img 
              src={CardLarge} 
              className="absolute -right-4 top-1/2 -translate-y-1/2 w-32 h-32 opacity-[0.24] pointer-events-none z-0 transition-transform duration-500 group-hover:scale-[1.06] object-contain" 
              alt="3D Large Files"
            />

            <div className='space-y-4 relative z-10'>
              <div className='p-3 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 w-fit'>
                <FileSearch className='w-5 h-5' />
              </div>
              <div>
                <h4 className='text-xs font-bold text-slate-200'>Find Large Files</h4>
                <p className='text-[10px] text-slate-500 mt-1 leading-relaxed'>Locate space-hogging files and media.</p>
              </div>
            </div>
            <div className='absolute bottom-4 right-4 w-6 h-6 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 group-hover:bg-pink-600 group-hover:text-white transition-all z-10'>
              <ArrowRight className='w-3 h-3' />
            </div>
          </div>
        </div>

        {/* Bottom Grid: Recent Scans on Left, Storage Breakdown on Right */}
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {/* Recent Scans Section */}
          <div className='bg-[#12121a]/30 border border-slate-800/40 rounded-2xl p-5 space-y-4'>
            <div className='flex items-center justify-between'>
              <h4 className='text-[10px] font-bold text-slate-400 uppercase tracking-wider'>Recent Scans</h4>
              <span className='text-[10px] text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer'>View All</span>
            </div>

            <div className='space-y-3'>
              {displayScans.map((item, idx) => {
                const path = item.path;
                const isSystem = path === "/" || path === systemDrivePath || path.toLowerCase().startsWith("c:");
                const isDownloads = path.toLowerCase().includes("downloads");
                const isApps = path.toLowerCase().includes("applications");

                let displayName = "Macintosh HD";
                let displaySubtitle = "/Volumes/Macintosh HD";
                let sizeStr = systemDriveUsedSpace || "149.85 GB";
                let IconComponent: any = HardDrive;
                let iconBg = "bg-[#16161e] text-slate-300 border border-slate-700/50 rounded-xl";

                if (isDownloads) {
                  displayName = "Downloads";
                  displaySubtitle = "/Users/username/Downloads";
                  sizeStr = "32.48 GB";
                  IconComponent = ArrowDown;
                  iconBg = "bg-blue-600 text-white rounded-full shadow-[0_2px_8px_rgba(37,99,235,0.4)]";
                } else if (isApps) {
                  displayName = "Applications";
                  displaySubtitle = "/Applications";
                  sizeStr = "18.76 GB";
                  IconComponent = Layers;
                  iconBg = "bg-blue-500 text-white rounded-xl shadow-[0_2px_8px_rgba(59,130,246,0.3)]";
                } else if (!isSystem) {
                  displayName = path.split("/").pop() || path;
                  displaySubtitle = path;
                  sizeStr = "Folder Scan";
                  iconBg = "bg-slate-900 text-slate-400 border border-slate-800 rounded-lg";
                }

                const timeStr = formatScanTime(item.timestamp);

                return (
                  <div
                    key={idx}
                    onClick={() => onScanPath(path)}
                    className='group flex items-center justify-between gap-4 p-3 bg-slate-950/20 border border-slate-900 hover:border-slate-800 hover:bg-slate-950/40 rounded-xl cursor-pointer transition-all'
                  >
                    <div className='flex items-center gap-3 min-w-0'>
                      <div className={`p-1.5 shrink-0 flex items-center justify-center ${iconBg}`}>
                        <IconComponent className='w-4 h-4' />
                      </div>
                      <div className='min-w-0'>
                        <span className='text-xs font-bold text-slate-200 truncate group-hover:text-white block' title={path}>
                          {displayName}
                        </span>
                        <span className='text-[10px] text-slate-500 font-mono block mt-0.5 truncate max-w-[140px]' title={path}>
                          {displaySubtitle}
                        </span>
                      </div>
                    </div>

                    <div className='flex items-center gap-4 shrink-0'>
                      <span className='text-[10px] text-slate-400 font-mono font-bold'>{sizeStr}</span>
                      <span className='text-[10px] text-slate-500 hidden md:inline'>{timeStr}</span>
                      <div className='flex items-center gap-1.5 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-1.5 py-0.2 rounded-full shrink-0'>
                        <span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />
                        Completed
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // open options or clear history
                        }}
                        className='p-1 hover:bg-slate-850 rounded text-slate-500 hover:text-slate-200 transition-colors'
                      >
                        <MoreVertical className='w-3.5 h-3.5' />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Storage Breakdown Card */}
          <div className='bg-[#12121a]/30 border border-slate-800/40 rounded-2xl p-5 flex flex-col justify-between space-y-4'>
            <div className='flex items-center justify-between'>
              <h4 className='text-[10px] font-bold text-slate-400 uppercase tracking-wider'>Storage Breakdown</h4>
              <span className='text-[10px] text-slate-500 hover:text-indigo-400 transition-colors cursor-pointer'>View Details</span>
            </div>

            <div className='flex flex-col sm:flex-row items-center gap-6 py-2'>
              {/* Donut Chart */}
              <div className='relative w-32 h-32 flex items-center justify-center shrink-0'>
                <svg viewBox='0 0 100 100' className='w-full h-full transform -rotate-90'>
                  {/* Apps: 32% (blue) */}
                  <circle
                    cx='50'
                    cy='50'
                    r='38'
                    fill='transparent'
                    stroke='#3b82f6'
                    strokeWidth='10'
                    strokeDasharray='76.4 238.7'
                    strokeDashoffset='0'
                    strokeLinecap='round'
                  />
                  {/* Documents: 22% (purple) */}
                  <circle
                    cx='50'
                    cy='50'
                    r='38'
                    fill='transparent'
                    stroke='#8b5cf6'
                    strokeWidth='10'
                    strokeDasharray='52.5 238.7'
                    strokeDashoffset='-76.4'
                    strokeLinecap='round'
                  />
                  {/* Media: 19% (emerald) */}
                  <circle
                    cx='50'
                    cy='50'
                    r='38'
                    fill='transparent'
                    stroke='#10b981'
                    strokeWidth='10'
                    strokeDasharray='45.3 238.7'
                    strokeDashoffset='-128.9'
                    strokeLinecap='round'
                  />
                  {/* System: 15% (amber) */}
                  <circle
                    cx='50'
                    cy='50'
                    r='38'
                    fill='transparent'
                    stroke='#f59e0b'
                    strokeWidth='10'
                    strokeDasharray='35.8 238.7'
                    strokeDashoffset='-174.2'
                    strokeLinecap='round'
                  />
                  {/* Other: 12% (orange) */}
                  <circle
                    cx='50'
                    cy='50'
                    r='38'
                    fill='transparent'
                    stroke='#f97316'
                    strokeWidth='10'
                    strokeDasharray='28.6 238.7'
                    strokeDashoffset='-210'
                    strokeLinecap='round'
                  />
                </svg>
                <div className='absolute flex flex-col items-center justify-center text-center'>
                  <span className='text-[13px] font-bold text-slate-100 font-mono tracking-tight'>
                    {systemDriveUsedSpace || "149.85 GB"}
                  </span>
                  <span className='text-[8px] text-slate-500 uppercase tracking-widest mt-0.5'>Used</span>
                </div>
              </div>

              {/* Legends */}
              <div className='flex-1 w-full space-y-2'>
                <div className='flex items-center justify-between text-[10px] text-slate-350'>
                  <div className='flex items-center gap-2'>
                    <span className='w-1.5 h-1.5 rounded-full bg-blue-550' />
                    <span>Applications</span>
                  </div>
                  <div className='flex items-center gap-3 font-mono text-[9px]'>
                    <span className='text-slate-400'>{appsSizeStr}</span>
                    <span className='text-slate-500 text-right w-8'>32%</span>
                  </div>
                </div>
                <div className='flex items-center justify-between text-[10px] text-slate-350'>
                  <div className='flex items-center gap-2'>
                    <span className='w-1.5 h-1.5 rounded-full bg-purple-500' />
                    <span>Documents</span>
                  </div>
                  <div className='flex items-center gap-3 font-mono text-[9px]'>
                    <span className='text-slate-400'>{docsSizeStr}</span>
                    <span className='text-slate-500 text-right w-8'>22%</span>
                  </div>
                </div>
                <div className='flex items-center justify-between text-[10px] text-slate-350'>
                  <div className='flex items-center gap-2'>
                    <span className='w-1.5 h-1.5 rounded-full bg-emerald-500' />
                    <span>Media</span>
                  </div>
                  <div className='flex items-center gap-3 font-mono text-[9px]'>
                    <span className='text-slate-400'>{mediaSizeStr}</span>
                    <span className='text-slate-500 text-right w-8'>19%</span>
                  </div>
                </div>
                <div className='flex items-center justify-between text-[10px] text-slate-350'>
                  <div className='flex items-center gap-2'>
                    <span className='w-1.5 h-1.5 rounded-full bg-amber-500' />
                    <span>System</span>
                  </div>
                  <div className='flex items-center gap-3 font-mono text-[9px]'>
                    <span className='text-slate-400'>{systemSizeStr}</span>
                    <span className='text-slate-500 text-right w-8'>15%</span>
                  </div>
                </div>
                <div className='flex items-center justify-between text-[10px] text-slate-350'>
                  <div className='flex items-center gap-2'>
                    <span className='w-1.5 h-1.5 rounded-full bg-orange-500' />
                    <span>Other</span>
                  </div>
                  <div className='flex items-center gap-3 font-mono text-[9px]'>
                    <span className='text-slate-400'>{otherSizeStr}</span>
                    <span className='text-slate-500 text-right w-8'>12%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Refresh Info */}
            <div className='flex items-center justify-center gap-2 pt-2 border-t border-slate-900/60 text-[9px] text-slate-550'>
              <span>Last updated: Today, 10:24 AM</span>
              <RotateCw className='w-3 h-3 hover:text-slate-300 cursor-pointer transition-colors' />
            </div>
          </div>
        </div>
      </div>
    );
  },
);

TargetSelectorCard.displayName = "TargetSelectorCard";
