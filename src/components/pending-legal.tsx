// Template for the legal pages. The texts are NOT written from general
// knowledge (project rule): they are made only from sources provided by the
// owner and reviewed by a lawyer before launch.

export function PendingLegal({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <div
        role="note"
        className="mt-6 rounded-lg border-2 border-dashed border-amber-600 p-4 dark:border-amber-500"
      >
        <p className="font-semibold">ЧАКА ИЗТОЧНИЦИ</p>
        <p className="mt-2">
          Този документ още не е написан. Текстът ще бъде съставен само по правни източници, които
          предостави собственикът на сайта, и ще бъде прегледан от юрист преди пускането.
        </p>
      </div>
      {children}
    </main>
  );
}
