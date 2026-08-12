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
  const { checkFDA, requestFDA } = useFullDiskAccess();
  const [showFdaModal, setShowFdaModal] = useState<boolean>(false);

  useEffect(() => {
    const isMac = navigator.userAgent.toLowerCase().includes("mac");
    if (!isMac) return;

    const checkStartupFDA = async () => {
      const fdaGranted = await checkFDA();
      if (!fdaGranted) {
        const dismissed = localStorage.getItem("hyperdisk_fda_dismissed") === "true";
        if (!dismissed) {
          setShowFdaModal(true);
        }
      }
    };
    checkStartupFDA();
  }, [checkFDA]);

  const handleGrantFDA = useCallback(async () => {
    await requestFDA();
    localStorage.setItem("hyperdisk_fda_dismissed", "true");
    setShowFdaModal(false);
  }, [requestFDA]);

  const handleSkipFDA = useCallback(() => {
    localStorage.setItem("hyperdisk_fda_dismissed", "true");
    setShowFdaModal(false);
  }, []);

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

  useEffect(() => {
    const suppressContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', suppressContextMenu);
    return () => window.removeEventListener('contextmenu', suppressContextMenu);
  }, []);

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

      {showFdaModal && (
        <AlertModal
          isOpen={showFdaModal}
          title="Full Disk Access Recommended"
          subtitle="macOS Security & Privacy"
          icon={<ShieldAlert className='w-5 h-5 text-amber-500' />}
          variant='warning'
          confirmLabel='Grant Access'
          cancelLabel='Skip'
          onConfirm={handleGrantFDA}
          onCancel={handleSkipFDA}
          message={
            <div className='space-y-3 text-xs text-slate-350 leading-relaxed text-left'>
              <p>
                HyperDisk needs <strong>Full Disk Access</strong> permission to scan your drives and analyze storage usage.
              </p>
              <p>
                Without this permission, macOS will prompt you with multiple file access popups, and the application will run significantly slower (up to 5x slower) and cannot analyze system areas.
              </p>
              <p>
                To grant access, click <strong>Grant Access</strong>, toggle HyperDisk to ON in macOS System Settings under Privacy & Security, and restart the app. You can configure this later in Settings.
              </p>
            </div>
          }
        />
      )}

      <ToastProvider />
    </div>
  );
};
