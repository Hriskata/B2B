import Link from "next/link";
import { getDict } from "@/i18n";

export default function NotFound() {
  const t = getDict("en").notFound;
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-3xl font-semibold">{t.title}</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">{t.text}</p>
      <Link href="/en" className="mt-8 underline">
        {t.home}
      </Link>
    </main>
  );
}
