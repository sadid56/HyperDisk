import React from 'react';
import { Download, X, ArrowUpCircle, RotateCcw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';

interface UpdateModalProps {
  isOpen: boolean;
  version: string;
  body?: string;
  installing: boolean;
  progressPercent: number;
  readyToRestart: boolean;
  error: string | null;
  onConfirm: () => Promise<void>;
  onRestart: () => Promise<void>;
  onSkip: () => void;
  onRetry?: () => Promise<void>;
}

export const UpdateModal: React.FC<UpdateModalProps> = React.memo(({
  isOpen,
  version,
  body,
  installing,
  progressPercent,
  readyToRestart,
  error,
  onConfirm,
  onRestart,
  onSkip,
  onRetry,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-surface/90 border border-surface-border rounded-2xl shadow-2xl p-6 flex flex-col gap-5 overflow-hidden animate-in zoom-in-95 duration-200 bg-glow">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
              readyToRestart
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : error
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : 'bg-accent-purple/20 border-accent-purple/40 text-accent-purple'
            }`}>
              {readyToRestart ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : error ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <ArrowUpCircle className="w-6 h-6 animate-pulse" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">
                {readyToRestart ? 'Update Ready' : error ? 'Update Error' : 'Update Available'}
              </h2>
              <p className="text-[11px] text-text-muted mt-0.5">
                {readyToRestart
                  ? `HyperDisk v${version} has been installed successfully`
                  : error
                    ? 'Something went wrong during the update'
                    : `A new version of HyperDisk is ready (v${version})`
                }
              </p>
            </div>
          </div>
          {!installing && !readyToRestart && (
            <Button
              variant="outline"
              size="icon"
              onClick={onSkip}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl">
            <p className="text-[11px] text-rose-300 leading-relaxed">{error}</p>
          </div>
        )}

        {/* Release Notes (hidden when ready to restart or error without notes) */}
        {!readyToRestart && !error && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-text-secondary">Release Notes:</h3>
            <div className="max-h-40 overflow-y-auto p-3.5 bg-background/50 border border-surface-border rounded-xl text-[11px] text-text-muted leading-relaxed font-sans scrollbar-thin scrollbar-thumb-surface-border whitespace-pre-wrap select-text">
              {body || 'This update contains stability improvements, speed optimizations, and bug fixes.'}
            </div>
          </div>
        )}

        {/* Ready to Restart State */}
        {readyToRestart && (
          <div className="flex flex-col gap-3">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl space-y-2">
              <p className="text-xs text-emerald-300 font-semibold">Update installed successfully!</p>
              <p className="text-[11px] text-emerald-400/80 leading-relaxed">
                HyperDisk v{version} is ready. Restart the application to apply the update and enjoy the latest features.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-1">
              <Button
                variant="outline"
                onClick={onSkip}
              >
                Restart Later
              </Button>
              <Button
                variant="primary"
                onClick={onRestart}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                className="bg-emerald-600 hover:bg-emerald-700 border-emerald-500/50"
              >
                Restart Now
              </Button>
            </div>
          </div>
        )}

        {/* Download Progress */}
        {installing && !readyToRestart && (
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-accent-purple animate-pulse">Downloading & Installing...</span>
              <span className="text-text-muted">{progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-background border border-surface-border rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-accent-purple to-accent-blue rounded-full transition-all duration-300 shadow-md"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-text-muted text-center mt-1 leading-snug">
              Please do not close or interrupt the installation. You'll be asked to restart when finished.
            </p>
          </div>
        )}

        {/* Error Actions */}
        {error && !installing && !readyToRestart && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onSkip}
            >
              Close
            </Button>
            {onRetry && (
              <Button
                variant="primary"
                onClick={onRetry}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Try Again
              </Button>
            )}
          </div>
        )}

        {/* Initial Actions (not installing, not ready, no error) */}
        {!installing && !readyToRestart && !error && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onSkip}
            >
              Skip this Version
            </Button>
            <Button
              variant="primary"
              onClick={onConfirm}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Update Now
            </Button>
          </div>
        )}

      </div>
    </div>
  );
});
