import type { ShellContext } from '@baseline/contracts';
import { isoDate, monthsBetween } from '@baseline/domain';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, keys } from './api/client';
import { BreakdownTree } from './features/breakdown/BreakdownTree';
import { StaffingGrid } from './features/staffing/StaffingGrid';
import { useLiveUpdates } from './api/useLiveUpdates';
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

type View = 'staffing' | 'breakdown';

function Delivery({ activeUser, currency }: ShellContext) {
  useLiveUpdates();
  const [view, setView] = useState<View>('staffing');
  const [chosenProjectId, setChosenProjectId] = useState<string | null>(null);

  const projects = useQuery({ queryKey: keys.projects, queryFn: api.projects });
  const project = projects.data?.find((p) => p.id === chosenProjectId) ?? projects.data?.[0];
  const items = useQuery({
    queryKey: keys.breakdownItems(project?.id ?? ''),
    queryFn: () => api.breakdownItems(project?.id ?? ''),
    enabled: project !== undefined,
  });
  const allocations = useQuery({ queryKey: keys.allocations, queryFn: api.allocations });
  // Rates and people belong to People; Delivery only reads its published API.
  const employees = useQuery({ queryKey: keys.employees, queryFn: api.employees });
  const rates = useQuery({ queryKey: keys.rates, queryFn: api.rates });

  if (projects.isPending) return <p>Loading projects…</p>;
  if (projects.isError || !project) return <p role="alert">Could not load projects: {projects.error?.message}</p>;

  const failed = [items, allocations, employees, rates].find((query) => query.isError);
  const ready = items.data && allocations.data && employees.data && rates.data;

  return (
    <div className="delivery">
      <h1>Delivery</h1>
      <p className="hint">Signed in as {activeUser.name}</p>

      <div className="toolbar">
        <label>
          Project{' '}
          <select value={project.id} onChange={(event) => setChosenProjectId(event.target.value)}>
            {projects.data.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.startDate} to {p.endDate})
              </option>
            ))}
          </select>
        </label>
        <div role="tablist">
          <button type="button" role="tab" aria-selected={view === 'staffing'} onClick={() => setView('staffing')}>
            Staffing grid
          </button>
          <button type="button" role="tab" aria-selected={view === 'breakdown'} onClick={() => setView('breakdown')}>
            Work breakdown
          </button>
        </div>
      </div>

      {failed && <p role="alert">Could not load data: {failed.error?.message}</p>}
      {!ready && !failed && <p>Loading…</p>}

      {ready && view === 'staffing' && (
        <StaffingGrid
          items={items.data}
          allocations={allocations.data}
          employees={employees.data}
          rates={rates.data}
          months={monthsBetween(isoDate(project.startDate), isoDate(project.endDate))}
          currency={currency}
        />
      )}
      {ready && view === 'breakdown' && (
        <BreakdownTree
          projectId={project.id}
          items={items.data}
          itemsWithEffort={new Set(allocations.data.map((allocation) => allocation.breakdownItemId))}
        />
      )}
    </div>
  );
}
