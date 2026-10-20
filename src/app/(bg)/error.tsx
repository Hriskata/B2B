"use client";

// Never render error details to the client; the digest in server logs is enough.
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-3xl font-semibold">Възникна грешка</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Нещо се обърка. Моля, опитайте отново след малко.
      </p>
      <button type="button" onClick={() => retry()} className="mt-8 self-start underline">
        Опитай отново
      </button>
    </main>
  );
}
