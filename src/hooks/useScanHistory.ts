import { useState, useEffect, useCallback } from "react";

export interface ScanHistoryItem {
  path: string;
  timestamp: number;
}

export function useScanHistory() {
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);

  const loadHistory = useCallback(() => {
    try {
      const history = localStorage.getItem("hyperdisk_scan_history");
      if (history) {
        const parsed = JSON.parse(history);
        const normalized: ScanHistoryItem[] = parsed.map((item: any) => {
          if (typeof item === "string") {
            return { path: item, timestamp: Date.now() };
          }
          return item as ScanHistoryItem;
        });
        setRecentScans(normalized);
      } else {
        setRecentScans([]);
      }
    } catch (err) {
      console.error("Failed to load scan history:", err);
    }
  }, []);

  useEffect(() => {
    loadHistory();

    const handleStorageChange = () => {
      loadHistory();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [loadHistory]);

  const addScanPath = useCallback((path: string) => {
    try {
      const history = localStorage.getItem("hyperdisk_scan_history");
      let rawList: any[] = history ? JSON.parse(history) : [];
      let list: ScanHistoryItem[] = rawList.map((item: any) => {
        if (typeof item === "string") {
          return { path: item, timestamp: Date.now() };
        }
        return item as ScanHistoryItem;
      });

      list = list.filter((item) => item.path !== path);
      list.unshift({ path, timestamp: Date.now() });
      list = list.slice(0, 5); // Limit to top 5 recent scans

      localStorage.setItem("hyperdisk_scan_history", JSON.stringify(list));
      setRecentScans(list);
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      console.error("Failed to save scan history:", err);
    }
  }, []);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem("hyperdisk_scan_history");
      setRecentScans([]);
      window.dispatchEvent(new Event("storage"));
    } catch (err) {
      console.error("Failed to clear scan history:", err);
    }
  }, []);

  return {
    recentScans,
    addScanPath,
    clearHistory,
  };
}
