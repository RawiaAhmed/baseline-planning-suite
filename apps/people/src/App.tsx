import type { ShellContext } from '@baseline/contracts';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api, keys } from './api';
import { oversubscribedMonths } from './oversubscription';
import { RateHistory } from './RateHistory';
import { Register } from './Register';
import { useLiveUpdates } from './useLiveUpdates';
import './people.css';

const queryClient = new QueryClient();

/** Exposed as `people/App`. Same component standalone and inside the shell. */
export default function App(context: ShellContext) {
  return (
    <QueryClientProvider client={queryClient}>
      <People {...context} />
    </QueryClientProvider>
  );
}

function People({ activeUser }: ShellContext) {
  useLiveUpdates();
  const [openId, setOpenId] = useState<string | null>(null);

  const employees = useQuery({ queryKey: keys.employees, queryFn: api.employees });
  const rates = useQuery({ queryKey: keys.rates, queryFn: api.rates });
  // Capacity is a nice-to-have here: if Delivery is down, People still works without the badges.
  const usage = useQuery({ queryKey: keys.capacityUsage, queryFn: api.capacityUsage });

  if (employees.isPending || rates.isPending) return <p>Loading people…</p>;
  if (employees.isError || rates.isError) {
    return <p role="alert">Could not load people: {(employees.error ?? rates.error)?.message}</p>;
  }

  const oversubscribed = oversubscribedMonths(employees.data, usage.data ?? []);
  const openEmployee = employees.data.find((employee) => employee.id === openId);

  return (
    <div className="people">
      <h1>People</h1>
      <p className="hint">Signed in as {activeUser.name}</p>
      {usage.isError && <p className="hint">Capacity data is unavailable, so oversubscription is not shown.</p>}

      {openEmployee ? (
        <RateHistory
          employee={openEmployee}
          rates={rates.data.filter((rate) => rate.employeeId === openEmployee.id)}
          oversubscribedMonths={oversubscribed.get(openEmployee.id) ?? []}
          onClose={() => setOpenId(null)}
        />
      ) : (
        <Register employees={employees.data} oversubscribed={oversubscribed} onOpen={setOpenId} />
      )}
    </div>
  );
}
