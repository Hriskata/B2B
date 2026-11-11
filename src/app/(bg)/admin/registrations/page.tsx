import type { Metadata } from "next";
import { Suspense } from "react";
import { listPendingRegistrations } from "@/lib/admin/registrations";
import { requireAdmin } from "@/lib/auth/current";
import { countryName, formatCompanyNumber, ruleFor } from "@/lib/company-number";
import { can } from "@/lib/permissions";
import { reviewRegistrationAction } from "../manage-actions";

export const metadata: Metadata = { title: "Регистрации (админ)" };

const when = new Intl.DateTimeFormat("bg-BG", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Sofia",
});

// Registrations waiting for manual review (every foreign company for now).
// "Преглед" sees them; only "преглед + редакция" may decide (checked again by
// the action on the server).
export default function AdminRegistrationsPage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8">
      <h1 className="mb-2">Чакащи регистрации</h1>
      <p className="mb-6 text-sm text-secondary">
        Регистрации, които чакат ръчен преглед. При одобрение клиентът получава
        достъп до цените, а при отхвърляне не може да влезе. И в двата случая
        получава имейл, а решението се записва в журнала.
      </p>
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const admin = await requireAdmin();
  const pending = await listPendingRegistrations();
  const canReview = can(admin.role, "review_registrations");
  if (pending.length === 0) return <p>Няма регистрации, които чакат преглед.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {pending.map((r) => (
        <li key={r.userId} className="card card-pad">
          <h2>{r.companyName}</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-secondary">Държава</dt>
            <dd>{countryName(r.country)}</dd>
            <dt className="text-secondary">{ruleFor(r.country).label}</dt>
            <dd>{formatCompanyNumber(r.country, r.companyNumber)}</dd>
            <dt className="text-secondary">Лице</dt>
            <dd>{r.fullName ?? "-"}</dd>
            <dt className="text-secondary">Имейл</dt>
            <dd>{r.email}</dd>
            <dt className="text-secondary">Регистрация</dt>
            <dd>{when.format(r.createdAt)}</dd>
            <dt className="text-secondary">Имейлът е потвърден</dt>
            <dd>{r.emailVerifiedAt ? when.format(r.emailVerifiedAt) : "-"}</dd>
          </dl>
          {canReview && (
            <div className="mt-4 flex flex-wrap items-start gap-3">
              <form action={reviewRegistrationAction}>
                <input type="hidden" name="userId" value={r.userId} />
                <input type="hidden" name="decision" value="approve" />
                <button type="submit" className="btn btn-primary">
                  Одобри
                </button>
              </form>
              {/* Two clicks on purpose: the customer is told at once. */}
              <details>
                <summary className="btn btn-secondary cursor-pointer list-none">
                  Отхвърли
                </summary>
                <form action={reviewRegistrationAction} className="mt-3 flex flex-col gap-2">
                  <input type="hidden" name="userId" value={r.userId} />
                  <input type="hidden" name="decision" value="reject" />
                  <p className="text-sm text-secondary">
                    Клиентът ще получи имейл, че регистрацията не е одобрена.
                  </p>
                  <button type="submit" className="btn btn-secondary">
                    Потвърждавам отхвърлянето
                  </button>
                </form>
              </details>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
