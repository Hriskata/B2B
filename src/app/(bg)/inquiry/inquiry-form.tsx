"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState } from "@/lib/form-state";
import { submitInquiryAction } from "./actions";

// The inquiry list ("количката") and the contact data. The list is kept in
// this browser between visits as a convenience only (it may be empty in a
// private window); the server checks every product and quantity again.

export const INQUIRY_LIST_KEY = "b2b_inquiry_items";
const MAX_QUANTITY = 100_000;

type Product = { slug: string; name: string };
type Item = { slug: string; quantity: number };

function readStored(known: Set<string>): Item[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(INQUIRY_LIST_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (i): i is Item =>
          typeof i?.slug === "string" &&
          known.has(i.slug) &&
          Number.isInteger(i.quantity) &&
          i.quantity >= 1 &&
          i.quantity <= MAX_QUANTITY,
      )
      .slice(0, 50);
  } catch {
    return [];
  }
}

function store(items: Item[]) {
  try {
    localStorage.setItem(INQUIRY_LIST_KEY, JSON.stringify(items));
  } catch {
    // Storage blocked: the list simply is not remembered.
  }
}

export function InquiryForm({
  products,
  initialSlug,
  defaultName,
}: {
  products: Product[];
  initialSlug: string | null;
  defaultName: string;
}) {
  const [state, action] = useActionState(submitInquiryAction, initialFormState);
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [clientKey, setClientKey] = useState("");
  const [picked, setPicked] = useState("");
  const pickId = useId();
  const names = new Map(products.map((p) => [p.slug, p.name]));

  // After mount only (the browser storage and a random key do not exist on
  // the server). The product from the link is added once.
  useEffect(() => {
    const known = new Set(products.map((p) => p.slug));
    let list = readStored(known);
    if (initialSlug && known.has(initialSlug) && !list.some((i) => i.slug === initialSlug)) {
      list = [...list, { slug: initialSlug, quantity: 1 }];
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after mount
    setItems(list);
    setClientKey(crypto.randomUUID());
    setLoaded(true);
  }, [products, initialSlug]);

  useEffect(() => {
    if (loaded) store(items);
  }, [items, loaded]);

  const available = products.filter((p) => !items.some((i) => i.slug === p.slug));

  function add() {
    if (!picked || items.some((i) => i.slug === picked) || items.length >= 50) return;
    setItems([...items, { slug: picked, quantity: 1 }]);
    setPicked("");
  }

  function setQuantity(slug: string, value: string) {
    const n = Number.parseInt(value, 10);
    const quantity = Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_QUANTITY) : 1;
    setItems(items.map((i) => (i.slug === slug ? { ...i, quantity } : i)));
  }

  const itemsError = state.fieldErrors?.items;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <input type="hidden" name="clientKey" value={clientKey} />

      <section aria-labelledby="inquiry-products" className="flex flex-col gap-3">
        <h2 id="inquiry-products" className="text-xl">
          Продукти
        </h2>
        {loaded && items.length === 0 && (
          <p className="text-secondary">Списъкът е празен. Добавете продукт от каталога или от списъка по-долу.</p>
        )}
        {items.length > 0 && (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.slug}
                className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1 font-medium">{names.get(item.slug)}</span>
                <span className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <span>Бройки</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_QUANTITY}
                      step={1}
                      value={item.quantity}
                      onChange={(e) => setQuantity(item.slug, e.target.value)}
                      className="input w-24"
                      aria-label={`Бройки: ${names.get(item.slug)}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((i) => i.slug !== item.slug))}
                    className="text-sm underline"
                    aria-label={`Махни ${names.get(item.slug)}`}
                  >
                    Махни
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {available.length > 0 && items.length < 50 && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <label htmlFor={pickId} className="text-sm font-medium">
                Добави продукт
              </label>
              <select
                id={pickId}
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
                className="input"
              >
                <option value="">Изберете продукт…</option>
                {available.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={add} disabled={!picked} className="btn btn-secondary">
              Добави
            </button>
          </div>
        )}
        {itemsError && (
          <p role="alert" className="text-sm text-ember-300">
            {itemsError}
          </p>
        )}
      </section>

      <section aria-labelledby="inquiry-contact" className="flex flex-col gap-4">
        <h2 id="inquiry-contact" className="text-xl">
          Контактно лице
        </h2>
        <Field
          name="contactName"
          label="Име и фамилия"
          autoComplete="name"
          state={state}
          maxLength={120}
          defaultValue={defaultName}
        />
        <Field name="phone" label="Телефон" autoComplete="tel" state={state} maxLength={30} />
        <Field
          name="message"
          label="Съобщение (по желание)"
          multiline
          required={false}
          state={state}
          maxLength={2000}
          hint="Например срок, вариант или друга информация за поръчката."
        />
      </section>

      <SubmitButton>Изпрати запитването</SubmitButton>
    </form>
  );
}
