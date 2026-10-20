import type { Metadata } from "next";
import { PendingLegal } from "@/components/pending-legal";

export const metadata: Metadata = {
  title: "Политика за бисквитки",
  robots: { index: false, follow: true },
};

// The table below is a TECHNICAL inventory of what this site really sets
// (taken from the code), not a legal text.
const COOKIES = [
  {
    name: "b2b_session",
    purpose: "Поддържа вписания клиент.",
    lasts: "до 7 дни",
    when: "след вход",
    consent: "не се иска (необходима)",
  },
  {
    name: "b2b_admin_session",
    purpose: "Поддържа вписания администратор. Не се задава на посетители и клиенти.",
    lasts: "до 8 часа",
    when: "след вход в администрацията",
    consent: "не се иска (необходима)",
  },
  {
    name: "b2b_consent",
    purpose: "Запомня вашия избор за бисквитките.",
    lasts: "180 дни",
    when: "след избор в банера",
    consent: "не се иска (запомня избора)",
  },
  {
    name: "_ga, _ga_*",
    purpose: "Статистика за посещенията (Google Analytics).",
    lasts: "определя Google",
    when: "само ако приемете бисквитките за статистика",
    consent: "иска се",
  },
];

export default function CookiesPage() {
  return (
    <PendingLegal title="Политика за бисквитки">
      <section className="mt-8">
        <h2 className="text-xl font-semibold">Какви бисквитки използва сайтът (технически списък)</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Това е списък на това, което сайтът реално записва, а не правен текст. Правният текст на
          политиката ще бъде добавен по предоставени източници.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-400">
                <th className="py-2 pr-3">Име</th>
                <th className="py-2 pr-3">За какво</th>
                <th className="py-2 pr-3">Колко време</th>
                <th className="py-2 pr-3">Кога</th>
                <th className="py-2">Съгласие</th>
              </tr>
            </thead>
            <tbody>
              {COOKIES.map((c) => (
                <tr key={c.name} className="border-b border-zinc-200 align-top dark:border-zinc-800">
                  <td className="py-2 pr-3 font-mono">{c.name}</td>
                  <td className="py-2 pr-3">{c.purpose}</td>
                  <td className="py-2 pr-3">{c.lasts}</td>
                  <td className="py-2 pr-3">{c.when}</td>
                  <td className="py-2">{c.consent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-sm">
          На формите за регистрация и възстановяване на парола се зарежда защита от автоматични
          заявки (Cloudflare Turnstile).
        </p>
      </section>
    </PendingLegal>
  );
}
