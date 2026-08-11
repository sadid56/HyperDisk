import React from 'react';
import { Routes, Route, useNavigate } from "react-router-dom";
import { Folder } from "lucide-react";
import { AnalyzerPage } from '../pages/AnalyzerPage';
import { SettingsPage } from '../pages/SettingsPage';
import { DashboardPage } from '../pages/DashboardPage';
import { VolumesPage } from '../pages/VolumesPage';
import { FoldersPage } from '../pages/FoldersPage';
import { LargeFilesPage } from '../pages/LargeFilesPage';
import { DuplicatesPage } from '../pages/DuplicatesPage';
import { CleanupPage } from '../pages/CleanupPage';


import { Button } from "../components/ui/Button";
import { FileNode, SystemDrive, UserFolder, LargeFile, CleanupSuggestion, DuplicateGroup } from '../types';

interface AppRoutesProps {
  isScanning: boolean;
  hasScanData: boolean;
  scanCount: number;
  scanStatusPath: string;
  flatNodes: FileNode[];
  currentId: number | null;
  breadcrumbIds: number[];
  hoveredNode: FileNode | null;
  selectedNode: FileNode | null;
  activeNode: FileNode | null;
  searchQuery: string;
  onHoverNode: (node: FileNode | null) => void;
  onSelectNode: (node: FileNode | null) => void;
  onNavigate: (id: number) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  onScanPath: (path: string) => void;
  onSelectFolder: () => void;
  updater: any;
  drives: SystemDrive[];
  folders: UserFolder[];
  systemRootFolders: UserFolder[];
  drivesLoading: boolean;
  foldersLoading?: boolean;
  largeFiles: LargeFile[];
  cleanupSuggestions: CleanupSuggestion[];
  duplicateGroups: DuplicateGroup[];
  largeFilesLoading: boolean;
  cleanupLoading: boolean;
  duplicatesLoading: boolean;
  onRefreshTools: () => void;
  onBackToOrigin: () => void;
  onCreateFolder: (node: FileNode) => void;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({
  isScanning,
  hasScanData,
  scanCount,
  scanStatusPath,
  flatNodes,
  currentId,
  breadcrumbIds,
  hoveredNode,
  selectedNode,
  activeNode,
  searchQuery,
  onHoverNode,
  onSelectNode,
  onNavigate,
  onContextMenu,
  onScanPath,
  onSelectFolder,
  onBackToOrigin,
  updater,
  drives,
  folders,
  systemRootFolders,
  drivesLoading,
  foldersLoading,
  largeFiles,
  cleanupSuggestions,
  duplicateGroups,
  largeFilesLoading,
  cleanupLoading,
  duplicatesLoading,
  onRefreshTools,
  onCreateFolder,
}) => {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path='/'
        element={
            <DashboardPage
              drives={drives}
              folders={folders}
              systemRootFolders={systemRootFolders}
              largeFiles={largeFiles}
              cleanupSuggestions={cleanupSuggestions}
              drivesLoading={drivesLoading}
              foldersLoading={foldersLoading}
              largeFilesLoading={largeFilesLoading}
              cleanupLoading={cleanupLoading}
              onScanPath={onScanPath}
              onNavigateTab={(tab) => navigate(`/${tab === "overview" ? "" : tab}`)}
            />
        }
      />
      <Route
        path='/analyzer'
        element={
          hasScanData || isScanning ? (
            <AnalyzerPage
              flatNodes={flatNodes}
              currentId={currentId}
              breadcrumbIds={breadcrumbIds}
              hoveredNode={hoveredNode}
              selectedNode={selectedNode}
              activeNode={activeNode}
              searchQuery={searchQuery}
              isScanning={isScanning}
              scanCount={scanCount}
              scanStatusPath={scanStatusPath}
              onHoverNode={onHoverNode}
              onSelectNode={onSelectNode}
              onNavigate={onNavigate}
              onContextMenu={onContextMenu}
              onBackToOrigin={onBackToOrigin}
              onCreateFolder={onCreateFolder}
            />
          ) : (
            <div className='flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 max-w-sm mx-auto my-auto animate-in fade-in duration-200'>
              <div className='w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shadow-lg'>
                <Folder className='w-8 h-8' />
              </div>
              <div className='space-y-2'>
                <h2 className='text-lg font-bold text-slate-100'>No Active Scan</h2>
                <p className='text-xs text-slate-400 leading-relaxed'>
                  Select a folder to begin analyzing your storage space, finding large files, and visualizing disk hierarchy.
                </p>
              </div>
              <Button
                variant='primary'
                onClick={onSelectFolder}
                size='md'
              >
                Select Folder to Analyze
              </Button>
            </div>
          )
        }
      />
      <Route
        path='/volumes'
        element={<VolumesPage drives={drives} isScanning={isScanning} onScanPath={onScanPath} flatNodes={flatNodes} />}
      />
      <Route
        path='/folders'
        element={<FoldersPage folders={folders} isScanning={isScanning} onScanPath={onScanPath} />}
      />
      <Route path='/large-files' element={<LargeFilesPage largeFiles={largeFiles} loading={largeFilesLoading} onRefresh={onRefreshTools} />} />
      <Route path='/duplicates' element={<DuplicatesPage duplicateGroups={duplicateGroups} loading={duplicatesLoading} onRefresh={onRefreshTools} />} />
      <Route path='/cleanup' element={<CleanupPage cleanupSuggestions={cleanupSuggestions} loading={cleanupLoading} onRefresh={onRefreshTools} />} />
      <Route
        path='/settings'
        element={
          <SettingsPage
            onBackToAnalyzer={() => {
              if (hasScanData) navigate("/analyzer");
              else navigate("/");
            }}
            updater={updater}
          />
        }
      />
    </Routes>
  );
};
