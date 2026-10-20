import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Въпроси и отговори",
  description: "Често задавани въпроси за регистрацията, цените и поръчките.",
};

// Answers use only what is already decided for the project. Anything still
// open (delivery, invoicing) is marked pending instead of invented.
const QUESTIONS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Кой може да се регистрира?",
    a: "Само български фирми. При регистрация се въвеждат името на фирмата, ЕИК, имейл и парола.",
  },
  {
    q: "Виждат ли се цените без регистрация?",
    a: "Не. Каталогът е отворен за всеки, но цените се виждат само след вход.",
  },
  {
    q: "Как се купува?",
    a: "Няма количка и плащане в сайта. Изпращате запитване, а цената се договаря. Минималната поръчка е 3 броя.",
  },
  {
    q: "Как се плаща?",
    a: "С банков превод, извън сайта, след като се разберем за цената.",
  },
  {
    q: "Може ли повече хора от една фирма да имат профил?",
    a: "Да. Една фирма може да има няколко профила.",
  },
  {
    q: "Забравих паролата си. Какво да направя?",
    a: (
      <>
        Използвайте{" "}
        <Link href="/forgot-password" className="underline">
          възстановяване на парола
        </Link>
        . Ще получите връзка на имейла си, която важи кратко време и може да се ползва само веднъж.
      </>
    ),
  },
  {
    q: "Какво е времето и цената на доставка?",
    a: <span className="font-semibold text-amber-700 dark:text-amber-400">ЧАКА ИНФОРМАЦИЯ от собственика.</span>,
  },
  {
    q: "Издава ли се фактура?",
    a: <span className="font-semibold text-amber-700 dark:text-amber-400">ЧАКА ИНФОРМАЦИЯ от собственика.</span>,
  },
];

export default function FaqPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-semibold">Въпроси и отговори</h1>
      <p role="note" className="mt-4 rounded border border-dashed border-amber-600 px-3 py-2 text-sm dark:border-amber-500">
        Примерно съдържание. Въпросите ще бъдат допълнени и одобрени от собственика на сайта.
      </p>
      <div className="mt-6 divide-y divide-zinc-300 border-y border-zinc-300 dark:divide-zinc-700 dark:border-zinc-700">
        {QUESTIONS.map(({ q, a }) => (
          <details key={q} className="group py-3">
            <summary className="cursor-pointer font-medium">{q}</summary>
            <div className="mt-2 text-zinc-700 dark:text-zinc-300">{a}</div>
          </details>
        ))}
      </div>
    </main>
  );
}
