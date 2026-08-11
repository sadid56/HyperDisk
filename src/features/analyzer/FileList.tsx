import React, { useMemo, useState } from 'react';
import { MoreVertical, Search } from 'lucide-react';
import { FileNode } from '../../types';
import { formatBytes, formatDate, getFileCategory } from "../../utils/formatters";
import { Skeleton } from "../../components/ui/Skeleton";

interface FileListItemProps {
  child: FileNode;
  isHovered: boolean;
  isSelected: boolean;
  onSelectNode: (node: FileNode) => void;
  onNavigate: (nodeId: number) => void;
  onHoverNode: (node: FileNode | null) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
}

const FileListItem = React.memo<FileListItemProps>(({
  child,
  isHovered,
  isSelected,
  onSelectNode,
  onNavigate,
  onHoverNode,
  onContextMenu
}) => {
  const category = getFileCategory(child.name, child.isDirectory);
  const Icon = category.Icon;
  return (
    <div
      onClick={() => onSelectNode(child)}
      onDoubleClick={() => {
        if (child.isDirectory) onNavigate(child.id);
      }}
      onMouseEnter={() => onHoverNode(child)}
      onMouseLeave={() => onHoverNode(null)}
      onContextMenu={(e) => onContextMenu(e, child)}
      className={`group flex items-center gap-3 px-4 py-2.5 transition-all cursor-pointer text-xs border-l-2 border-b ${
        isHovered || isSelected
          ? "bg-surface-hover/90 border-sky-500 border-b-transparent"
          : "bg-transparent border-transparent border-b-surface-border/50 hover:bg-surface/60"
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${category.color}`} />

      <div className='flex-1 min-w-0'>
        <div className='flex items-center justify-between gap-2'>
          <span className='font-medium text-slate-200 truncate group-hover:text-white' title={child.name}>
            {child.name}
          </span>
        </div>
        {child.createdAt && <p className='text-[10px] text-slate-500 mt-0.5'>{formatDate(child.createdAt)}</p>}
      </div>
      {child.isSymlink ? (
        <span className='px-1.5 py-0.5 rounded bg-slate-900/10 dark:bg-slate-800/80 text-[10px] text-slate-400 border border-surface-border font-semibold shrink-0 select-none' title="Symbolic Link (Skipped to prevent double counting)">
          Symlink
        </span>
      ) : (
        <span className='font-mono text-[11px] text-slate-400 font-semibold shrink-0'>{formatBytes(child.size)}</span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu(e, child);
        }}
        className='p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-surface-border/50 opacity-0 group-hover:opacity-100 transition-opacity'
        title='More actions'
      >
        <MoreVertical className='w-4 h-4' />
      </button>
    </div>
  );
});

FileListItem.displayName = "FileListItem";

interface FileListProps {
  activeNode: FileNode | null;
  flatNodes: FileNode[];
  searchQuery: string;
  isScanning?: boolean;
  hoveredNode: FileNode | null;
  selectedNode: FileNode | null;
  onHoverNode: (node: FileNode | null) => void;
  onSelectNode: (node: FileNode) => void;
  onNavigate: (nodeId: number) => void;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
}

const MAX_SEARCH_RESULTS = 100;

export const FileList: React.FC<FileListProps> = React.memo(
  ({ activeNode, flatNodes, searchQuery, isScanning, hoveredNode, selectedNode, onHoverNode, onSelectNode, onNavigate, onContextMenu }) => {
    const isSearching = searchQuery.trim().length > 0;
    const [limit, setLimit] = useState(100);
    const [prevActiveNodeId, setPrevActiveNodeId] = useState<number | null>(null);

    // Reset pagination limit when navigating to a different directory
    if (activeNode && activeNode.id !== prevActiveNodeId) {
      setLimit(100);
      setPrevActiveNodeId(activeNode.id);
    }

    const { displayChildren } = useMemo(() => {
      if (!activeNode) return { displayChildren: [], totalMatches: 0 };

      if (isSearching) {
        const q = searchQuery.toLowerCase().trim();
        const matches: FileNode[] = [];

        for (let i = 0; i < flatNodes.length; i++) {
          const node = flatNodes[i];
          if (node && node.name && node.name.toLowerCase().includes(q)) {
            matches.push(node);
            if (matches.length >= MAX_SEARCH_RESULTS) {
              break;
            }
          }
        }

        return { displayChildren: matches, totalMatches: matches.length };
      }

      if (Array.isArray(activeNode.childIds)) {
        const children = activeNode.childIds.map((id) => flatNodes[id]).filter((n): n is FileNode => Boolean(n));
        return { displayChildren: children, totalMatches: children.length };
      }

      return { displayChildren: [], totalMatches: 0 };
    }, [activeNode, flatNodes, searchQuery, isSearching]);

    // Limit rendering for superior performance on folders with thousands of files
    const visibleChildren = useMemo(() => {
      return displayChildren.slice(0, limit);
    }, [displayChildren, limit]);

    if (!activeNode || (isScanning && displayChildren.length === 0)) {
      return (
        <div className='flex-1 flex flex-col min-h-0'>
          <div className='flex-1 overflow-hidden divide-y divide-surface-border/50'>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className='flex items-center gap-3 px-4 py-2.5 border-l-2 border-transparent'>
                <Skeleton width={16} height={16} rounded='sm' className='shrink-0' delayMs={i * 50} />
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center justify-between gap-2'>
                    <Skeleton height={12} rounded='sm' style={{ width: `${40 + ((i * 17) % 45)}%` }} delayMs={i * 50} />
                    <Skeleton width={48} height={12} rounded='sm' className='shrink-0' delayMs={i * 50} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (displayChildren.length === 0) {
      return (
        <div className='flex-1 flex items-center justify-center p-6 text-slate-500 text-xs font-medium'>
          {isSearching ? `No matches found for "${searchQuery}"` : "This folder contains no items."}
        </div>
      );
    }

    return (
      <div className='flex-1 flex flex-col min-h-0'>
        {isSearching && (
          <div className='px-4 py-1.5 bg-accent-purple/10 border-b border-accent-purple/20 text-[11px] text-accent-purple font-medium flex items-center justify-between'>
            <span className='flex items-center gap-1.5'>
              <Search className='w-3 h-3' />
              Showing top {displayChildren.length} search matches
            </span>
            <span className='text-[10px] text-slate-400'>Limited for speed</span>
          </div>
        )}

        <div className='flex-1 overflow-y-scroll overflow-x-hidden scrollbar-stable divide-y divide-surface-border/50'>
          {visibleChildren.map((child) => (
            <FileListItem
              key={child.id}
              child={child}
              isHovered={hoveredNode?.id === child.id}
              isSelected={selectedNode?.id === child.id}
              onSelectNode={onSelectNode}
              onNavigate={onNavigate}
              onHoverNode={onHoverNode}
              onContextMenu={onContextMenu}
            />
          ))}

          {displayChildren.length > limit && (
            <div className='p-3.5 flex justify-center bg-surface/10 border-t border-surface-border/30'>
              <button
                onClick={() => setLimit((prev) => prev + 150)}
                className='px-4 py-1.5 rounded-lg text-xs font-semibold text-accent-purple border border-accent-purple/20 bg-accent-purple/5 hover:bg-accent-purple/15 hover:border-accent-purple/35 transition-all cursor-pointer'
              >
                Show more (+{displayChildren.length - limit} items remaining)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  },
);



