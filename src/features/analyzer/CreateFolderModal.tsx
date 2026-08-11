import React, { useState, useEffect, useRef } from 'react';
import { useCreateFolder } from '../../hooks/useCreateFolder';
import { FolderPlus, X } from "lucide-react";
import { showToast } from '../../providers/ToastProvider';
import { FileNode } from '../../types';
import { Button } from "../../components/ui/Button";

interface CreateFolderModalProps {
  isOpen: boolean;
  parentFolder: FileNode | null;
  parentPath: string;
  onClose: () => void;
  onFolderCreated: (newPath: string, folderName: string) => void;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = React.memo(({
  isOpen,
  parentFolder,
  parentPath,
  onClose,
  onFolderCreated,
}) => {
  const [folderName, setFolderName] = useState('');
  const { createFolder, isCreating } = useCreateFolder();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFolderName('New Folder');
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen || !parentFolder) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim() || !parentFolder || !parentPath) return;

    try {
      const createdPath = await createFolder(
        parentPath,
        folderName.trim()
      );

      showToast({
        message: 'Folder Created',
        description: `Created "${folderName.trim()}" inside ${parentFolder.name}`,
        type: 'success',
      });

      onFolderCreated(createdPath, folderName.trim());
      onClose();
    } catch (err: any) {
      showToast({
        message: 'Folder Creation Failed',
        description: String(err),
        type: 'error',
      });
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150 select-none'>
      <div className='w-full max-w-md bg-surface border border-surface-border rounded-2xl shadow-2xl p-6 space-y-4'>
        {/* Modal Header */}
        <div className='flex items-center justify-between border-b border-surface-border pb-3'>
          <div className='flex items-center gap-2.5'>
            <div className='w-9 h-9 rounded-xl bg-accent-purple/15 border border-accent-purple/30 text-accent-purple flex items-center justify-center'>
              <FolderPlus className='w-5 h-5' />
            </div>
            <div>
              <h2 className='text-sm font-bold text-slate-100'>Create New Folder</h2>
              <p className='text-xs text-slate-400 font-mono truncate max-w-50' title={parentPath}>
                In {parentFolder.name}
              </p>
            </div>
          </div>
          <Button variant='ghost' size='icon' onClick={onClose}>
            <X className='w-4 h-4' />
          </Button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-1.5'>
            <label className='text-xs font-semibold text-slate-300'>Folder Name</label>
            <input
              ref={inputRef}
              type='text'
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder='e.g. My_Folder'
              disabled={isCreating}
              className='w-full px-3 py-2 rounded-xl bg-background border border-surface-border text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-accent-purple font-medium'
            />
          </div>

          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='secondary' onClick={onClose} disabled={isCreating}>
              Cancel
            </Button>

            <Button
              type='submit'
              variant='primary'
              isLoading={isCreating}
              disabled={!folderName.trim()}
              leftIcon={<FolderPlus className='w-3.5 h-3.5' />}
            >
              Create Folder
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
});
