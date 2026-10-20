import "./globals.css";

// Used for URLs that match no route at all. The site has two root layouts
// (Bulgarian and /en), so no single layout can wrap this page: it carries its
// own <html>, and therefore both languages.
export default function GlobalNotFound() {
  return (
    <html lang="bg" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16">
          <h1 className="text-3xl font-semibold">Страницата не е намерена</h1>
          <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
            Страницата, която търсите, не съществува или е преместена.
          </p>
          {/* Plain links on purpose: this page is rendered outside the app layouts. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="mt-8 underline">
            Към началната страница
          </a>
          <p lang="en" className="mt-8 text-zinc-600 dark:text-zinc-400">
            Page not found.{" "}
            <a href="/en" className="underline">
              Go to the English home page
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
