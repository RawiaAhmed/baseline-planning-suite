import type { BreakdownItem } from '@baseline/contracts';
import { buildTree, MAX_DEPTH, moveProblem, type BreakdownTree as Tree } from '@baseline/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, keys, type ItemChange, type NewItem } from '../../api/client';

interface Props {
  readonly projectId: string;
  readonly items: readonly BreakdownItem[];
  /** Leaf ids that currently hold effort; used to explain what R4 does before it happens. */
  readonly itemsWithEffort: ReadonlySet<string>;
}

/** Work breakdown of one project: create, rename, move and delete, up to three levels deep. */
export function BreakdownTree({ projectId, items, itemsWithEffort }: Props) {
  const tree = buildTree(items);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const afterChange = (successText?: string) => ({
    onSuccess: async () => {
      setMessage(successText ? { kind: 'info', text: successText } : null);
      await queryClient.invalidateQueries({ queryKey: keys.allBreakdownItems });
      await queryClient.invalidateQueries({ queryKey: keys.allocations });
    },
    onError: (failure: Error) => setMessage({ kind: 'error', text: failure.message }),
  });

  // Callbacks are passed per call, so adding a child can report the R4 effort move.
  const create = useMutation({ mutationFn: api.createItem });
  const update = useMutation({
    mutationFn: ({ id, change }: { id: string; change: ItemChange }) => api.updateItem(id, change),
    ...afterChange(),
  });
  const remove = useMutation({ mutationFn: api.deleteItem, ...afterChange() });

  const addChild = (parent: BreakdownItem, name: string) => {
    const movesEffort = itemsWithEffort.has(parent.id);
    const notice = movesEffort ? `The effort on "${parent.name}" moved to its new child "${name}".` : undefined;
    const item: NewItem = { projectId, parentId: parent.id, name };
    create.mutate(item, afterChange(notice));
  };

  const actions: NodeActions = {
    addChild,
    rename: (item, name) => update.mutate({ id: item.id, change: { name } }),
    move: (item, parentId) => update.mutate({ id: item.id, change: { parentId } }),
    remove: (item) => {
      const childCount = tree.descendantsOf(item.id).length;
      const extra = childCount > 0 ? ` and the ${childCount} items under it` : '';
      if (window.confirm(`Delete "${item.name}"${extra}, including their effort?`)) remove.mutate(item.id);
    },
  };

  return (
    <section className="breakdown">
      <h2>Work breakdown</h2>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind}>
          {message.text}
        </p>
      )}

      <ul className="tree">
        {tree.roots.map((root) => (
          <TreeNode key={root.id} item={root} tree={tree} items={items} actions={actions} />
        ))}
      </ul>

      <NameForm label="Add top-level item" onSubmit={(name) => create.mutate({ projectId, parentId: null, name }, afterChange())} />
    </section>
  );
}

interface NodeActions {
  addChild: (parent: BreakdownItem, name: string) => void;
  rename: (item: BreakdownItem, name: string) => void;
  move: (item: BreakdownItem, parentId: string | null) => void;
  remove: (item: BreakdownItem) => void;
}

interface NodeProps {
  readonly item: BreakdownItem;
  readonly tree: Tree<BreakdownItem>;
  readonly items: readonly BreakdownItem[];
  readonly actions: NodeActions;
}

type Mode = 'view' | 'rename' | 'add-child';

function TreeNode({ item, tree, items, actions }: NodeProps) {
  const [mode, setMode] = useState<Mode>('view');
  const canHaveChildren = tree.depthOf(item.id) < MAX_DEPTH;

  // Only offer destinations the move rules allow; the server checks again.
  const moveTargets = items.filter(
    (target) => target.id !== item.parentId && moveProblem(tree, item.id, target.id) === undefined,
  );

  return (
    <li>
      <div className="node">
        {mode === 'rename' ? (
          <NameForm
            label="Rename"
            initial={item.name}
            onSubmit={(name) => {
              actions.rename(item, name);
              setMode('view');
            }}
            onCancel={() => setMode('view')}
          />
        ) : (
          <span className="node-name">{item.name}</span>
        )}

        {mode === 'view' && (
          <span className="node-actions">
            {canHaveChildren && (
              <button type="button" onClick={() => setMode('add-child')}>
                Add child
              </button>
            )}
            <button type="button" onClick={() => setMode('rename')}>
              Rename
            </button>
            <select
              aria-label={`Move ${item.name}`}
              value=""
              onChange={(event) => actions.move(item, event.target.value === 'root' ? null : event.target.value)}
            >
              <option value="">Move under…</option>
              {item.parentId !== null && <option value="root">(top level)</option>}
              {moveTargets.map((target) => (
                <option key={target.id} value={target.id}>
                  {'\u00a0\u00a0'.repeat(tree.depthOf(target.id) - 1)}
                  {target.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => actions.remove(item)}>
              Delete
            </button>
          </span>
        )}
      </div>

      {mode === 'add-child' && (
        <NameForm
          label="New child"
          onSubmit={(name) => {
            actions.addChild(item, name);
            setMode('view');
          }}
          onCancel={() => setMode('view')}
        />
      )}

      {tree.childrenOf(item.id).length > 0 && (
        <ul>
          {tree.childrenOf(item.id).map((child) => (
            <TreeNode key={child.id} item={child} tree={tree} items={items} actions={actions} />
          ))}
        </ul>
      )}
    </li>
  );
}

interface NameFormProps {
  readonly label: string;
  readonly initial?: string;
  readonly onSubmit: (name: string) => void;
  readonly onCancel?: () => void;
}

function NameForm({ label, initial = '', onSubmit, onCancel }: NameFormProps) {
  const [name, setName] = useState(initial);

  return (
    <form
      className="name-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() === '') return;
        onSubmit(name.trim());
        setName('');
      }}
    >
      <input aria-label={label} placeholder={label} value={name} onChange={(event) => setName(event.target.value)} />
      <button type="submit">Save</button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}
