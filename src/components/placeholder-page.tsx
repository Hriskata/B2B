// An intentionally EMPTY page for a part of the MVP that waits for a decision,
// text or data from the owner. It holds the route (and its access rule), so
// the page exists and can be linked, but it shows no content of its own and
// nothing is invented. It states what is being waited for.

export function PlaceholderPage({
  title,
  waitingFor,
  phase,
  wide = false,
}: {
  title: string;
  waitingFor: string[];
  phase: string;
  wide?: boolean;
}) {
  return (
    <>
      <h1>{title}</h1>
      <div
        role="note"
        className={`mt-6 rounded-lg border border-dashed border-line-ember p-4 ${wide ? "" : "max-w-2xl"}`}
      >
        <p className="font-medium">ЧАКА РЕШЕНИЕ ИЛИ ИНФОРМАЦИЯ ({phase})</p>
        <p className="mt-2">Страницата е заготовка и е празна нарочно. Чака:</p>
        <ul className="mt-2 list-disc pl-6">
          {waitingFor.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
