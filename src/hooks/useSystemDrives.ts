import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SystemDrive, UserFolder } from '../types';

export function useSystemDrives() {
  const [drives, setDrives] = useState<SystemDrive[]>([]);
  const [folders, setFolders] = useState<UserFolder[]>([]);
  const [systemRootFolders, setSystemRootFolders] = useState<UserFolder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [foldersLoading, setFoldersLoading] = useState<boolean>(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    setFoldersLoading(true);
    try {
      const [fetchedDrives, fetchedFolders, fetchedSystemRoot] = await Promise.all([
        invoke<SystemDrive[]>('fetch_system_drives'),
        invoke<UserFolder[]>('fetch_user_folders'),
        invoke<UserFolder[]>('fetch_system_root_folders'),
      ]);
      setDrives(fetchedDrives || []);
      setFolders(fetchedFolders || []);
      setSystemRootFolders(fetchedSystemRoot || []);

      const sizePromises: Promise<void>[] = [];

      // Kick off background size fetching
      if (fetchedFolders && fetchedFolders.length > 0) {
        fetchedFolders.forEach((folder, idx) => {
          const p = invoke<number>('fetch_folder_size', { path: folder.path })
            .then(size => {
              setFolders(prev => {
                const newFolders = [...prev];
                if (newFolders[idx]) {
                  newFolders[idx].size = size;
                }
                return newFolders;
              });
            })
            .catch(console.error);
          sizePromises.push(p);
        });
      }

      if (fetchedSystemRoot && fetchedSystemRoot.length > 0) {
        fetchedSystemRoot.forEach((folder, idx) => {
          const p = invoke<number>('fetch_folder_size', { path: folder.path })
            .then(size => {
              setSystemRootFolders(prev => {
                const newFolders = [...prev];
                if (newFolders[idx]) {
                  newFolders[idx].size = size;
                }
                return newFolders;
              });
            })
            .catch(console.error);
          sizePromises.push(p);
        });
      }

      Promise.all(sizePromises).finally(() => {
        setFoldersLoading(false);
      });

    } catch (err) {
      console.error('Failed to fetch system drives or user folders:', err);
      setFoldersLoading(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    drives,
    folders,
    systemRootFolders,
    loading,
    foldersLoading,
    refetch,
  };
}
