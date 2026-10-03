import { groupBy, keyBy } from 'es-toolkit';

/** A node of a project's work breakdown. `parentId` is null at the root. */
export interface BreakdownNode {
  readonly id: string;
  readonly parentId: string | null;
}

/** The deepest level allowed: root = 1, child = 2, grandchild = 3. */
export const MAX_DEPTH = 3;

export interface BreakdownTree<T extends BreakdownNode> {
  readonly roots: readonly T[];
  childrenOf(id: string): readonly T[];
  isLeaf(id: string): boolean;
  /** Root = 1. */
  depthOf(id: string): number;
  /** All nodes below `id`, not including itself. */
  descendantsOf(id: string): readonly T[];
  /** Levels from `id` down to its deepest descendant; a leaf is 1. */
  heightOf(id: string): number;
}

export function buildTree<T extends BreakdownNode>(nodes: readonly T[]): BreakdownTree<T> {
  const byId = keyBy(nodes, (node) => node.id);
  const childrenByParent = groupBy(nodes, (node) => node.parentId ?? '');

  const childrenOf = (id: string): readonly T[] => childrenByParent[id] ?? [];

  const depthOf = (id: string): number => {
    const parentId = byId[id]?.parentId;
    return parentId ? 1 + depthOf(parentId) : 1;
  };

  const descendantsOf = (id: string): T[] => childrenOf(id).flatMap((child) => [child, ...descendantsOf(child.id)]);

  const heightOf = (id: string): number => 1 + Math.max(0, ...childrenOf(id).map((child) => heightOf(child.id)));

  return {
    roots: childrenOf(''),
    childrenOf,
    isLeaf: (id) => childrenOf(id).length === 0,
    depthOf,
    descendantsOf,
    heightOf,
  };
}

export type MoveProblem = 'into-itself' | 'too-deep';

/** Why `id` cannot be moved under `newParentId` (null = make it a root), or undefined when it can. */
export function moveProblem<T extends BreakdownNode>(
  tree: BreakdownTree<T>,
  id: string,
  newParentId: string | null,
): MoveProblem | undefined {
  if (newParentId === null) return undefined;

  const ownSubtree = [id, ...tree.descendantsOf(id).map((node) => node.id)];
  if (ownSubtree.includes(newParentId)) return 'into-itself';

  if (tree.depthOf(newParentId) + tree.heightOf(id) > MAX_DEPTH) return 'too-deep';

  return undefined;
}

/**
 * Sums leaf values up the tree. Parents are derived only: a parent's own
 * value is ignored, it is always the sum of its children.
 */
export function rollUp<T extends BreakdownNode>(tree: BreakdownTree<T>, leafValue: (leafId: string) => number): Map<string, number> {
  const totals = new Map<string, number>();
  const visit = (node: T): number => {
    const children = tree.childrenOf(node.id);
    const total = children.length === 0 ? leafValue(node.id) : children.reduce((sum, child) => sum + visit(child), 0);
    totals.set(node.id, total);
    return total;
  };
  tree.roots.forEach(visit);
  return totals;
}
