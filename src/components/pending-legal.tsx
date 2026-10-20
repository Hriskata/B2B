import { getDict, type Lang } from "@/i18n";

// Template for the legal pages. The texts are NOT written from general
// knowledge (project rule): they are made only from sources provided by the
// owner and reviewed by a lawyer before launch.

export function PendingLegal({
  lang,
  title,
  children,
}: {
  lang: Lang;
  title: string;
  children?: React.ReactNode;
}) {
  const t = getDict(lang).legal;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <div
        role="note"
        className="mt-6 rounded-lg border-2 border-dashed border-amber-600 p-4 dark:border-amber-500"
      >
        <p className="font-semibold">{t.pendingTitle}</p>
        <p className="mt-2">{t.pendingText}</p>
      </div>
      {children}
    </main>
  );
}
