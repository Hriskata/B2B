"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState } from "@/lib/form-state";
import type { ProductOptions } from "@/lib/product-options";
import { submitInquiryAction } from "./actions";

// The inquiry list ("количката") and the contact data. The list is kept in
// this browser between visits as a convenience only (it may be empty in a
// private window); the server checks every product, setting and quantity
// again. Each line has the settings the catalog offers for that model
// (polish / fiber type, number of fibers); the same model may be added again
// in other settings.

export const INQUIRY_LIST_KEY = "b2b_inquiry_items";
const MAX_QUANTITY = 100_000;
const MAX_LINES = 50;

type Product = { slug: string; name: string; options: ProductOptions };
type Item = {
  // Only to tell the lines apart in this browser; never sent.
  id: string;
  slug: string;
  quantity: number;
  polish: string | null;
  fibers: number | null;
};

function newItem(product: Product): Item {
  return {
    id: crypto.randomUUID(),
    slug: product.slug,
    quantity: 1,
    // One variant: nothing to choose. Several: the customer picks one.
    polish: product.options.polish.length === 1 ? product.options.polish[0] : null,
    // The standard configuration until the customer changes it.
    fibers: product.options.fibers?.min ?? null,
  };
}

// A stored line is kept only if it still fits the catalog; a setting that is
// no longer offered is cleared so the customer chooses again.
function readStored(bySlug: Map<string, Product>): Item[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(INQUIRY_LIST_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const items: Item[] = [];
    for (const raw of parsed.slice(0, MAX_LINES)) {
      const product = typeof raw?.slug === "string" ? bySlug.get(raw.slug) : undefined;
      const quantity = raw?.quantity;
      if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) continue;
      const base = newItem(product);
      const { polish: polishOptions, fibers: range } = product.options;
      const polish =
        typeof raw.polish === "string" && polishOptions.includes(raw.polish) ? raw.polish : base.polish;
      const fibers =
        range && Number.isInteger(raw.fibers) && raw.fibers >= range.min && raw.fibers <= range.max
          ? raw.fibers
          : base.fibers;
      items.push({ ...base, quantity, polish, fibers });
    }
    return items;
  } catch {
    return [];
  }
}

const withoutId = (items: Item[]) =>
  items.map(({ slug, quantity, polish, fibers }) => ({ slug, quantity, polish, fibers }));

