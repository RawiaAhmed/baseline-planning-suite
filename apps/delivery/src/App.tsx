import type { ShellContext } from '@baseline/contracts';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, keys } from './api';
import { BreakdownTree } from './BreakdownTree';
import { useLiveUpdates } from './useLiveUpdates';
import './delivery.css';

const queryClient = new QueryClient();

/** Exposed as `delivery/App`. Same component standalone and inside the shell. */
export default function App(context: ShellContext) {
  return (
    <QueryClientProvider client={queryClient}>
      <Delivery {...context} />
    </QueryClientProvider>
  );
}

function Delivery({ activeUser }: ShellContext) {
  useLiveUpdates();
  const projects = useQuery({ queryKey: keys.projects, queryFn: api.projects });
  const [chosenProjectId, setChosenProjectId] = useState<string | null>(null);
  const projectId = chosenProjectId ?? projects.data?.[0]?.id;

  const items = useQuery({
    queryKey: keys.breakdownItems(projectId ?? ''),
    queryFn: () => api.breakdownItems(projectId ?? ''),
    enabled: projectId !== undefined,
  });
  const allocations = useQuery({ queryKey: keys.allocations, queryFn: api.allocations });

  if (projects.isPending) return <p>Loading projects…</p>;
  if (projects.isError) return <p role="alert">Could not load projects: {projects.error.message}</p>;

  const itemsWithEffort = new Set((allocations.data ?? []).map((allocation) => allocation.breakdownItemId));

  return (
    <div className="delivery">
      <h1>Delivery</h1>
      <p className="hint">Signed in as {activeUser.name}</p>

      <label>
        Project{' '}
        <select value={projectId} onChange={(event) => setChosenProjectId(event.target.value)}>
          {projects.data.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name} ({project.startDate} to {project.endDate})
            </option>
          ))}
        </select>
      </label>

      {items.isError && <p role="alert">Could not load the breakdown: {items.error.message}</p>}
      {items.data && projectId && (
        <BreakdownTree projectId={projectId} items={items.data} itemsWithEffort={itemsWithEffort} />
      )}
    </div>
  );
}
