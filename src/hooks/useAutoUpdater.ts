import { useState, useEffect, useCallback, useRef } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";
import { showToast } from "../providers/ToastProvider";

// Helper function to compare semantic versions (e.g., 2.10.1 > 2.2.0)
const isNewerVersion = (current: string, latest: string): boolean => {
  const cleanCurrent = current.replace(/^v/, "").split(".").map(Number);
  const cleanLatest = latest.replace(/^v/, "").split(".").map(Number);
  for (let i = 0; i < Math.max(cleanCurrent.length, cleanLatest.length); i++) {
    const c = cleanCurrent[i] || 0;
    const l = cleanLatest[i] || 0;
    if (l > c) return true;
    if (c > l) return false;
  }
  return false;
};

export function useAutoUpdater() {
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; date?: string; body?: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readyToRestart, setReadyToRestart] = useState(false);

  // Keep a reference to the Tauri Update object
  const updateRef = useRef<Update | null>(null);

  const checkForUpdates = useCallback(async (isManual = false) => {
    setChecking(true);
    setError(null);
    setReadyToRestart(false);
    try {
      // 1. Try checking latest version on GitHub API
      let gitHubLatestVersion: string | null = null;
      let gitHubReleaseData: any = null;
      try {
        const res = await fetch("https://api.github.com/repos/sadid56/HyperDisk/releases/latest");
        if (res.ok) {
          gitHubReleaseData = await res.json();
          gitHubLatestVersion = gitHubReleaseData.tag_name;
        }
      } catch (e) {
        console.warn("Failed to check GitHub releases API, falling back:", e);
      }

      const currentVersion = await getVersion();

      if (gitHubLatestVersion && isNewerVersion(currentVersion, gitHubLatestVersion)) {
        // A new version exists! Let's check if the signed release json is available
        try {
          const updateResult = await check();
          if (updateResult) {
            updateRef.current = updateResult;
            setUpdateInfo({
              version: updateResult.version,
              date: updateResult.date,
              body: updateResult.body,
            });
            setUpdateAvailable(true);
            const skippedVersion = localStorage.getItem("hyperdisk_skipped_version");
            if (isManual || skippedVersion !== updateResult.version) {
              setShowModal(true);
            }
            setChecking(false);
            return true;
          }
        } catch (e) {
          console.warn("Direct release json fetch failed:", e);
        }

        // Fallback: show update available but note that auto-install is not possible
        // (signed latest.json missing from the release)
        updateRef.current = null;
        setUpdateInfo({
          version: gitHubLatestVersion,
          date: gitHubReleaseData?.published_at,
          body: gitHubReleaseData?.body || "A new release is available.",
        });
        setUpdateAvailable(true);
        const skippedVersion = localStorage.getItem("hyperdisk_skipped_version");
        if (isManual || skippedVersion !== gitHubLatestVersion) {
          setShowModal(true);
        }
        setChecking(false);
        return true;
      }

      // 2. If no new version on GitHub or API call failed, run standard Tauri check
      const updateResult = await check();
      if (updateResult) {
        updateRef.current = updateResult;
        setUpdateInfo({
          version: updateResult.version,
          date: updateResult.date,
          body: updateResult.body,
        });
        setUpdateAvailable(true);
        const skippedVersion = localStorage.getItem("hyperdisk_skipped_version");
        if (isManual || skippedVersion !== updateResult.version) {
          setShowModal(true);
        }
        setChecking(false);
        return true;
      } else {
        updateRef.current = null;
        setUpdateInfo(null);
        setUpdateAvailable(false);
        if (isManual) {
          showToast({
            message: "App is Up to Date",
            description: `You are running the latest version of HyperDisk (v${currentVersion}).`,
            type: "success",
          });
        }
        setChecking(false);
        return false;
      }
    } catch (err: any) {
      console.error("Update check failed:", err);
      const errMsg = err?.toString() || "Failed to check for updates";
      setError(errMsg);
      setChecking(false);
      if (isManual) {
        showToast({
          message: "App is Up to Date",
          description: "No new updates are currently available.",
          type: "success",
        });
      }
      return false;
    }
  }, []);

  const startUpdate = useCallback(async () => {
    // In development mode, simulate the update process to test the progress UI and relaunch flow
    if (import.meta.env.DEV) {
      setInstalling(true);
      setProgressPercent(0);
      setError(null);
      setReadyToRestart(false);

      let downloaded = 0;
      const total = 100;
      const interval = setInterval(() => {
        downloaded += 5;
        setProgressPercent(downloaded);

        if (downloaded >= total) {
          clearInterval(interval);

          // Record this simulation in history log
          const historyJson = localStorage.getItem("hyperdisk_update_history") || "[]";
          try {
            const history = JSON.parse(historyJson);
            history.push({
              version: updateInfo?.version || "2.2.7",
              installedAt: new Date().toISOString(),
            });
            localStorage.setItem("hyperdisk_update_history", JSON.stringify(history));
          } catch {
            // Ignore history recording failures
          }

          // Show "Ready to Restart" state instead of auto-relaunching
          setInstalling(false);
          setReadyToRestart(true);
        }
      }, 100);
      return;
    }

    // If no Tauri update object available, the signed release package is missing
    if (!updateRef.current) {
      setError(
        "This update cannot be installed automatically. The signed release package is not available yet. Please try again later or download manually from GitHub."
      );
      return;
    }

    setInstalling(true);
    setProgressPercent(0);
    setError(null);
    setReadyToRestart(false);

    try {
      let downloaded = 0;
      let total = 0;

      await updateRef.current.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength || 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (total > 0) {
              const percent = Math.round((downloaded / total) * 100);
              setProgressPercent(percent);
            }
            break;
          case "Finished":
            setProgressPercent(100);

            // Record this installation in history log
            const historyJson = localStorage.getItem("hyperdisk_update_history") || "[]";
            try {
              const history = JSON.parse(historyJson);
              history.push({
                version: updateRef?.current?.version,
                installedAt: new Date().toISOString(),
              });
              localStorage.setItem("hyperdisk_update_history", JSON.stringify(history));
            } catch {
              // Ignore history recording failures
            }

            // Show "Ready to Restart" state — let the user decide when to restart
            setInstalling(false);
            setReadyToRestart(true);
            break;
        }
      });
    } catch (err: any) {
      console.error("Download/install failed:", err);
      setError(err?.toString() || "Failed to download and install update");
      setInstalling(false);
      setReadyToRestart(false);
      showToast({
        message: "Installation Failed",
        description: err?.toString() || "Failed to apply update.",
        type: "error",
      });
    }
  }, [updateInfo]);

  const performRestart = useCallback(async () => {
    showToast({
      message: "Restarting HyperDisk",
      description: "Applying update and relaunching...",
      type: "success",
      duration: 2000,
    });

    // In dev mode, skip actual relaunch to preserve dev server connection
    if (import.meta.env.DEV) {
      setTimeout(() => {
        setReadyToRestart(false);
        setShowModal(false);
        setUpdateAvailable(false);
        setUpdateInfo(null);
        showToast({
          message: "Relaunch Skipped",
          description: "Relaunch is skipped in development mode to preserve the dev server connection.",
          type: "info",
        });
      }, 1000);
      return;
    }

    setTimeout(async () => {
      await relaunch();
    }, 1000);
  }, []);

  const skipUpdate = useCallback(() => {
    if (updateInfo) {
      localStorage.setItem("hyperdisk_skipped_version", updateInfo.version);
    }
    setShowModal(false);
  }, [updateInfo]);

  // Run automatically on startup
  useEffect(() => {
    checkForUpdates(false);
  }, [checkForUpdates]);

  return {
    checking,
    updateAvailable,
    updateInfo,
    installing,
    progressPercent,
    showModal,
    setShowModal,
    error,
    readyToRestart,
    checkForUpdates,
    startUpdate,
    performRestart,
    skipUpdate,
  };
}
