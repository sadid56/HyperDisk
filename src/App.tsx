import React, { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate, useLocation } from "react-router-dom";
import { useScanner } from "./hooks/useScanner";
import { useDiskInfo } from "./hooks/useDiskInfo";
import { useSystemDrives } from "./hooks/useSystemDrives";
import { ContextMenu } from "./features/analyzer/ContextMenu";
import { AlertModal } from "./components/ui/AlertModal";
import { CreateFolderModal } from "./features/analyzer/CreateFolderModal";
import { SearchModal } from "./components/global/SearchModal";
import { ToastProvider, showToast } from "./providers/ToastProvider";
import { AppRoutes } from "./routes/AppRoutes";
import { useAutoUpdater } from "./hooks/useAutoUpdater";
import { UpdateModal } from "./components/global/UpdateModal";
import { applyThemeMode, applyFont, ThemeMode } from "./theme/themeManager";
import { FileNode } from "./types";
import { getFullPath } from "./utils/pathUtils";
import { useToolsData } from "./hooks/useToolsData";
import { useProtectedPath } from "./hooks/useProtectedPath";
import { useFullDiskAccess } from "./hooks/useFullDiskAccess";
import { LeftSidebar } from "./layout/LeftSidebar";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Header } from "./layout/Header";
import { Button } from "./components/ui/Button";

