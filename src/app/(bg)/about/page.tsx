import type { Metadata } from "next";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "За нас",
  description: `Кои сме ние - ${SITE.name}.`,
};

// Template text: the real "За нас" comes from the owner (plan, phase 6).
export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-semibold">За нас</h1>
      <p role="note" className="mt-4 rounded border border-dashed border-amber-600 px-3 py-2 text-sm dark:border-amber-500">
        Примерен текст. Ще бъде заменен с текст от собственика на сайта.
      </p>
      <div className="mt-6 flex flex-col gap-4 text-lg text-zinc-700 dark:text-zinc-300">
        <p>
          Тук ще бъде представена фирмата: кои сме, с какво се занимаваме и какво предлагаме на
          бизнес клиентите.
        </p>
        <p>
          Каталогът е достъпен за всеки. Цените се виждат след вход, а покупката става чрез
          запитване, при което цената се договаря.
        </p>
      </div>
    </main>
  );
}
