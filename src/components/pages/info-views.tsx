import Link from "next/link";
import { PendingLegal } from "@/components/pending-legal";
import { getDict, type Lang } from "@/i18n";
import { SITE } from "@/lib/site";

// "About", "Contact", "FAQ" and the legal pages, in both languages. Texts
// come from src/i18n; contact values from src/lib/site.ts (null until the
// owner gives them, then shown as "pending", never made up).

export function AboutView({ lang }: { lang: Lang }) {
  const t = getDict(lang).about;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <h1>{t.title}</h1>
      <p
        role="note"
        className="mt-4 rounded-sm border border-dashed border-line-ember px-3 py-2 text-sm text-secondary"
      >
        {t.draft}
      </p>
      <div className="mt-6 flex flex-col gap-4 text-lg text-secondary">
        {t.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </main>
  );
}

export function ContactsView({ lang }: { lang: Lang }) {
  const t = getDict(lang).contacts;
  const rows: [string, string | null][] = [
    [t.rows.company, SITE.operator.legalName],
    [t.rows.eik, SITE.operator.eik],
    [t.rows.address, SITE.operator.address],
    [t.rows.email, SITE.operator.email],
    [t.rows.phone, SITE.operator.phone],
  ];
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <h1>{t.title}</h1>
      <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-medium">{label}</dt>
            <dd className={value ? "" : "font-medium text-ember-300"}>
              {value ?? t.pending}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-secondary">{t.note}</p>
    </main>
  );
}

export function FaqView({ lang }: { lang: Lang }) {
  const t = getDict(lang).faq;
  const pending = (
    <span className="font-medium text-ember-300">{t.pending}</span>
  );
  // Sign-in related pages exist only in Bulgarian for now.
  const questions: { q: string; a: React.ReactNode }[] = [
    { q: t.items.who[0], a: t.items.who[1] },
    { q: t.items.prices[0], a: t.items.prices[1] },
    { q: t.items.buy[0], a: t.items.buy[1] },
    { q: t.items.pay[0], a: t.items.pay[1] },
    { q: t.items.users[0], a: t.items.users[1] },
    {
      q: t.forgotQuestion,
      a: (
        <>
          {t.forgotBefore}
          <Link href="/forgot-password" className="underline">
            {t.forgotLink}
          </Link>
          {t.forgotAfter}
        </>
      ),
    },
    { q: t.items.delivery[0], a: pending },
    { q: t.items.invoice[0], a: pending },
  ];
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <h1>{t.title}</h1>
      <p
        role="note"
        className="mt-4 rounded-sm border border-dashed border-line-ember px-3 py-2 text-sm text-secondary"
      >
        {t.draft}
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {questions.map(({ q, a }) => (
          <details key={q} className="faq-row">
            <summary>{q}</summary>
            <div className="mt-3 text-secondary">{a}</div>
          </details>
        ))}
      </div>
    </main>
  );
}

export function TermsView({ lang }: { lang: Lang }) {
  return <PendingLegal lang={lang} title={getDict(lang).legal.terms} />;
}

export function PrivacyView({ lang }: { lang: Lang }) {
  return <PendingLegal lang={lang} title={getDict(lang).legal.privacy} />;
}

// The table is a TECHNICAL inventory of what this site really sets (taken
// from the code), not a legal text.
export function CookiesView({ lang }: { lang: Lang }) {
  const t = getDict(lang).legal;
  return (
    <PendingLegal lang={lang} title={t.cookies}>
      <section className="mt-8">
        <h2>{t.cookiesHeading}</h2>
        <p className="mt-2 text-sm text-secondary">{t.cookiesNote}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                {t.cols.map((c, i) => (
                  <th
                    key={c}
                    className={i === t.cols.length - 1 ? "py-2" : "py-2 pr-3"}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.cookies_rows.map((row) => (
                <tr key={row[0]} className="border-b border-line align-top">
                  <td className="py-2 pr-3 font-mono">{row[0]}</td>
                  {row.slice(1).map((cell, i) => (
                    <td
                      key={i}
                      className={i === row.length - 2 ? "py-2" : "py-2 pr-3"}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm">{t.turnstile}</p>
      </section>
    </PendingLegal>
  );
}
