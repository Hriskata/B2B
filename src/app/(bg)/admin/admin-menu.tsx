"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminLogoutAction } from "./actions";

// The admin menu. On a laptop or desktop (lg and wider) it is a fixed column
// on the left; on a tablet or phone it is a collapsible "Меню" above the page.
// Only shown with a complete session (the layout decides).
// Icons are small inline line icons (1.5 stroke), so no icon library is needed.

type Item = { href: string; label: string; icon: React.ReactNode };

const svg = (children: React.ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const ITEMS: Item[] = [
  {
    href: "/admin",
    label: "Начало",
    icon: svg(
      <>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9.5h13V10" />
      </>,
    ),
  },
  {
    href: "/admin/products",
    label: "Продукти и цени",
    icon: svg(
      <>
        <path d="M12 3 4 7v10l8 4 8-4V7z" />
        <path d="m4 7 8 4 8-4M12 11v10" />
      </>,
    ),
  },
  {
    href: "/admin/registrations",
    label: "Регистрации",
    icon: svg(
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
        <path d="M18 8v6M15 11h6" />
      </>,
    ),
  },
  {
    href: "/admin/inquiries",
    label: "Запитвания",
    icon: svg(
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
      </>,
    ),
  },
  {
    href: "/admin/customers",
    label: "Клиенти и фирми",
    icon: svg(
      <>
        <path d="M4 20V6l8-3v17M12 9h8v11" />
        <path d="M7.5 8.5h1M7.5 12h1M7.5 15.5h1M15 13h1M15 16.5h1" />
      </>,
    ),
  },
  {
    href: "/admin/admins",
    label: "Администратори",
    icon: svg(
      <>
        <path d="M12 3 4.5 6v5.5c0 4.5 3.2 8 7.5 9.5 4.3-1.5 7.5-5 7.5-9.5V6z" />
        <path d="m9 12 2.2 2.2L15.5 10" />
      </>,
    ),
  },
  {
    href: "/admin/audit",
    label: "Журнал на промените",
    icon: svg(
      <>
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M14.5 3v4.5H19M9 12h7M9 16h7" />
      </>,
    ),
  },
  {
    href: "/admin/change-password",
    label: "Смяна на парола",
    icon: svg(
      <>
        <rect x="5" y="10.5" width="14" height="10" rx="2" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      </>,
    ),
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function Links({ pathname }: { pathname: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-sm border px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "border-line-ember bg-raised text-primary"
                  : "border-transparent text-secondary hover:bg-raised hover:text-primary"
              }`}
            >
              <span className={active ? "text-ember-300" : ""}>{item.icon}</span>
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Account({ email, role }: { email: string; role: string }) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
      <div className="min-w-0 px-3 text-sm">
        <p className="truncate text-primary" title={email}>
          {email}
        </p>
        <p className="text-secondary">{role}</p>
      </div>
      <form action={adminLogoutAction}>
        <button type="submit" className="btn btn-secondary w-full">
          Изход
        </button>
      </form>
    </div>
  );
}

export function AdminMenu({ email, role }: { email: string; role: string }) {
  const pathname = usePathname() ?? "/admin";
  return (
    <div className="lg:w-64 lg:shrink-0">
      {/* Phone and tablet: a collapsible menu above the page. */}
      <details className="border-b border-line bg-section lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-primary">
          <span>Меню</span>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </summary>
        <nav aria-label="Администрация" className="px-4 pb-4">
          <Links pathname={pathname} />
          <Account email={email} role={role} />
        </nav>
      </details>

      {/* Laptop and desktop: a fixed column on the left. */}
      <nav
        aria-label="Администрация"
        className="hidden border-r border-line bg-section p-4 lg:sticky lg:top-0 lg:flex lg:min-h-[calc(100vh-4.5rem)] lg:flex-col lg:justify-between"
      >
        <div>
          <p className="t-label mb-3 px-3 text-muted">Администрация</p>
          <Links pathname={pathname} />
        </div>
        <Account email={email} role={role} />
      </nav>
    </div>
  );
}
