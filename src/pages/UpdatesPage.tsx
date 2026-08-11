import React, { useState, useEffect, useCallback } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { RefreshCw, CheckCircle2, History, Trash2, ArrowUpCircle, ShieldCheck } from "lucide-react";
import { showToast } from '../providers/ToastProvider';
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/common/PageHeader";
import { Container } from "../components/common/Container";

interface UpdatesPageProps {
  onBack: () => void;
  updater: {
    checking: boolean;
    updateAvailable: boolean;
    updateInfo: { version: string; date?: string; body?: string } | null;
    installing: boolean;
    progressPercent: number;
    checkForUpdates: (isManual: boolean) => Promise<boolean>;
    startUpdate: () => Promise<void>;
  };
}

interface UpdateHistoryItem {
  version: string;
  installedAt: string;
}

export const UpdatesPage: React.FC<UpdatesPageProps> = React.memo(({ onBack, updater }) => {
  const [currentVersion, setCurrentVersion] = useState<string>('2.0.0');
  const [history, setHistory] = useState<UpdateHistoryItem[]>([]);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const ver = await getVersion();
        setCurrentVersion(ver);
      } catch (err) {
        console.warn('Failed to fetch app version from Tauri:', err);
      }
    };
    fetchVersion();
    loadHistory();
  }, []);

  const loadHistory = () => {
    const historyJson = localStorage.getItem('hyperdisk_update_history') || '[]';
    try {
      setHistory(JSON.parse(historyJson));
    } catch {
      setHistory([]);
    }
  };

  const handleClearHistory = useCallback(() => {
    localStorage.removeItem('hyperdisk_update_history');
    setHistory([]);
    showToast({
      message: 'History Cleared',
      description: 'Update installation log history has been deleted.',
      type: 'success',
    });
  }, []);


  const handleManualCheck = useCallback(async () => {
    await updater.checkForUpdates(true);
  }, [updater]);

  return (
    <div className='flex-1 overflow-y-auto bg-background py-6 sm:py-10 select-none'>
      <Container maxWidth='6xl' className='space-y-8 animate-in fade-in zoom-in-95 duration-150'>
        {/* Navigation Header */}
        <PageHeader title='Software Updates' subtitle='Manage and check application version controls' onBack={onBack} />

        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          {/* Main updates card */}
          <div className='md:col-span-2 space-y-6'>
            <Card className='space-y-5'>
              <h2 className='text-sm font-bold text-text-primary flex items-center gap-2'>
                <ArrowUpCircle className='w-4.5 h-4.5' />
                <span>System Update Status</span>
              </h2>

              {/* Update Info Display */}
              {updater.updateAvailable && updater.updateInfo ? (
                <div className='p-4 bg-accent-purple/10 border border-accent-purple/30 rounded-xl space-y-3'>
                  <div className='flex items-start justify-between'>
                    <div>
                      <h3 className='font-bold text-sm text-text-primary'>New Release Available (v{updater.updateInfo.version})</h3>
                      <p className='text-[10px] text-text-muted mt-0.5'>
                        Released on: {updater.updateInfo.date ? new Date(updater.updateInfo.date).toLocaleDateString() : "N/A"}
                      </p>
                    </div>
                    <span className='px-2 py-0.5 rounded-full text-[9px] font-bold bg-accent-purple text-white uppercase tracking-wider'>
                      New
                    </span>
                  </div>

                  {updater.updateInfo.body && (
                    <div className='text-[11px] text-text-muted bg-background/50 border border-surface-border p-3 rounded-lg max-h-24 overflow-y-auto leading-relaxed whitespace-pre-wrap select-text scrollbar-thin scrollbar-thumb-surface-border'>
                      {updater.updateInfo.body}
                    </div>
                  )}

                  {updater.installing ? (
                    <div className='space-y-2 pt-1'>
                      <div className='flex items-center justify-between text-xs font-semibold'>
                        <span className='text-accent-purple animate-pulse'>Installing Update...</span>
                        <span className='text-text-muted'>{updater.progressPercent}%</span>
                      </div>
                      <div className='w-full h-2 bg-background border border-surface-border rounded-full overflow-hidden'>
                        <div
                          className='h-full bg-gradient-to-r from-accent-purple to-accent-blue rounded-full transition-all duration-300 shadow-md'
                          style={{ width: `${updater.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <Button variant='primary' fullWidth onClick={updater.startUpdate} leftIcon={<RefreshCw className='w-3.5 h-3.5' />}>
                      Update to {updater.updateInfo.version} Now
                    </Button>
                  )}
                </div>
              ) : (
                <div className='flex items-center gap-4 p-4 bg-background/40 border border-surface-border rounded-xl'>
                  <CheckCircle2 className='w-8 h-8 text-emerald-500 shrink-0' />
                  <div>
                    <h3 className='font-bold text-sm text-text-primary'>AeroDisk is Up to Date</h3>
                    <p className='text-[11px] text-text-muted mt-0.5'>Current Installed Version: v{currentVersion}</p>
                  </div>
                </div>
              )}

              {/* Manual Trigger Section */}
              <div className='flex items-center justify-between pt-2 border-t border-surface-border/40'>
                <div className='text-[11px] text-text-muted'>Last checked: {new Date().toLocaleTimeString()}</div>
                <Button
                  variant='outline'
                  onClick={handleManualCheck}
                  isLoading={updater.checking}
                  disabled={updater.installing}
                  leftIcon={<RefreshCw className='w-3.5 h-3.5' />}
                >
                  Check for Updates
                </Button>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className='space-y-6'>
            <Card className='space-y-4'>
              <div className='flex items-center justify-between'>
                <h2 className='text-xs font-bold text-text-primary flex items-center gap-2'>
                  <History className='w-4 h-4 text-accent-blue' />
                  <span>Installation Log</span>
                </h2>
                {history.length > 0 && (
                  <Button variant='ghost' size='icon' onClick={handleClearHistory} title='Clear installation log history'>
                    <Trash2 className='w-3.5 h-3.5 text-rose-400' />
                  </Button>
                )}
              </div>

              <div className='text-[9px] text-text-muted leading-relaxed pt-4 border-t border-surface-border/30'>
                <h3 className='font-bold text-sm text-text-primary flex items-center gap-2 mb-2'>
                  <ShieldCheck className='w-4 h-4 text-emerald-400' />
                  Automatic & Secure Updates
                </h3>
                HyperDisk auto-downloads packages securely from official release targets.
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  );
});
