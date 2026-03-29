import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  WORKSPACE_ROOT_PATH,
  WorkspaceTreeNode,
  createRootNode,
  createWorkspaceNode,
  sortDirectoryEntries,
} from './workspaceFiles';

function updateNode(
  node: WorkspaceTreeNode,
  targetPath: string,
  updater: (current: WorkspaceTreeNode) => WorkspaceTreeNode,
): WorkspaceTreeNode {
  if (node.path === targetPath) {
    return updater(node);
  }

  if (node.type === 'file' || !node.children || node.children.length === 0) {
    return node;
  }

  let changed = false;
  const nextChildren = node.children.map((child) => {
    const nextChild = updateNode(child, targetPath, updater);
    if (nextChild !== child) {
      changed = true;
    }
    return nextChild;
  });

  if (!changed) {
    return node;
  }

  return { ...node, children: nextChildren };
}

function findNode(node: WorkspaceTreeNode | null, targetPath: string): WorkspaceTreeNode | null {
  if (!node) {
    return null;
  }

  if (node.path === targetPath) {
    return node;
  }

  if (!node.children) {
    return null;
  }

  for (const child of node.children) {
    const match = findNode(child, targetPath);
    if (match) {
      return match;
    }
  }

  return null;
}

export function useWorkspaceTree() {
  const [rootNode, setRootNode] = useState<WorkspaceTreeNode | null>(null);
  const [workspaceAvailable, setWorkspaceAvailable] = useState<boolean | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set([WORKSPACE_ROOT_PATH]));

  const loadDirectory = useCallback(async (dirPath: string) => {
    const fsApi = window.electronAPI?.fs;
    if (!fsApi) {
      setWorkspaceAvailable(false);
      return;
    }

    if (dirPath !== WORKSPACE_ROOT_PATH) {
      setRootNode((current) => {
        if (!current) {
          return current;
        }

        return updateNode(current, dirPath, (node) => ({ ...node, isLoading: true }));
      });
    }

    try {
      const entries = sortDirectoryEntries(await fsApi.readDir(dirPath));
      const children = entries.map((entry) => createWorkspaceNode(dirPath, entry));

      if (dirPath === WORKSPACE_ROOT_PATH) {
        setRootNode(createRootNode(children));
        setExpandedFolders(new Set([WORKSPACE_ROOT_PATH]));
        setWorkspaceAvailable(true);
        return;
      }

      setRootNode((current) => {
        if (!current) {
          return current;
        }

        return updateNode(current, dirPath, (node) => ({
          ...node,
          children,
          hasLoadedChildren: true,
          isLoading: false,
        }));
      });
    } catch {
      if (dirPath === WORKSPACE_ROOT_PATH) {
        setRootNode(null);
        setWorkspaceAvailable(false);
        setExpandedFolders(new Set([WORKSPACE_ROOT_PATH]));
        return;
      }

      setRootNode((current) => {
        if (!current) {
          return current;
        }

        return updateNode(current, dirPath, (node) => ({
          ...node,
          children: [],
          hasLoadedChildren: true,
          isLoading: false,
        }));
      });
    }
  }, []);

  const initializeTree = useCallback(async () => {
    const fsApi = window.electronAPI?.fs;
    if (!fsApi) {
      setWorkspaceAvailable(false);
      setRootNode(null);
      return;
    }

    setWorkspaceAvailable(null);

    try {
      const exists = await fsApi.exists(WORKSPACE_ROOT_PATH);
      if (!exists) {
        setWorkspaceAvailable(false);
        setRootNode(null);
        setExpandedFolders(new Set([WORKSPACE_ROOT_PATH]));
        return;
      }

      await loadDirectory(WORKSPACE_ROOT_PATH);
    } catch {
      setWorkspaceAvailable(false);
      setRootNode(null);
      setExpandedFolders(new Set([WORKSPACE_ROOT_PATH]));
    }
  }, [loadDirectory]);

  useEffect(() => {
    void initializeTree();
  }, [initializeTree]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);

      if (next.has(path) && path !== WORKSPACE_ROOT_PATH) {
        next.delete(path);
        return next;
      }

      next.add(path);
      return next;
    });

    const currentNode = findNode(rootNode, path);
    if (currentNode && currentNode.type === 'folder' && !currentNode.hasLoadedChildren && !currentNode.isLoading) {
      void loadDirectory(path);
    }
  }, [loadDirectory, rootNode]);

  const refreshTree = useCallback(() => {
    void initializeTree();
  }, [initializeTree]);

  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set([WORKSPACE_ROOT_PATH]));
  }, []);

  const treeNodes = useMemo(() => (rootNode ? [rootNode] : []), [rootNode]);

  return {
    treeNodes,
    workspaceAvailable,
    expandedFolders,
    toggleFolder,
    refreshTree,
    collapseAll,
  };
}