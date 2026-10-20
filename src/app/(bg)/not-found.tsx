import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16">
      <h1>Страницата не е намерена</h1>
      <p className="mt-4 text-lg text-secondary">
        Страницата, която търсите, не съществува или е преместена.
      </p>
      <Link href="/" className="mt-8 underline">
        Към началната страница
      </Link>
    </main>
  );
}
