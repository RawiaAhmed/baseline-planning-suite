import type { Allocation, BreakdownItem, DisplayCurrency, Employee, RateRecord } from '@baseline/contracts';
import { DECIMALS, isoDate, toHours, type DisplayUnit, type YearMonth } from '@baseline/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { api, keys } from '../../api/client';
import { buildGrid, type GridCell, type GridRow } from './staffing';

const UNITS: { unit: DisplayUnit; label: string }[] = [
  { unit: 'personMonths', label: 'PM' },
  { unit: 'hours', label: 'Hours' },
  { unit: 'percent', label: '%' },
  { unit: 'cost', label: 'Cost' },
];

const NO_RATE_MESSAGE = 'This month has no rate yet, so a cost cannot be turned into hours. Enter hours instead.';

interface Props {
  readonly items: readonly BreakdownItem[];
  readonly allocations: readonly Allocation[];
  readonly employees: readonly Employee[];
  readonly rates: readonly RateRecord[];
  readonly months: readonly YearMonth[];
  readonly currency: DisplayCurrency;
}

/** People × months for one project. Leaf cells are editable; parent rows are derived and read-only. */
export function StaffingGrid({ items, allocations, employees, rates, months, currency }: Props) {
  const [unit, setUnit] = useState<DisplayUnit>('personMonths');
  const [addedPeople, setAddedPeople] = useState<ReadonlyMap<string, readonly string[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: api.setAllocation,
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: keys.allocations });
    },
    onError: (failure: Error) => setError(failure.message),
  });

  const rows = buildGrid({ items, allocations, employees, rates, months, unit, perEuro: currency.perEuro, addedPeople });
  const decimals = DECIMALS[unit];
  const unitLabel = unit === 'cost' ? currency.code : (UNITS.find((u) => u.unit === unit)?.label ?? unit);

  /** Typed value in the current unit → hours, then saved. */
  const saveCell = (row: Extract<GridRow, { kind: 'person' }>, month: YearMonth, typed: number) => {
    const valueInEuro = unit === 'cost' ? typed / currency.perEuro : typed;
    const rateRecords = rates.filter((rate) => rate.employeeId === row.employee.id);
    const result = toHours(valueInEuro, unit, {
      month,
      weeklyHours: row.employee.weeklyHours,
      rates: rateRecords.map((rate) => ({ ...rate, validFrom: isoDate(rate.validFrom) })),
    });
    if (!result.ok) {
      setError(result.reason === 'no-rate' ? NO_RATE_MESSAGE : 'Enter a number of zero or more.');
      return;
    }
    // Keep the row on screen even if this edit clears the person's last hours.
    keepPerson(row.item.id, row.employee.id);
    save.mutate({ breakdownItemId: row.item.id, employeeId: row.employee.id, month, hours: result.hours });
  };

  const keepPerson = (leafId: string, employeeId: string) =>
    setAddedPeople((current) => {
      const people = current.get(leafId) ?? [];
      return people.includes(employeeId) ? current : new Map(current).set(leafId, [...people, employeeId]);
    });

  return (
    <section className="staffing">
      <h2>Staffing</h2>
      <div className="unit-switch" role="group" aria-label="Unit">
        {UNITS.map(({ unit: option, label }) => (
          <button key={option} type="button" aria-pressed={unit === option} onClick={() => setUnit(option)}>
            {option === 'cost' ? `${label} (${currency.code})` : label}
          </button>
        ))}
      </div>
      <p className="hint">
        † over capacity across all projects; this is the latest edit that caused it. * effort before the person’s first
        rate, costed at zero.
      </p>
      {error && <p role="alert">{error}</p>}

      <div className="grid-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th>Work package / person ({unitLabel})</th>
              {months.map((month) => (
                <th key={month}>{format(parseISO(`${month}-01`), 'MMM yy')}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className={row.kind === 'item' ? 'item-row' : 'person-row'}>
                <th scope="row" style={{ paddingLeft: `${row.depth * 16}px` }}>
                  {row.kind === 'item' ? row.item.name : row.employee.name}
                  {row.kind === 'item' && !row.isLeaf && <span className="derived"> derived</span>}
                  {row.kind === 'item' && row.isLeaf && (
                    <AddPerson
                      employees={employees}
                      onAdd={(employeeId) => keepPerson(row.item.id, employeeId)}
                      exclude={rows.flatMap((r) => (r.kind === 'person' && r.item.id === row.item.id ? [r.employee.id] : []))}
                    />
                  )}
                </th>
                {row.cells.map((cell) => (
                  <td key={cell.month} className={cellClass(cell)} title={cellTitle(cell)}>
                    {row.kind === 'person' ? (
                      <CellInput
                        value={cell.value}
                        decimals={decimals}
                        label={`${row.employee.name}, ${row.item.name}, ${cell.month}`}
                        onCommit={(typed) => saveCell(row, cell.month, typed)}
                      />
                    ) : (
                      formatNumber(cell.value, decimals)
                    )}
                    {cell.overCapacity && <span aria-label="over capacity"> †</span>}
                    {cell.unpriced && <span aria-label="before first rate"> *</span>}
                  </td>
                ))}
                <td className="total">{formatNumber(row.total, decimals)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const formatNumber = (value: number, decimals: number): string =>
  value.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function cellClass(cell: GridCell): string | undefined {
  if (cell.overCapacity) return 'over';
  if (cell.unpriced) return 'unpriced';
  return undefined;
}

function cellTitle(cell: GridCell): string | undefined {
  if (cell.overCapacity) {
    return `Over capacity in ${cell.month}: ${cell.overCapacity.percent.toFixed(1)}% across all projects. This is the latest edit that caused it.`;
  }
  if (cell.unpriced) return 'Part of this month is before the first rate and costs zero.';
  return undefined;
}

interface CellInputProps {
  readonly value: number;
  readonly decimals: number;
  readonly label: string;
  readonly onCommit: (typed: number) => void;
}

/**
 * Edits one cell. Saves on Enter or when focus leaves, and only if the text
 * changed, so switching units never rewrites a stored value.
 */
function CellInput({ value, decimals, label, onCommit }: CellInputProps) {
  const shown = value.toFixed(decimals);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null && draft.trim() !== shown) onCommit(Number(draft.trim() === '' ? '0' : draft));
    setDraft(null);
  };

  return (
    <input
      className="cell"
      inputMode="decimal"
      aria-label={label}
      value={draft ?? shown}
      onFocus={(event) => event.target.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        // Escape drops the edit and shows the stored value again.
        if (event.key === 'Escape') setDraft(null);
      }}
    />
  );
}

interface AddPersonProps {
  readonly employees: readonly Employee[];
  readonly exclude: readonly string[];
  readonly onAdd: (employeeId: string) => void;
}

function AddPerson({ employees, exclude, onAdd }: AddPersonProps) {
  return (
    <select aria-label="Add a person" value="" onChange={(event) => onAdd(event.target.value)} className="add-person">
      <option value="">+ person</option>
      {employees
        .filter((employee) => !exclude.includes(employee.id))
        .map((employee) => (
          <option key={employee.id} value={employee.id}>
            {employee.name} ({employee.role})
          </option>
        ))}
    </select>
  );
}