export const App: React.FC = () => {
  const updater = useAutoUpdater();
  const { updateAvailable } = updater;
  const {
    flatNodes,
    currentId,
    breadcrumbIds,
    isScanning,
    scanCount,
    scanStatusPath,
    hoveredNode,
    setHoveredNode,
    selectedNode,
    setSelectedNode,
    searchQuery,
    startScan,
    selectFolderDialog,
    navigateTo,
    removeNode,
    addFolderNode,
    resetToDashboard,
    activeNode,
  } = useScanner();

  const hoverTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [scanOrigin, setScanOrigin] = useState<string>("/");

  const rootPath = flatNodes[0]?.path;
  const { refreshDiskInfo } = useDiskInfo(rootPath);
  const {
    drives,
    folders,
    systemRootFolders,
    loading: drivesLoading,
    foldersLoading,
    refetch: refetchDrives,
  } = useSystemDrives();
  const {
    largeFiles,
    cleanupSuggestions,
    duplicateGroups,
    largeFilesLoading,
    cleanupLoading,
    duplicatesLoading,
    refetchTools,
  } = useToolsData();
  const { checkFDA, requestFDA, hasFDA } = useFullDiskAccess();
  const [fdaSetupSkipped, setFdaSetupSkipped] = useState<boolean>(() => {
    return localStorage.getItem("hyperdisk_fda_dismissed") === "true";
  });

  useEffect(() => {
    const isMac = navigator.userAgent.toLowerCase().includes("mac");
    if (!isMac) return;

    const checkStartupFDA = async () => {
      await checkFDA();
    };
    checkStartupFDA();
  }, [checkFDA]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null);
  const [pendingDeleteNode, setPendingDeleteNode] = useState<FileNode | null>(null);
  const { isProtected: trashIsProtected } = useProtectedPath(pendingDeleteNode ? getFullPath(pendingDeleteNode.id, flatNodes) : undefined);
  const [createFolderTarget, setCreateFolderTarget] = useState<FileNode | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  useEffect(() => {
    localStorage.removeItem("hyperdisk_scan_history");
    const savedMode = (localStorage.getItem("hyperdisk_theme_mode") as ThemeMode) || "dark";
    const savedFont = localStorage.getItem("hyperdisk_font");
    applyThemeMode(savedMode);
    if (savedFont) applyFont(savedFont);
  }, []);

  const handleScanPath = useCallback(async (path: string) => {
    try {
      if (location.pathname !== "/analyzer") {
        setScanOrigin(location.pathname);
      }
      navigate("/analyzer");
      let finalPath = path;
      if (path.startsWith("~")) {
        const home = await invoke<string>("get_home_folder");
        finalPath = path.replace("~", home);
      }
      await startScan(finalPath);
    } catch (err: any) {
      showToast({ message: "Scan Error", description: err?.message || String(err), type: "error" });
    }
  }, [navigate, startScan, location.pathname]);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleReveal = useCallback(async (path: string) => {
    try {
      await invoke("reveal_target_item", { targetPath: path });
    } catch (err: any) {
      showToast({ message: "Reveal Failed", description: err || "Could not open file manager", type: "error" });
    }
  }, []);

  const handleOpenInTerminal = useCallback(async (path: string) => {
    try {
      await invoke("open_in_terminal", { targetPath: path });
    } catch (err: any) {
      showToast({ message: "Terminal Failed", description: err || "Could not open terminal", type: "error" });
    }
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteNode) return;
    const node = pendingDeleteNode;
    
    // Optimistically update UI state instantly
    setPendingDeleteNode(null);
    removeNode(node.id);
    
    if (currentId === node.id) {
      navigateTo(node.parentId !== null ? node.parentId : 0);
    }

    try {
      await invoke("delete_target_item", { targetPath: getFullPath(node.id, flatNodes) });

      if (rootPath) {
        refreshDiskInfo(rootPath);
      }

      showToast({ message: "Moved to Trash", description: `Successfully deleted "${node.name}"`, type: "success" });
    } catch (err: any) {
      showToast({ message: "Deletion Failed", description: err || "Failed to move item to trash", type: "error" });
      if (rootPath) {
        refreshDiskInfo(rootPath); // Restore files/tree in UI on error
      }
    } finally {
      setIsDeleting(false);
    }
  }, [pendingDeleteNode, removeNode, currentId, navigateTo, rootPath, refreshDiskInfo, flatNodes]);

  const handleSelectFolder = useCallback(() => {
    if (location.pathname !== "/analyzer") {
      setScanOrigin(location.pathname);
    }
    navigate("/analyzer");
    selectFolderDialog();
  }, [navigate, selectFolderDialog, location.pathname]);

  const handleBackToOrigin = useCallback(() => {
    navigate(scanOrigin);
    resetToDashboard();
  }, [navigate, scanOrigin, resetToDashboard]);

  const handleDashboard = useCallback(() => {
    resetToDashboard();
  }, [resetToDashboard]);

  const handleRescan = useCallback(() => {
    rootPath && startScan(rootPath);
  }, [rootPath, startScan]);

  const handleOpenSearchModal = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const handleCloseSearchModal = useCallback(() => {
    setIsSearchOpen(false);
  }, []);

  const handleHoverNode = useCallback((node: FileNode | null) => {
    if (hoverTimeoutRef.current !== null) {
      cancelAnimationFrame(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = requestAnimationFrame(() => {
      setHoveredNode(node);
      hoverTimeoutRef.current = null;
    });
  }, [setHoveredNode]);

  // Clean up any pending animation frames on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current !== null) {
        cancelAnimationFrame(hoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const suppressContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', suppressContextMenu);
    return () => window.removeEventListener('contextmenu', suppressContextMenu);
  }, []);

  const handleSelectNode = useCallback((node: FileNode | null) => {
    setSelectedNode(node);
  }, [setSelectedNode]);

  const handleNavigateTo = useCallback((id: number) => {
    navigateTo(id);
  }, [navigateTo]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handlePendingDelete = useCallback((node: FileNode) => {
    setPendingDeleteNode(node);
  }, []);

  const handleCreateSubfolder = useCallback((node: FileNode) => {
    setCreateFolderTarget(node);
  }, []);

  const handleCopyPathClipboard = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
    showToast({ message: "Copied", description: "Path copied to clipboard", type: "success" });
  }, []);

  const handleCancelDelete = useCallback(() => {
    setPendingDeleteNode(null);
  }, []);

  const handleCloseCreateFolder = useCallback(() => {
    setCreateFolderTarget(null);
  }, []);

  const handleFolderCreated = useCallback((newPath: string, folderName: string) => {
    if (createFolderTarget) {
      addFolderNode(createFolderTarget.id, newPath, folderName);
    }
  }, [createFolderTarget, addFolderNode]);

  const hasScanData = flatNodes.length > 0;

  const isMac = navigator.userAgent.toLowerCase().includes("mac");

  if (isMac && !hasFDA && !fdaSetupSkipped) {
    return (
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-background select-none font-sans p-6 overflow-y-auto'>
        <div className='w-full max-w-2xl bg-surface border border-surface-border rounded-3xl shadow-2xl p-8 sm:p-12 text-center space-y-8 animate-in zoom-in-95 duration-200 relative bg-glow max-h-[90vh] overflow-y-auto'>
          
          <div className="absolute inset-0 bg-gradient-to-tr from-accent-purple/5 to-accent-blue/5 rounded-3xl pointer-events-none" />

          <div className='flex flex-col items-center gap-4 relative z-10'>
            <div className='w-16 h-16 rounded-2xl bg-accent-purple/10 border border-accent-purple/20 text-accent-purple flex items-center justify-center shadow-lg shadow-accent-purple/5'>
              <ShieldAlert className='w-8 h-8 animate-pulse' />
            </div>
            <div className='space-y-2'>
              <h1 className='text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100'>Full Disk Access Required</h1>
              <p className='text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed'>
                HyperDisk requires permission to scan your storage drives and compute folder sizes at maximum performance.
              </p>
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 text-left relative z-10'>
            <div className='p-4 bg-background/50 border border-surface-border rounded-2xl space-y-2'>
              <div className='text-xs font-bold text-slate-200 uppercase tracking-wider'>⚡ 5x Faster Scans</div>
              <p className='text-[10px] text-slate-400 leading-relaxed'>Calculates folder structures and duplicate files in seconds without getting blocked by OS limits.</p>
            </div>
            <div className='p-4 bg-background/50 border border-surface-border rounded-2xl space-y-2'>
              <div className='text-xs font-bold text-slate-200 uppercase tracking-wider'>🛡️ Zero Popups</div>
              <p className='text-[10px] text-slate-400 leading-relaxed'>Bypasses continuous system permission alerts for standard folders like Desktop, Downloads, and Documents.</p>
            </div>
            <div className='p-4 bg-background/50 border border-surface-border rounded-2xl space-y-2'>
              <div className='text-xs font-bold text-slate-200 uppercase tracking-wider'>📂 Complete Analysis</div>
              <p className='text-[10px] text-slate-400 leading-relaxed'>Scans deep system areas, caches, caches directories, and duplicate space logs accurately.</p>
            </div>
          </div>

          <div className='p-5 bg-background/60 border border-surface-border rounded-2xl text-left text-xs text-slate-350 space-y-3 relative z-10 font-sans leading-relaxed'>
            <p className='font-bold text-slate-200'>How to enable permission:</p>
            <ol className='list-decimal list-inside space-y-2 text-[11px] opacity-90'>
              <li>Click the <strong className='text-accent-purple'>Open Privacy & Security Settings</strong> button below.</li>
              <li>In the System Settings window, locate <strong className='text-slate-200'>HyperDisk</strong>.</li>
              <li>Toggle the switch next to HyperDisk to <strong className='text-emerald-400'>ON</strong>.</li>
              <li>Once enabled, click <strong className='text-slate-200'>Check Status</strong> to start using the app.</li>
            </ol>
          </div>

          <div className='flex flex-col sm:flex-row items-center justify-center gap-3 relative z-10 pt-2'>
            <Button
              variant='secondary'
              onClick={() => {
                localStorage.setItem("hyperdisk_fda_dismissed", "true");
                setFdaSetupSkipped(true);
              }}
              className='w-full sm:w-auto text-xs py-2.5 order-last sm:order-first'
            >
              Limited Mode (Skip)
            </Button>

            <Button
              variant='outline'
              onClick={async () => {
                const granted = await checkFDA();
                if (granted) {
                  showToast({
                    message: "Access Granted",
                    description: "Full Disk Access enabled successfully!",
                    type: "success"
                  });
                } else {
                  showToast({
                    message: "Access Denied",
                    description: "Please make sure to toggle HyperDisk ON in macOS System Settings.",
                    type: "warning"
                  });
                }
              }}
              className='w-full sm:w-auto text-xs py-2.5'
            >
              Check Status
            </Button>

            <Button
              variant='primary'
              onClick={requestFDA}
              className='w-full sm:w-auto text-xs py-2.5 bg-accent-purple hover:bg-accent-purple/90 border-none'
            >
              Open Privacy & Security Settings
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='h-screen w-screen flex bg-background text-slate-100 overflow-hidden font-sans select-none'>
      {/* Left Sidebar navigation component */}
      <LeftSidebar onDashboard={handleDashboard} />

      {/* ─── MAIN COLUMN ──────────────────────────────────────────────────── */}
      <main className='flex-1 flex flex-col min-w-0 bg-background'>
        {/* Top Header Bar */}
        <Header
          onSelectFolder={handleSelectFolder}
          onDashboard={handleDashboard}
          onOpenSearchModal={handleOpenSearchModal}
          isScanning={isScanning}
          hasScanData={hasScanData}
          updateAvailable={updateAvailable}
          onRefresh={() => {
            refetchDrives();
            handleRescan();
          }}
        />

        {/* Dynamic App Content Route */}
        <AppRoutes
          isScanning={isScanning}
          hasScanData={hasScanData}
          scanCount={scanCount}
          scanStatusPath={scanStatusPath}
          flatNodes={flatNodes}
          currentId={currentId}
          breadcrumbIds={breadcrumbIds}
          hoveredNode={hoveredNode}
          selectedNode={selectedNode}
          activeNode={activeNode}
          searchQuery={searchQuery}
          onHoverNode={handleHoverNode}
          onSelectNode={handleSelectNode}
          onNavigate={handleNavigateTo}
          onContextMenu={handleContextMenu}
          onScanPath={handleScanPath}
          onSelectFolder={handleSelectFolder}
          onBackToOrigin={handleBackToOrigin}
          updater={updater}
          drives={drives}
          folders={folders}
          systemRootFolders={systemRootFolders}
          drivesLoading={drivesLoading}
          foldersLoading={foldersLoading}
          largeFiles={largeFiles}
          cleanupSuggestions={cleanupSuggestions}
          duplicateGroups={duplicateGroups}
          largeFilesLoading={largeFilesLoading}
          cleanupLoading={cleanupLoading}
          duplicatesLoading={duplicatesLoading}
          onRefreshTools={refetchTools}
          onCreateFolder={handleCreateSubfolder}
        />
      </main>

      {/* Modal overlays */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          flatNodes={flatNodes}
          onClose={handleCloseContextMenu}
          onNavigate={handleNavigateTo}
          onReveal={handleReveal}
          onDelete={handlePendingDelete}
          onCreateSubfolder={handleCreateSubfolder}
          onCopyPath={handleCopyPathClipboard}
          onOpenInTerminal={handleOpenInTerminal}
        />
      )}

      {pendingDeleteNode && (
        <AlertModal
          isOpen={Boolean(pendingDeleteNode)}
          title={trashIsProtected ? "Protected System Directory" : "Move Item to Trash?"}
          subtitle={pendingDeleteNode.name}
          icon={trashIsProtected ? <ShieldAlert className='w-5 h-5' /> : <AlertTriangle className='w-5 h-5' />}
          variant='danger'
          confirmLabel='Confirm Delete'
          cancelLabel='Cancel'
          isLoading={isDeleting}
          confirmDisabled={trashIsProtected}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          message={
            trashIsProtected ? (
              <div className='p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs leading-relaxed space-y-1'>
                <p className='font-semibold flex items-center gap-1.5'>
                  <ShieldAlert className='w-4 h-4 text-amber-400' />
                  Deletion Disabled
                </p>
                <p className='opacity-90'>
                  This path is a critical system directory (
                  <span className='font-mono'>{getFullPath(pendingDeleteNode.id, flatNodes)}</span>). Deletion is disabled to protect system
                  integrity.
                </p>
              </div>
            ) : (
              <p className='text-xs text-slate-300 leading-relaxed'>
                Are you sure you want to move <span className='font-semibold text-slate-100'>{pendingDeleteNode.name}</span> to the system
                trash? This item can be restored from your trash bin.
              </p>
            )
          }
        />
      )}

      <CreateFolderModal
        isOpen={Boolean(createFolderTarget)}
        parentFolder={createFolderTarget}
        parentPath={createFolderTarget ? getFullPath(createFolderTarget.id, flatNodes) : ""}
        onClose={handleCloseCreateFolder}
        onFolderCreated={handleFolderCreated}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={handleCloseSearchModal}
        flatNodes={flatNodes}
        onNavigate={handleNavigateTo}
        onSelectNode={handleSelectNode}
        onScanPath={handleScanPath}
      />

      <UpdateModal
        isOpen={updater.showModal}
        version={updater.updateInfo?.version || ""}
        body={updater.updateInfo?.body}
        installing={updater.installing}
        progressPercent={updater.progressPercent}
        readyToRestart={updater.readyToRestart}
        error={updater.error}
        onConfirm={updater.startUpdate}
        onRestart={updater.performRestart}
        onSkip={updater.skipUpdate}
        onRetry={() => updater.startUpdate()}
      />



      <ToastProvider />
    </div>
  );
};
