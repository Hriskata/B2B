"use client";

// Replaces the root layout when it fails, so it renders its own document.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="bg">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "4rem 1rem" }}>
        <title>Възникна грешка</title>
        <h1>Възникна грешка</h1>
        <p>Нещо се обърка. Моля, опитайте отново след малко.</p>
        <button type="button" onClick={() => retry()}>
          Опитай отново
        </button>
      </body>
    </html>
  );
}
