import type { ActiveUser, DisplayCurrency, ShellContext } from '@baseline/contracts';
import { useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router';
import { RemotePanel } from './remotes/RemotePanel';
import type { RemoteName } from './remotes/loadRemote';

/**
 * Display currencies. Rates are recorded in EUR; these fixed conversion
 * factors are illustrative, a real build would read them from a rates service.
 */
const CURRENCIES = [
  { code: 'EUR', perEuro: 1 },
  { code: 'USD', perEuro: 1.08 },
  { code: 'GBP', perEuro: 0.85 },
] as const satisfies readonly DisplayCurrency[];

/** Demo users; there is no authentication in scope. */
const USERS = [
  { id: 'emp-013', name: 'Lukas Fischer' },
  { id: 'emp-001', name: 'Adaeze Okafor' },
] as const satisfies readonly ActiveUser[];

const PAGES: { name: RemoteName; title: string }[] = [
  { name: 'people', title: 'People' },
  { name: 'delivery', title: 'Delivery' },
];

/** Owns navigation, display currency and the active user, and pushes the last two into the remotes. */
export function Shell() {
  const [currency, setCurrency] = useState<DisplayCurrency>(CURRENCIES[0]);
  const [activeUser, setActiveUser] = useState<ActiveUser>(USERS[0]);
  const context: ShellContext = { currency, activeUser };
  const { search } = useLocation();

  return (
    <div className="shell">
      <header className="shell-header">
        <strong>Baseline</strong>
        <nav>
          {PAGES.map((page) => (
            <NavLink key={page.name} to={{ pathname: `/${page.name}`, search }}>
              {page.title}
            </NavLink>
          ))}
        </nav>

        <label>
          Currency{' '}
          <select
            value={currency.code}
            onChange={(event) => setCurrency(CURRENCIES.find((c) => c.code === event.target.value) ?? currency)}
          >
            {CURRENCIES.map(({ code }) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>

        <label>
          User{' '}
          <select
            value={activeUser.id}
            onChange={(event) => setActiveUser(USERS.find((user) => user.id === event.target.value) ?? activeUser)}
          >
            {USERS.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>

        <span className="break-links">
          Break a remote:{' '}
          {PAGES.map((page) => (
            <a key={page.name} href={`/${page.name}?break=${page.name}`}>
              {page.title}
            </a>
          ))}
        </span>
      </header>

      <main>
        <Routes>
          {PAGES.map((page) => (
            <Route key={page.name} path={`/${page.name}`} element={<RemotePanel {...page} context={context} />} />
          ))}
          <Route path="*" element={<Navigate to="/people" replace />} />
        </Routes>
      </main>
    </div>
  );
}