function store(items: Item[]) {
  try {
    localStorage.setItem(INQUIRY_LIST_KEY, JSON.stringify(withoutId(items)));
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
  const itemsErrorId = useId();
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  // After mount only (the browser storage and a random key do not exist on
  // the server). The product from the link is added once.
  useEffect(() => {
    const map = new Map(products.map((p) => [p.slug, p]));
    let list = readStored(map);
    const fromLink = initialSlug ? map.get(initialSlug) : undefined;
    if (fromLink && !list.some((i) => i.slug === fromLink.slug) && list.length < MAX_LINES) {
      list = [...list, newItem(fromLink)];
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after mount
    setItems(list);
    setClientKey(crypto.randomUUID());
    setLoaded(true);
  }, [products, initialSlug]);

  useEffect(() => {
    if (loaded) store(items);
  }, [items, loaded]);

  function add() {
    const product = bySlug.get(picked);
    if (!product || items.length >= MAX_LINES) return;
    setItems((prev) => [...prev, newItem(product)]);
    setPicked("");
  }

  function update(id: string, change: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...change } : i)));
  }

  function setQuantity(id: string, value: string) {
    const n = Number.parseInt(value, 10);
    update(id, { quantity: Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_QUANTITY) : 1 });
  }

  const itemsError = state.fieldErrors?.items;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="items" value={JSON.stringify(withoutId(items))} />
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
            {items.map((item) => {
              const product = bySlug.get(item.slug);
              if (!product) return null;
              return (
                <InquiryLine
                  key={item.id}
                  item={item}
                  product={product}
                  onChange={(change) => update(item.id, change)}
                  onQuantity={(value) => setQuantity(item.id, value)}
                  onRemove={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                  errorId={itemsError ? itemsErrorId : undefined}
                />
              );
            })}
          </ul>
        )}
        {items.length < MAX_LINES && (
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
                {products.map((p) => (
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
          <p id={itemsErrorId} role="alert" className="text-sm text-ember-300">
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
          hint="Например срок или друга информация за поръчката."
        />
      </section>

      <SubmitButton>Изпрати запитването</SubmitButton>
    </form>
  );
}

function InquiryLine({
  item,
  product,
  onChange,
  onQuantity,
  onRemove,
  errorId,
}: {
  item: Item;
  product: Product;
  // Set after a refused send: incomplete settings are marked and point to the message.
  errorId: string | undefined;
  onChange: (change: Partial<Item>) => void;
  onQuantity: (value: string) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const { polish: polishOptions, fibers: range } = product.options;
  // Typed freely, kept within the range when the field is left.
  const [fibersText, setFibersText] = useState(item.fibers?.toString() ?? "");
  // Marked only after a send was refused, not while the customer fills in.
  const missingPolish = Boolean(errorId) && polishOptions.length > 1 && item.polish === null;
  const missingFibers = Boolean(errorId) && range !== null && item.fibers === null;

  function commitFibers() {
    if (!range) return;
    const n = Number.parseInt(fibersText, 10);
    const value = Number.isFinite(n) ? Math.min(Math.max(n, range.min), range.max) : range.min;
    setFibersText(String(value));
    onChange({ fibers: value });
  }

  return (
    <li className="card flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="min-w-0 basis-full font-medium sm:basis-auto sm:flex-1">{product.name}</span>
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
              onChange={(e) => onQuantity(e.target.value)}
              className="input w-24"
              aria-label={`Бройки: ${product.name}`}
            />
          </label>
          <button
            type="button"
            onClick={onRemove}
            className="text-sm underline"
            aria-label={`Махни ${product.name}`}
          >
            Махни
          </button>
        </span>
      </div>
      {(polishOptions.length > 1 || range) && (
        <div className="flex flex-wrap gap-3">
          {polishOptions.length > 1 && (
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
              <label htmlFor={`${id}-polish`} className="text-sm font-medium">
                Полиране и влакно
              </label>
              <select
                id={`${id}-polish`}
                value={item.polish ?? ""}
                onChange={(e) => onChange({ polish: e.target.value || null })}
                className="input"
                aria-invalid={missingPolish || undefined}
                aria-describedby={missingPolish ? errorId : undefined}
              >
                <option value="">Изберете…</option>
                {polishOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          )}
          {range && (
            <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
              <label htmlFor={`${id}-fibers`} className="text-sm font-medium">
                Брой влакна
              </label>
              <input
                id={`${id}-fibers`}
                type="number"
                inputMode="numeric"
                min={range.min}
                max={range.max}
                step={1}
                value={fibersText}
                onChange={(e) => {
                  setFibersText(e.target.value);
                  // What is sent always matches the field (Enter sends without
                  // leaving it): a number outside the range is sent as missing,
                  // and the server refuses it.
                  const n = Number(e.target.value);
                  const valid = e.target.value !== "" && Number.isInteger(n) && n >= range.min && n <= range.max;
                  onChange({ fibers: valid ? n : null });
                }}
                onBlur={commitFibers}
                className="input"
                aria-invalid={missingFibers || undefined}
                aria-describedby={missingFibers && errorId ? `${id}-fibers-hint ${errorId}` : `${id}-fibers-hint`}
              />
              <span id={`${id}-fibers-hint`} className="text-xs text-secondary">
                От {range.min} (стандартна конфигурация) до {range.max}.
              </span>
            </div>
          )}
        </div>
      )}
      {polishOptions.length === 1 && <p className="text-sm text-secondary">{polishOptions[0]}</p>}
    </li>
  );
}
