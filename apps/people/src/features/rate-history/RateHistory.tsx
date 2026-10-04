import type { Employee, RateInput, RateRecord } from '@baseline/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sortBy } from 'es-toolkit';
import { useState } from 'react';
import { api, keys } from '../../api/client';

interface Props {
  readonly employee: Employee;
  readonly rates: readonly RateRecord[];
  readonly oversubscribedMonths: readonly string[];
  readonly onClose: () => void;
}

/** One person's rate history: add, correct or remove records, back-dated changes included. */
export function RateHistory({ employee, rates, oversubscribedMonths, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  // Only the result of the latest action is shown, so an old error never sits next to a later success.
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const afterChange = {
    onSuccess: async () => {
      setError(null);
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: keys.rates });
    },
    onError: (failure: Error) => setError(failure.message),
  };
  const addRate = useMutation({ mutationFn: (input: RateInput) => api.addRate(employee.id, input), ...afterChange });
  const updateRate = useMutation({
    mutationFn: ({ id, input }: { id: string; input: RateInput }) => api.updateRate(id, input),
    ...afterChange,
  });
  const deleteRate = useMutation({ mutationFn: api.deleteRate, ...afterChange });

  return (
    <section className="rate-history">
      <button type="button" onClick={onClose}>
        ← All people
      </button>
      <h2>{employee.name}</h2>
      <p>
        {employee.role}, {employee.weeklyHours} h/week
      </p>
      {oversubscribedMonths.length > 0 && (
        <p className="badge-over">Oversubscribed in {oversubscribedMonths.join(', ')}</p>
      )}

      <h3>Rate history</h3>
      <p className="hint">Each rate applies from its start date until the next one starts. Rates are in EUR.</p>
      {error && <p role="alert">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Valid from</th>
            <th>Hourly cost (€)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sortBy(rates, ['validFrom']).map((rate) =>
            rate.id === editingId ? (
              <tr key={rate.id}>
                <td colSpan={3}>
                  <RateForm
                    initial={rate}
                    submitLabel="Save"
                    onSubmit={(input) => updateRate.mutate({ id: rate.id, input })}
                    onCancel={() => setEditingId(null)}
                  />
                </td>
              </tr>
            ) : (
              <tr key={rate.id}>
                <td>{rate.validFrom}</td>
                <td>{rate.hourlyCost.toFixed(2)}</td>
                <td>
                  <button type="button" onClick={() => setEditingId(rate.id)}>
                    Correct
                  </button>
                  <button
                    type="button"
                    onClick={() => window.confirm(`Remove the rate from ${rate.validFrom}?`) && deleteRate.mutate(rate.id)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <h3>Add a rate</h3>
      {/* A new key after each change empties the form. */}
      <RateForm key={rates.length} submitLabel="Add" onSubmit={(input) => addRate.mutate(input)} />
    </section>
  );
}

interface RateFormProps {
  readonly initial?: RateInput;
  readonly submitLabel: string;
  readonly onSubmit: (input: RateInput) => void;
  readonly onCancel?: () => void;
}

function RateForm({ initial, submitLabel, onSubmit, onCancel }: RateFormProps) {
  const [validFrom, setValidFrom] = useState(initial?.validFrom ?? '');
  const [hourlyCost, setHourlyCost] = useState(initial ? String(initial.hourlyCost) : '');

  return (
    <form
      className="rate-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ validFrom, hourlyCost: Number(hourlyCost) });
      }}
    >
      <label>
        Valid from <input type="date" required value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
      </label>
      <label>
        Hourly cost (€){' '}
        <input
          type="number"
          required
          min="0.01"
          step="0.01"
          value={hourlyCost}
          onChange={(event) => setHourlyCost(event.target.value)}
        />
      </label>
      <button type="submit">{submitLabel}</button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}
