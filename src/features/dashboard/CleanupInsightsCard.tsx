import React from "react";
import { Sparkles, HardDrive } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

import { Skeleton } from "../../components/ui/Skeleton";

interface CleanupInsightsCardProps {
  junkSizeStr: string;
  tempSizeStr: string;
  isLoading?: boolean;
  onNavigateTab: (tab: string) => void;
}

export const CleanupInsightsCard: React.FC<CleanupInsightsCardProps> = ({
  junkSizeStr,
  tempSizeStr,
  isLoading,
  onNavigateTab,
}) => {
  if (isLoading) {
    return (
      <Card variant="default" padding="md" className="space-y-4 relative overflow-hidden">
        <div>
          <Skeleton width={120} height={12} rounded="sm" />
          <Skeleton width={150} height={8} rounded="sm" className="mt-2" />
        </div>
        <div className="space-y-3 pt-2">
          <div className="flex justify-between items-center">
            <Skeleton width={90} height={10} rounded="sm" />
            <Skeleton width={60} height={10} rounded="sm" />
          </div>
          <div className="flex justify-between items-center">
            <Skeleton width={110} height={10} rounded="sm" />
            <Skeleton width={70} height={10} rounded="sm" />
          </div>
        </div>
        <div className="pt-2">
          <Skeleton height={32} rounded="md" className="w-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card variant="default" padding="md" className="space-y-4 relative overflow-hidden">
      <div>
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Cleanup & Insights</h3>
        <p className="text-[9px] text-slate-500 font-bold mt-0.5">Actionable recommendations</p>
      </div>

      <div className="space-y-2.5">
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-slate-400 flex items-center gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            System Junk:
          </span>
          <span className="font-mono text-slate-200 font-bold">{junkSizeStr}</span>
        </div>
        <div className="flex justify-between items-center text-xs font-semibold">
          <span className="text-slate-400 flex items-center gap-1.5 font-bold">
            <HardDrive className="w-3.5 h-3.5" />
            Temporary Files:
          </span>
          <span className="font-mono text-slate-200 font-bold">{tempSizeStr}</span>
        </div>
      </div>

      <Button
        onClick={() => onNavigateTab("cleanup")}
        variant="primary"
        className="w-full"
      >
        Analyze & Clean Now
      </Button>
    </Card>
  );
};
