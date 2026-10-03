import { describe, expect, it } from 'vitest';
import { buildTree, moveProblem, rollUp } from './index';

const nodes = [
  { id: 'a', parentId: null },
  { id: 'a1', parentId: 'a' },
  { id: 'a1x', parentId: 'a1' },
  { id: 'a1y', parentId: 'a1' },
  { id: 'a2', parentId: 'a' },
  { id: 'b', parentId: null },
];
const tree = buildTree(nodes);

describe('buildTree', () => {
  it('knows roots, leaves and depth', () => {
    expect(tree.roots.map((n) => n.id)).toEqual(['a', 'b']);
    expect(tree.isLeaf('a1x')).toBe(true);
    expect(tree.isLeaf('a1')).toBe(false);
    expect(tree.depthOf('a1x')).toBe(3);
  });

  it('lists every descendant', () => {
    expect(tree.descendantsOf('a').map((n) => n.id)).toEqual(['a1', 'a1x', 'a1y', 'a2']);
  });
});

describe('rollUp', () => {
  it('derives parents from children and ignores values on parents', () => {
    const values: Record<string, number> = { a1x: 1.5, a1y: 2, a2: 0.25, b: 4, a1: 999 };
    const totals = rollUp(tree, (id) => values[id] ?? 0);
    expect(totals.get('a1')).toBe(3.5);
    expect(totals.get('a')).toBe(3.75);
    expect(totals.get('b')).toBe(4);
  });
});

describe('moveProblem', () => {
  it('allows moving a leaf under another node within three levels', () => {
    expect(moveProblem(tree, 'a2', 'b')).toBeUndefined();
    expect(moveProblem(tree, 'a1x', null)).toBeUndefined();
  });

  it('refuses moving a node under itself or its own descendant', () => {
    expect(moveProblem(tree, 'a', 'a1x')).toBe('into-itself');
  });

  it('refuses a move that would make the tree four levels deep', () => {
    // a1 has children, so under a2 (level 2) its children would land on level 4
    expect(moveProblem(tree, 'a1', 'a2')).toBe('too-deep');
  });
});
