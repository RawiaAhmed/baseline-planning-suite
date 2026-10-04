import type { Employee } from '@baseline/contracts';
import { useState } from 'react';

interface Props {
  readonly employees: readonly Employee[];
  readonly oversubscribed: ReadonlyMap<string, string[]>;
  readonly onOpen: (employeeId: string) => void;
}

/** Searchable list of everyone, with a badge for anyone booked beyond capacity. */
export function Register({ employees, oversubscribed, onOpen }: Props) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const matches = employees.filter(
    (employee) => employee.name.toLowerCase().includes(term) || employee.role.toLowerCase().includes(term),
  );

  return (
    <section>
      <input
        type="search"
        placeholder="Search by name or role"
        aria-label="Search employees"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <p>
        {matches.length} of {employees.length} people
      </p>

      <table className="register">
        <thead>
          <tr>
            <th>Name</th>
            <th>Role</th>
            <th>Weekly hours</th>
            <th>Capacity</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((employee) => {
            const overMonths = oversubscribed.get(employee.id);
            return (
              <tr key={employee.id} onClick={() => onOpen(employee.id)}>
                <td>
                  <button type="button" className="link" onClick={() => onOpen(employee.id)}>
                    {employee.name}
                  </button>
                </td>
                <td>{employee.role}</td>
                <td>{employee.weeklyHours}</td>
                <td>
                  {overMonths && (
                    <span className="badge-over" title={`Over capacity in ${overMonths.join(', ')}`}>
                      Oversubscribed ({overMonths.length})
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
