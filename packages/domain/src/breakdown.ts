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
}

export function buildTree<T extends BreakdownNode>(nodes: readonly T[]): BreakdownTree<T> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, T[]>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const list = children.get(node.parentId) ?? [];
    list.push(node);
    children.set(node.parentId, list);
  }

  const childrenOf = (id: string): readonly T[] => children.get(id) ?? [];

  const depthOf = (id: string): number => {
    let depth = 0;
    for (let node = byId.get(id); node; node = node.parentId === null ? undefined : byId.get(node.parentId)) {
      depth += 1;
    }
    return depth;
  };

  const descendantsOf = (id: string): T[] => childrenOf(id).flatMap((child) => [child, ...descendantsOf(child.id)]);

  return {
    roots: nodes.filter((n) => n.parentId === null),
    childrenOf,
    isLeaf: (id) => childrenOf(id).length === 0,
    depthOf,
    descendantsOf,
  };
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
