import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function preserveFolderState(
  currentNode: WorkspaceTreeNode | undefined,
  nextNode: WorkspaceTreeNode,
): WorkspaceTreeNode {
  if (!currentNode || currentNode.type !== 'folder' || nextNode.type !== 'folder') {
    return nextNode;
  }

  return {
    ...nextNode,
    children: currentNode.children ?? [],
    hasLoadedChildren: currentNode.hasLoadedChildren,
    isLoading: currentNode.isLoading,
  };
}

function mergeDirectoryChildren(
  currentChildren: WorkspaceTreeNode[] | undefined,
  nextChildren: WorkspaceTreeNode[],
): WorkspaceTreeNode[] {
  const currentChildrenByPath = new Map((currentChildren ?? []).map((child) => [child.path, child]));

  return nextChildren.map((child) => preserveFolderState(currentChildrenByPath.get(child.path), child));
}

export function useWorkspaceTree(revealRequest?: WorkspaceRevealRequest | null, refreshToken = 0) {
  const [rootNode, setRootNode] = useState<WorkspaceTreeNode | null>(null);
  const [workspaceAvailable, setWorkspaceAvailable] = useState<boolean | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set([WORKSPACE_ROOT_PATH]));
  const rootNodeRef = useRef<WorkspaceTreeNode | null>(null);
  const workspaceAvailableRef = useRef<boolean | null>(null);
  const expandedFoldersRef = useRef<Set<string>>(new Set([WORKSPACE_ROOT_PATH]));

  rootNodeRef.current = rootNode;
  workspaceAvailableRef.current = workspaceAvailable;
  expandedFoldersRef.current = expandedFolders;

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
        setRootNode((current) => {
          const mergedChildren = mergeDirectoryChildren(current?.children, children);

          if (!current) {
            return createRootNode(mergedChildren);
          }

          return {
            ...current,
            children: mergedChildren,
            hasLoadedChildren: true,
            isLoading: false,
          };
        });
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
          children: mergeDirectoryChildren(node.children, children),
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

  const refreshExpandedTree = useCallback(async () => {
    const fsApi = window.electronAPI?.fs;
    if (!fsApi) {
      setWorkspaceAvailable(false);
      setRootNode(null);
      return;
    }

    try {
      const exists = await fsApi.exists(WORKSPACE_ROOT_PATH);
      if (!exists) {
        setWorkspaceAvailable(false);
        setRootNode(null);
        setExpandedFolders(new Set([WORKSPACE_ROOT_PATH]));
        return;
      }

      if (workspaceAvailableRef.current !== true || !rootNodeRef.current) {
        await loadDirectory(WORKSPACE_ROOT_PATH);
        return;
      }

      await loadDirectory(WORKSPACE_ROOT_PATH);

      const expandedPaths = Array.from(expandedFoldersRef.current).filter((path) => path !== WORKSPACE_ROOT_PATH);
      for (const expandedPath of expandedPaths) {
        await loadDirectory(expandedPath);
      }
    } catch {
      setWorkspaceAvailable(false);
      setRootNode(null);
      setExpandedFolders(new Set([WORKSPACE_ROOT_PATH]));
    }
  }, [loadDirectory]);

  useEffect(() => {
    if (refreshToken === 0) {
      return;
    }

    void refreshExpandedTree();
  }, [refreshExpandedTree, refreshToken]);

  useEffect(() => {
    if (!rootNode || workspaceAvailable !== true) {
      return;
    }

    const pathsToLoad = Array.from(expandedFolders).filter((expandedPath) => {
      if (expandedPath === WORKSPACE_ROOT_PATH) {
        return false;
      }

      const expandedNode = findNode(rootNode, expandedPath);
      return Boolean(
        expandedNode
        && expandedNode.type === 'folder'
        && !expandedNode.hasLoadedChildren
        && !expandedNode.isLoading,
      );
    });

    pathsToLoad.forEach((expandedPath) => {
      void loadDirectory(expandedPath);
    });
  }, [expandedFolders, loadDirectory, rootNode, workspaceAvailable]);

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
  }, [revealRequest, workspaceAvailable]);

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