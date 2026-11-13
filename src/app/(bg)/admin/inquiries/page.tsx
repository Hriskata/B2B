import type { Metadata } from "next";
import { Suspense } from "react";
import { listInquiries } from "@/lib/admin/inquiries";
import { requireAdmin } from "@/lib/auth/current";
import { countryName, formatCompanyNumber, ruleFor } from "@/lib/company-number";
import { can } from "@/lib/permissions";
import { decideInquiryAction } from "../manage-actions";

export const metadata: Metadata = { title: "Запитвания (админ)" };

const when = new Intl.DateTimeFormat("bg-BG", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Sofia",
});

// The latest inquiries. An inquiry of a company that is inactive in the
// register carries a flag only admins see; "преглед + редакция" decides
// whether to take it (checked again on the server). The customer sees none
// of this. Everything the customer typed is shown as plain text.
export default function AdminInquiriesPage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8">
      <h1 className="mb-2">Запитвания</h1>
      <p className="mb-6 text-sm text-secondary">
        Последните 200 запитвания, най-новите отгоре. Собствениците получават имейл за всяко ново
        запитване.
      </p>
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const me = await requireAdmin();
  const canDecide = can(me.role, "decide_inquiries");
  const inquiries = await listInquiries(200);
  if (inquiries.length === 0) return <p>Все още няма запитвания.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {inquiries.map((q) => (
        <li key={q.id} className={`card card-pad ${q.companyInactive ? "card-highlight" : ""}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{q.companyName}</p>
            <p className="text-sm text-secondary">{when.format(q.createdAt)}</p>
          </div>
          <p className="text-sm text-secondary">
            {countryName(q.country)} · {ruleFor(q.country).label}:{" "}
            {formatCompanyNumber(q.country, q.companyNumber)} · {q.email}
          </p>
          {q.companyInactive && (
            <p className="mt-2 rounded-sm border border-dashed border-line-ember px-3 py-2 text-sm">
              <span className="pill mr-2">Неактивна или заличена в регистъра</span>
              {q.registryStatus ? `код ${q.registryStatus}. ` : ""}
              {q.decision === "accepted"
                ? `Поето от ${q.decidedBy ?? "изтрит админ"}${q.decidedAt ? `, ${when.format(q.decidedAt)}` : ""}.`
                : q.decision === "declined"
                  ? `Отказано от ${q.decidedBy ?? "изтрит админ"}${q.decidedAt ? `, ${when.format(q.decidedAt)}` : ""}.`
                  : "Чака решение дали да се поеме."}
            </p>
          )}
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            {q.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 border-b border-line py-1">
                <span>{i.productName}</span>
                <span className="whitespace-nowrap">{i.quantity.toLocaleString("bg-BG")} бр.</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-secondary">Контактно лице</dt>
            <dd>{q.contactName}</dd>
            <dt className="text-secondary">Телефон</dt>
            <dd>{q.phone}</dd>
            {q.message && (
              <>
                <dt className="text-secondary">Съобщение</dt>
                <dd className="break-words whitespace-pre-line">{q.message}</dd>
              </>
            )}
          </dl>
          {canDecide && q.companyInactive && !q.decision && (
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={decideInquiryAction}>
                <input type="hidden" name="inquiryId" value={q.id} />
                <input type="hidden" name="decision" value="accepted" />
                <button type="submit" className="btn btn-primary">
                  Поеми запитването
                </button>
              </form>
              <form action={decideInquiryAction}>
                <input type="hidden" name="inquiryId" value={q.id} />
                <input type="hidden" name="decision" value="declined" />
                <button type="submit" className="btn btn-secondary">
                  Откажи
                </button>
              </form>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
