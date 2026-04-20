import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getWorkspaceAncestorPaths,
  WORKSPACE_ROOT_PATH,
  WorkspaceTreeNode,
  createRootNode,
  createWorkspaceNode,
  sortDirectoryEntries,
} from './workspaceFiles';

export interface WorkspaceRevealRequest {
  path: string;
  token: number;
}

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

export function useWorkspaceTree(revealRequest?: WorkspaceRevealRequest | null, refreshToken = 0) {
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
        const nextRootNode = createRootNode(children);
        setRootNode(nextRootNode);
        setExpandedFolders((current) => {
          const nextExpandedFolders = new Set(current);
          nextExpandedFolders.add(WORKSPACE_ROOT_PATH);
          return nextExpandedFolders;
        });
        setWorkspaceAvailable(true);
        return;
      }

      setRootNode((current) => {
        if (!current) {
          return current;
        }

        const nextRootNode = updateNode(current, dirPath, (node) => ({
          ...node,
          children,
          hasLoadedChildren: true,
          isLoading: false,
        }));
        return nextRootNode;
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

        const nextRootNode = updateNode(current, dirPath, (node) => ({
          ...node,
          children: [],
          hasLoadedChildren: true,
          isLoading: false,
        }));
        return nextRootNode;
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
  }, [initializeTree, refreshToken]);

  useEffect(() => {
    if (!revealRequest?.path || workspaceAvailable !== true) {
      return;
    }

    const ancestorPaths = getWorkspaceAncestorPaths(revealRequest.path);

    setExpandedFolders((current) => {
      let next: Set<string> | null = null;

      for (const ancestorPath of ancestorPaths) {
        if (current.has(ancestorPath)) {
          continue;
        }

        if (next === null) {
          next = new Set(current);
        }

        next.add(ancestorPath);
      }

      return next ?? current;
    });

    const nextAncestorToLoad = ancestorPaths.find((ancestorPath) => {
      if (ancestorPath === WORKSPACE_ROOT_PATH) {
        return false;
      }

      const currentNode = findNode(rootNode, ancestorPath);
      return !!currentNode && currentNode.type === 'folder' && !currentNode.hasLoadedChildren && !currentNode.isLoading;
    });

    if (nextAncestorToLoad) {
      void loadDirectory(nextAncestorToLoad);
    }
  }, [loadDirectory, revealRequest, rootNode, workspaceAvailable]);

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);

      if (next.has(path)) {
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
    setExpandedFolders(new Set());
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