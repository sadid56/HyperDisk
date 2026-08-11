import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { showToast } from "../providers/ToastProvider";
import { FileNode, ProgressPayload, ScanCompletePayload, ScanDeltaPayload, ScanErrorPayload } from "../types";
import { getFullPath } from "../utils/pathUtils";

export function useScanner() {
  const [flatNodes, setFlatNodes] = useState<FileNode[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [breadcrumbIds, setBreadcrumbIds] = useState<number[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanCount, setScanCount] = useState<number>(0);
  const [scanStatusPath, setScanStatusPath] = useState<string>("");
  const [hoveredNode, setHoveredNode] = useState<FileNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const activeScanIdRef = useRef<string | null>(null);
  const scanCountRef = useRef<number>(0);
  const deltaQueueRef = useRef<ScanDeltaPayload[]>([]);
  const flushRafRef = useRef<number | null>(null);
  const listenerCleanupRef = useRef<Array<() => void>>([]);
  const rootInitializedRef = useRef<boolean>(false);
  // Buffer for accumulating scan data — only flushed to state on scan-complete
  const bufferedNodesRef = useRef<FileNode[]>([]);

  const cleanupScanStream = useCallback(() => {
    if (flushRafRef.current !== null) {
      cancelAnimationFrame(flushRafRef.current);
      flushRafRef.current = null;
    }

    deltaQueueRef.current = [];
    scanCountRef.current = 0;
    rootInitializedRef.current = false;
    bufferedNodesRef.current = [];

    const listeners = listenerCleanupRef.current;
    listenerCleanupRef.current = [];

    for (const unlisten of listeners) {
      try {
        unlisten();
      } catch {
        // silent cleanup
      }
    }
  }, []);

  // Flush queued deltas into the BUFFER ref (not React state) — zero re-renders during scan
  const flushQueuedDeltas = useCallback(() => {
    flushRafRef.current = null;

    const deltas = deltaQueueRef.current.splice(0);
    if (deltas.length === 0) return;

    let addedCount = 0;
    for (const delta of deltas) {
      addedCount += delta.added.length;
    }

    scanCountRef.current += addedCount;

    const nextNodes = bufferedNodesRef.current;

    for (const delta of deltas) {
      for (const node of delta.added) {
        nextNodes[node.id] = node;
      }

      for (const node of delta.updated) {
        if (nextNodes[node.id]) {
          nextNodes[node.id] = {
            ...nextNodes[node.id],
            ...node,
          };
        } else {
          nextNodes[node.id] = node;
        }
      }
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushRafRef.current !== null) return;

    flushRafRef.current = requestAnimationFrame(() => {
      flushQueuedDeltas();
    });
  }, [flushQueuedDeltas]);

  const startScan = useCallback(
    async (targetPath: string) => {
      if (activeScanIdRef.current) {
        return;
      }

      cleanupScanStream();

      const scanId = crypto.randomUUID();
      activeScanIdRef.current = scanId;
      rootInitializedRef.current = false;

      setIsScanning(true);
      scanCountRef.current = 0;
      setScanCount(0);
      setScanStatusPath("Initializing scan...");
      setFlatNodes([]);
      setCurrentId(null);
      setBreadcrumbIds([]);
      setHoveredNode(null);
      setSelectedNode(null);
      bufferedNodesRef.current = [];

      try {
        const unlistenProgress = await listen<ProgressPayload>("scan-progress", (event) => {
          if (event.payload.scanId !== activeScanIdRef.current) return;
          setScanStatusPath(event.payload.path);
          setScanCount(event.payload.count);
        });

        const unlistenDelta = await listen<ScanDeltaPayload>("scan-delta", (event) => {
          if (event.payload.scanId !== activeScanIdRef.current) return;
          deltaQueueRef.current.push(event.payload);
          scheduleFlush();
        });

        const unlistenComplete = await listen<ScanCompletePayload>("scan-complete", (event) => {
          if (event.payload.scanId !== activeScanIdRef.current) return;

          // Cancel any pending RAF flush and drain the remaining queue into the buffer
          if (flushRafRef.current !== null) {
            cancelAnimationFrame(flushRafRef.current);
            flushRafRef.current = null;
          }
          flushQueuedDeltas();

          // Flush the entire buffer into React state at once — single render with all data
          const finalNodes = bufferedNodesRef.current;
          setFlatNodes(finalNodes);
          if (finalNodes.length > 0 && finalNodes[0]) {
            setCurrentId(0);
            setBreadcrumbIds([0]);
            setSelectedNode(finalNodes[0]);
          }
          setScanCount(event.payload.count);
          setIsScanning(false);
          activeScanIdRef.current = null;
          cleanupScanStream();
        });

        const unlistenError = await listen<ScanErrorPayload>("scan-error", (event) => {
          if (event.payload.scanId !== activeScanIdRef.current) return;

          showToast({ message: "Scan Error", description: event.payload.message, type: "error" });
          setIsScanning(false);
          activeScanIdRef.current = null;
          cleanupScanStream();
        });

        listenerCleanupRef.current = [unlistenProgress, unlistenDelta, unlistenComplete, unlistenError];

        // Let React paint the skeleton state before the native scan begins.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });

        await invoke("scan_folder_live", { targetPath, scanId });
      } catch (err: any) {
        setIsScanning(false);
        activeScanIdRef.current = null;
        cleanupScanStream();
        throw err;
      }
    },
    [cleanupScanStream, flushQueuedDeltas, scheduleFlush],
  );

  const selectFolderDialog = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && typeof selected === "string") {
      await startScan(selected);
    }
  }, [startScan]);

  const scanHomeFolder = useCallback(async () => {
    try {
      const home = await invoke<string>("get_home_folder");
      if (home) {
        await startScan(home);
      }
    } catch (err) {
      console.error("Failed to get home folder:", err);
    }
  }, [startScan]);

  const navigateTo = useCallback(
    async (nodeId: number) => {
      const targetNode = flatNodes[nodeId];

      setCurrentId(nodeId);
      setBreadcrumbIds(() => {
        // Build path hierarchy from target node up to root
        const trail: number[] = [];
        let curr: number | null = nodeId;
        while (curr !== null && flatNodes[curr]) {
          trail.unshift(curr);
          curr = flatNodes[curr].parentId;
        }

        // If trail is valid, use it; otherwise fallback to prev path
        return trail.length > 0 ? trail : [nodeId];
      });
      setHoveredNode(null);
      if (flatNodes[nodeId]) {
        setSelectedNode(flatNodes[nodeId]);
      }

      if (
        targetNode &&
        targetNode.isDirectory &&
        (!targetNode.childIds || targetNode.childIds.length === 0)
      ) {
        setIsScanning(true);
        setScanStatusPath("Analyzing folder...");
        try {
          const fullPath = getFullPath(nodeId, flatNodes);
          const newChildren = await invoke<FileNode[]>("scan_directory_shallow", {
            targetPath: fullPath,
            parentId: nodeId,
            startId: flatNodes.length,
          });

          setFlatNodes((prevNodes) => {
            const nextNodes = [...prevNodes];
            const childIds = newChildren.map((n) => n.id);
            nextNodes[nodeId] = {
              ...nextNodes[nodeId],
              childIds,
            };
            // Append new children
            for (const child of newChildren) {
              nextNodes[child.id] = child;
            }
            return nextNodes;
          });
        } catch (err) {
          console.error("Failed to lazy load directory:", err);
          showToast({
            message: "Scan Error",
            description: String(err),
            type: "error",
          });
        } finally {
          setIsScanning(false);
        }
      }
    },
    [flatNodes],
  );

  const removeNode = useCallback((nodeId: number) => {
    setFlatNodes((prevNodes) => {
      const newNodes = [...prevNodes];
      const target = newNodes[nodeId];
      if (!target) return prevNodes;

      let pid = target.parentId;
      while (pid !== null && newNodes[pid]) {
        newNodes[pid] = {
          ...newNodes[pid],
          size: Math.max(0, newNodes[pid].size - target.size),
        };
        pid = newNodes[pid].parentId;
      }

      if (target.parentId !== null && newNodes[target.parentId]) {
        const parent = newNodes[target.parentId];
        newNodes[target.parentId] = {
          ...parent,
          childIds: parent.childIds.filter((id) => id !== nodeId),
        };
      }

      return newNodes;
    });
  }, []);

  const addFolderNode = useCallback((parentId: number, _newPath: string, folderName: string): number => {
    let newNodeId = 0;
    setFlatNodes((prevNodes) => {
      newNodeId = prevNodes.length;
      const newNode: FileNode = {
        id: newNodeId,
        name: folderName,
        path: "",
        isDirectory: true,
        size: 0,
        childIds: [],
        parentId,
      };

      const newNodes = [...prevNodes, newNode];

      if (newNodes[parentId]) {
        const parent = newNodes[parentId];
        newNodes[parentId] = {
          ...parent,
          childIds: [...parent.childIds, newNodeId],
        };
      }

      return newNodes;
    });

    return newNodeId;
  }, []);

  const resetToDashboard = useCallback(() => {
    cleanupScanStream();
    activeScanIdRef.current = null;
    setFlatNodes([]);
    setCurrentId(null);
    setBreadcrumbIds([]);
    setHoveredNode(null);
    setSelectedNode(null);
    setScanCount(0);
    setScanStatusPath("");
    setIsScanning(false);
  }, [cleanupScanStream]);

  const navigateParent = useCallback(() => {
    if (currentId !== null && flatNodes[currentId]) {
      const parentId = flatNodes[currentId].parentId;
      if (parentId !== null) {
        navigateTo(parentId);
      }
    }
  }, [currentId, flatNodes, navigateTo]);

  const activeNode =
    currentId !== null ? flatNodes[currentId] : flatNodes[0] || null;

  useEffect(() => {
    if (rootInitializedRef.current) return;

    const rootNode = flatNodes[0];
    if (!rootNode) return;

    rootInitializedRef.current = true;
    setCurrentId(rootNode.id);
    setBreadcrumbIds([rootNode.id]);
    setSelectedNode(rootNode);
  }, [flatNodes]);

  useEffect(() => {
    return () => {
      cleanupScanStream();
    };
  }, [cleanupScanStream]);

  return {
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
    setSearchQuery,
    startScan,
    selectFolderDialog,
    scanHomeFolder,
    navigateTo,
    navigateParent,
    removeNode,
    addFolderNode,
    resetToDashboard,
    activeNode,
  };
}

