import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from '@tauri-apps/api/app';
import { Settings, Type, Palette, Check, Sun, Moon, Laptop, ShieldAlert, RotateCcw, BellRing } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/common/PageHeader";
import { Container } from "../components/common/Container";
import { useFullDiskAccess } from "../hooks/useFullDiskAccess";
import { showToast } from "../providers/ToastProvider";

import { ThemeMode, DEFAULT_FONTS, applyThemeMode, applyFont } from "../theme/themeManager";

interface SettingsPageProps {
  onBackToAnalyzer: () => void;
  updater: {
    checking: boolean;
    updateAvailable: boolean;
    updateInfo: { version: string; date?: string; body?: string } | null;
    installing: boolean;
    progressPercent: number;
    readyToRestart: boolean;
    error: string | null;
    checkForUpdates: (isManual: boolean) => Promise<boolean>;
    startUpdate: () => Promise<void>;
    performRestart: () => Promise<void>;
  };
}
export const SettingsPage: React.FC<SettingsPageProps> = React.memo(({ updater }) => {
  const navigate = useNavigate();
  const [selectedFont, setSelectedFont] = useState<string>("Inter");
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [systemFonts, setSystemFonts] = useState<string[]>(DEFAULT_FONTS);
  const [appVersion, setAppVersion] = useState<string>("2.0.0");
  const { hasFDA, checkFDA, requestFDA } = useFullDiskAccess();
  const [fdaDismissed, setFdaDismissed] = useState<boolean>(false);
  const isMac = navigator.userAgent.toLowerCase().includes("mac");

  // Background Tasks States
  const [autoStart, setAutoStart] = useState<boolean>(false);
  const [systemTray, setSystemTray] = useState<boolean>(true);
  const [diskMonitor, setDiskMonitor] = useState<boolean>(true);
  const [malwareMonitor, setMalwareMonitor] = useState<boolean>(true);

  // Sync background settings to Tauri backend
  const applySettings = useCallback(async (auto: boolean, tray: boolean, disk: boolean, malware: boolean) => {
    try {
      await invoke("apply_background_settings", {
        settings: {
          auto_start: auto,
          system_tray: tray,
          disk_monitor: disk,
          malware_monitor: malware,
        }
      });
    } catch (err) {
      console.error("Failed to apply settings to backend:", err);
    }
  }, []);

  const handleToggleAutoStart = useCallback(() => {
    const val = !autoStart;
    setAutoStart(val);
    localStorage.setItem("hyperdisk_auto_start", String(val));
    applySettings(val, systemTray, diskMonitor, malwareMonitor);
    showToast({
      message: val ? "Startup Enabled" : "Startup Disabled",
      description: val 
        ? "HyperDisk will now start automatically when you boot your system." 
        : "HyperDisk will no longer start on boot.",
      type: "success",
    });
  }, [autoStart, systemTray, diskMonitor, malwareMonitor, applySettings]);

  const handleToggleSystemTray = useCallback(() => {
    const val = !systemTray;
    setSystemTray(val);
    localStorage.setItem("hyperdisk_system_tray", String(val));
    applySettings(autoStart, val, diskMonitor, malwareMonitor);
    showToast({
      message: val ? "Minimize to Tray Active" : "Minimize to Tray Inactive",
      description: val 
        ? "Closing the app will now keep it running in the background system tray." 
        : "Closing the app will quit the application completely.",
      type: "success",
    });
  }, [autoStart, systemTray, diskMonitor, malwareMonitor, applySettings]);

  const handleToggleDiskMonitor = useCallback(() => {
    const val = !diskMonitor;
    setDiskMonitor(val);
    localStorage.setItem("hyperdisk_disk_monitor", String(val));
    applySettings(autoStart, systemTray, val, malwareMonitor);
    showToast({
      message: val ? "Storage Alerts Enabled" : "Storage Alerts Disabled",
      description: val 
        ? "You will receive system notifications when disk space drops below 10% or 5 GB." 
        : "Disk space monitoring alerts are now disabled.",
      type: "success",
    });
  }, [autoStart, systemTray, diskMonitor, malwareMonitor, applySettings]);

  const handleToggleMalwareMonitor = useCallback(() => {
    const val = !malwareMonitor;
    setMalwareMonitor(val);
    localStorage.setItem("hyperdisk_malware_monitor", String(val));
    applySettings(autoStart, systemTray, diskMonitor, val);
    showToast({
      message: val ? "Security Watcher Enabled" : "Security Watcher Disabled",
      description: val 
        ? "HyperDisk will notify you if suspicious files are downloaded." 
        : "Download file security monitoring is now disabled.",
      type: "success",
    });
  }, [autoStart, systemTray, diskMonitor, malwareMonitor, applySettings]);

  useEffect(() => {
    setFdaDismissed(localStorage.getItem("hyperdisk_fda_dismissed") === "true");
  }, []);

  const handleResetFdaPrompt = useCallback(() => {
    localStorage.removeItem("hyperdisk_fda_dismissed");
    setFdaDismissed(false);
    showToast({
      message: "Prompt Reset",
      description: "You will be prompted for Full Disk Access again on next startup if it remains disabled.",
      type: "success",
    });
  }, []);

  const handleCheckStatus = useCallback(async () => {
    const allowed = await checkFDA();
    if (allowed) {
      showToast({
        message: "Access Granted",
        description: "Full Disk Access is successfully enabled. HyperDisk can scan all files at maximum speed.",
        type: "success",
      });
    } else {
      showToast({
        message: "Status Checked",
        description: "Full Disk Access is not yet enabled. Please enable it in macOS System Settings.",
        type: "warning",
      });
    }
  }, [checkFDA]);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const ver = await getVersion();
        setAppVersion(ver);
      } catch (err) {
        console.warn("Failed to fetch version:", err);
      }
    };
    fetchVersion();
  }, []);

  useEffect(() => {
    const savedFont = localStorage.getItem("hyperdisk_font");
    const savedMode = (localStorage.getItem("hyperdisk_theme_mode") as ThemeMode) || "dark";

    if (savedFont) {
      setSelectedFont(savedFont);
      applyFont(savedFont);
    }

    setThemeMode(savedMode);
    applyThemeMode(savedMode);

    setAutoStart(localStorage.getItem("hyperdisk_auto_start") === "true");
    setSystemTray(localStorage.getItem("hyperdisk_system_tray") !== "false");
    setDiskMonitor(localStorage.getItem("hyperdisk_disk_monitor") !== "false");
    setMalwareMonitor(localStorage.getItem("hyperdisk_malware_monitor") !== "false");

    fetchSystemFonts();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const currentMode = (localStorage.getItem("hyperdisk_theme_mode") as ThemeMode) || "dark";
      if (currentMode === "system") {
        applyThemeMode("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const fetchSystemFonts = async () => {
    try {
      if ("queryLocalFonts" in window) {
        const fontData = await (window as any).queryLocalFonts();
        const fontFamilies: string[] = Array.from(new Set(fontData.map((f: any) => f.family)));
        if (fontFamilies.length > 0) {
          setSystemFonts(Array.from(new Set([...DEFAULT_FONTS, ...fontFamilies])));
        }
      }
    } catch (err) {
      console.warn("Local font access query failed:", err);
    }
  };

  const handleFontChange = useCallback((font: string) => {
    setSelectedFont(font);
    applyFont(font);
  }, []);

  const handleThemeChange = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    applyThemeMode(mode);
  }, []);

  const themeOptions: { mode: ThemeMode; label: string; icon: any; desc: string }[] = [
    {
      mode: "dark",
      label: "Dark Mode",
      icon: Moon,
      desc: "Dark charcoal background with vibrant violet accents",
    },
    {
      mode: "light",
      label: "Light / White Mode",
      icon: Sun,
      desc: "Pure white background with high-contrast slate text",
    },
    {
      mode: "system",
      label: "System Default",
      icon: Laptop,
      desc: "Automatically syncs with your OS light/dark preference",
    },
  ];

  return (
    <div className='flex-1 overflow-y-auto bg-background py-6 sm:py-10 select-none'>
      <Container maxWidth='6xl' className='space-y-8 animate-in fade-in zoom-in-95 duration-150'>
        <PageHeader
          title='Settings & Configuration'
          subtitle='Customize HyperDisk preferences, themes, and system font parameters'
          onBack={() => navigate("/")}
        />

        <Card className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2.5'>
              <Palette className='w-5 h-5' />
              <div>
                <h2 className='text-sm font-bold'>Change Theme</h2>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2'>
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = themeMode === opt.mode;

              return (
                <Card
                  key={opt.mode}
                  as='button'
                  variant='interactive'
                  selected={isSelected}
                  onClick={() => handleThemeChange(opt.mode)}
                  className='text-xs flex flex-col justify-between gap-4'
                >
                  <div className='flex items-center justify-between w-full'>
                    <div className='w-10 h-10 rounded-xl bg-surface border border-surface-border flex items-center justify-center'>
                      <Icon className='w-5 h-5' />
                    </div>
                    {isSelected && <Check className='w-5 h-5 shrink-0' />}
                  </div>

                  <div>
                    <h3 className='font-bold text-sm block'>{opt.label}</h3>
                    <p className='text-[11px] opacity-70 mt-1 leading-relaxed'>{opt.desc}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </Card>

        <Card className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2.5'>
              <Type className='w-5 h-5' />
              <h2 className='text-sm font-bold'>Typography & System Fonts</h2>
            </div>
          </div>

          <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-surface-border'>
            {systemFonts.map((font) => {
              const isSelected = selectedFont === font;
              return (
                <Card
                  key={font}
                  as='button'
                  variant='interactive'
                  selected={isSelected}
                  padding='sm'
                  onClick={() => handleFontChange(font)}
                  style={{ fontFamily: `"${font}", sans-serif` }}
                  className='text-xs flex items-center justify-between'
                >
                  <span className='truncate'>{font}</span>
                  {isSelected && <Check className='w-3.5 h-3.5 text-accent-purple shrink-0 ml-1' />}
                </Card>
              );
            })}
          </div>
        </Card>

        {isMac && (
          <Card className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2.5'>
                <ShieldAlert className='w-5 h-5' />
                <h2 className='text-sm font-bold'>System Permissions (macOS)</h2>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-2'>
              {/* Status Section */}
              <div className='p-4 bg-background/50 border border-surface-border rounded-xl flex flex-col justify-between gap-4'>
                <div>
                  <h3 className='font-bold text-xs text-text-primary'>Full Disk Access Status</h3>
                  <div className='flex items-center gap-2 mt-2'>
                    <span className={`w-2 h-2 rounded-full ${hasFDA ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className='text-[11px] font-bold uppercase tracking-wider'>{hasFDA ? "Access Granted" : "Access Required"}</span>
                  </div>
                  <p className='text-[10px] text-text-muted mt-2 leading-relaxed'>
                    Full Disk Access enables fast, complete scans of all folders on your drive without permissions warnings.
                  </p>
                </div>
                <div className='flex gap-2.5'>
                  {!hasFDA && (
                    <Button variant='primary' onClick={requestFDA} className='text-xs'>
                      Grant Access
                    </Button>
                  )}
                  <Button variant='outline' onClick={handleCheckStatus} className='text-xs'>
                    Check Status
                  </Button>
                </div>
              </div>

              {/* Prompt Config Section */}
              <div className='p-4 bg-background/50 border border-surface-border rounded-xl flex flex-col justify-between gap-4'>
                <div>
                  <h3 className='font-bold text-xs text-text-primary'>Startup Prompt Settings</h3>
                  <p className='text-[10px] text-text-muted mt-2 leading-relaxed'>
                    Manage whether HyperDisk prompts you on launch if Full Disk Access is not granted.
                  </p>
                  <div className='mt-3 text-[10px] font-semibold text-slate-400'>
                    Status: {fdaDismissed ? "Dismissed (Will not prompt on startup)" : "Active (Will prompt if access is missing)"}
                  </div>
                </div>
                <div>
                  <Button variant='outline' disabled={!fdaDismissed} onClick={handleResetFdaPrompt} className='w-full sm:w-auto text-xs'>
                    Reset Startup Prompt
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2.5'>
              <BellRing className='w-5 h-5 text-indigo-400' />
              <h2 className='text-sm font-bold'>Background Services & Alerts</h2>
            </div>
          </div>

          <div className='divide-y divide-surface-border/40 pt-2'>
            {/* Toggle 1: Auto Start */}
            <div className='flex items-center justify-between py-4 gap-4'>
              <div className='space-y-1'>
                <h3 className='font-bold text-xs text-text-primary'>Run on System Startup</h3>
                <p className='text-[10px] text-text-muted leading-relaxed'>
                  Automatically launch HyperDisk in the background when you turn on your system.
                </p>
              </div>
              <button
                onClick={handleToggleAutoStart}
                className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoStart ? "bg-indigo-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    autoStart ? "translate-x-4.5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 2: Minimize to Tray */}
            <div className='flex items-center justify-between py-4 gap-4'>
              <div className='space-y-1'>
                <h3 className='font-bold text-xs text-text-primary'>Keep Running in System Tray</h3>
                <p className='text-[10px] text-text-muted leading-relaxed'>
                  Minimize HyperDisk to your system tray icon when closing the window so background checks remain active.
                </p>
              </div>
              <button
                onClick={handleToggleSystemTray}
                className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  systemTray ? "bg-indigo-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    systemTray ? "translate-x-4.5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 3: Low Disk space Alert */}
            <div className='flex items-center justify-between py-4 gap-4'>
              <div className='space-y-1'>
                <h3 className='font-bold text-xs text-text-primary'>Low Disk Space Alerts</h3>
                <p className='text-[10px] text-text-muted leading-relaxed'>
                  Monitor primary disk storage and send a desktop alert if free space falls below 10% or 5 GB.
                </p>
              </div>
              <button
                onClick={handleToggleDiskMonitor}
                className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  diskMonitor ? "bg-indigo-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    diskMonitor ? "translate-x-4.5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Toggle 4: Malware watcher */}
            <div className='flex items-center justify-between py-4 gap-4'>
              <div className='space-y-1'>
                <h3 className='font-bold text-xs text-text-primary'>Download Threat Monitor</h3>
                <p className='text-[10px] text-text-muted leading-relaxed'>
                  Scan downloads for suspicious extension patterns (e.g. invoice.pdf.exe) and spoofed system filenames.
                </p>
              </div>
              <button
                onClick={handleToggleMalwareMonitor}
                className={`relative inline-flex h-5.5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  malwareMonitor ? "bg-indigo-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    malwareMonitor ? "translate-x-4.5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </Card>

        <Card className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2.5'>
              <Settings className='w-5 h-5' />
              <h2 className='text-sm font-bold'>System & Updates</h2>
            </div>
          </div>

          <div className='p-4 bg-background/50 border border-surface-border rounded-xl space-y-4'>
            <div className='flex items-center justify-between gap-4'>
              <div>
                <h3 className='font-bold text-xs text-text-primary'>Current Version: v{appVersion}</h3>
                <p className='text-[10px] text-text-muted mt-0.5'>Manage software updates and installation parameters</p>
              </div>
              <Button
                variant='outline'
                onClick={() => updater.checkForUpdates(true)}
                isLoading={updater.checking}
                disabled={updater.installing}
                className='text-xs shrink-0'
              >
                Check for Updates
              </Button>
            </div>

            {updater.updateAvailable && updater.updateInfo && (
              <div
                className={`p-4 rounded-xl space-y-3 mt-4 animate-in slide-in-from-top-4 duration-250 ${
                  updater.readyToRestart
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : updater.error
                      ? "bg-rose-500/10 border border-rose-500/30"
                      : "bg-accent-purple/10 border border-accent-purple/30"
                }`}
              >
                <div className='flex items-start justify-between'>
                  <div>
                    <h4 className='font-bold text-xs text-text-primary'>
                      {updater.readyToRestart
                        ? `Update ${updater.updateInfo.version} Ready`
                        : updater.error
                          ? "Update Failed"
                          : `New Release Available (${updater.updateInfo.version})`}
                    </h4>
                    <p className='text-[9px] text-text-muted mt-0.5'>
                      {updater.readyToRestart
                        ? "Restart HyperDisk to apply the update"
                        : updater.error
                          ? updater.error
                          : `Released on: ${updater.updateInfo.date ? new Date(updater.updateInfo.date).toLocaleDateString() : "N/A"}`}
                    </p>
                  </div>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[8px] font-bold text-white uppercase tracking-wider ${
                      updater.readyToRestart ? "bg-emerald-600" : updater.error ? "bg-rose-600" : "bg-accent-purple"
                    }`}
                  >
                    {updater.readyToRestart ? "Ready" : updater.error ? "Error" : "New"}
                  </span>
                </div>

                {!updater.readyToRestart && !updater.error && updater.updateInfo.body && (
                  <div className='text-[10px] text-text-muted bg-background/50 border border-surface-border p-2.5 rounded-lg max-h-24 overflow-y-auto leading-relaxed whitespace-pre-wrap select-text scrollbar-thin scrollbar-thumb-surface-border font-mono'>
                    {updater.updateInfo.body}
                  </div>
                )}

                {updater.readyToRestart ? (
                  <Button
                    variant='primary'
                    fullWidth
                    onClick={updater.performRestart}
                    leftIcon={<RotateCcw className='w-3 h-3' />}
                    className='text-xs bg-emerald-600 hover:bg-emerald-700 border-emerald-500/50'
                  >
                    Restart Now
                  </Button>
                ) : updater.error ? (
                  <Button variant='primary' fullWidth onClick={updater.startUpdate} leftIcon={<RotateCcw className='w-3 h-3' />} className='text-xs'>
                    Try Again
                  </Button>
                ) : updater.installing ? (
                  <div className='space-y-1.5 pt-1'>
                    <div className='flex items-center justify-between text-[10px] font-bold'>
                      <span className='text-accent-purple animate-pulse'>Installing Update...</span>
                      <span className='text-text-muted'>{updater.progressPercent}%</span>
                    </div>
                    <div className='w-full h-1.5 bg-background border border-surface-border rounded-full overflow-hidden'>
                      <div
                        className='h-full bg-gradient-to-r from-accent-purple to-accent-blue rounded-full transition-all duration-300 shadow-md'
                        style={{ width: `${updater.progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <Button variant='primary' fullWidth onClick={updater.startUpdate} className='text-xs'>
                    Update Now
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>
      </Container>
    </div>
  );
});
