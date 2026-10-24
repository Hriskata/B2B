"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { PICTURE, type MaterialLayout } from "./materials";

export type ShowcaseItem = MaterialLayout & {
  name: string;
  short: string;
  more: string;
  pending?: string;
};

type Line = { id: string; d: string };

// Interactive picture. The description cards and the hotspots on the picture
// are two views of the same item, so hovering, focusing or choosing either
// one activates both. Hover is a preview; a click keeps the choice (click
// again, press Esc or click the picture to clear it). Lines between the cards
// and the hotspots are drawn from the real element positions, on wide
// screens only; on small screens the cards sit below the picture.
export function HotspotViewer({
  items,
  src,
  alt,
  labels,
}: {
  items: ShowcaseItem[];
  src: string;
  alt: string;
  labels: { list: string; inside: string; pending: string; failed: string };
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const active = hovered ?? focused ?? selected;

  const hotspots = items.filter((i) => i.x !== undefined && i.y !== undefined);
  const numberOf = (id: string) => hotspots.findIndex((i) => i.id === id) + 1;
  const around = (side: "top" | "bottom") =>
    items.filter((i) => i.label === side);
  const inside = items.filter((i) => i.x === undefined);

  const measure = useCallback(() => {
    const el = root.current;
    if (!el || !window.matchMedia("(min-width: 1024px)").matches) {
      setLines([]);
      return;
    }
    const box = el.getBoundingClientRect();
    const next: Line[] = [];
    for (const item of items) {
      if (item.x === undefined) continue;
      const card = el.querySelector<HTMLElement>(`[data-card="${item.id}"]`);
      const dot = el.querySelector<HTMLElement>(`[data-dot="${item.id}"]`);
      if (!card || !dot) continue;
      const c = card.getBoundingClientRect();
      const h = dot.getBoundingClientRect();
      const x1 = c.left + c.width / 2 - box.left;
      const y1 = (item.label === "top" ? c.bottom : c.top) - box.top;
      const x2 = h.left + h.width / 2 - box.left;
      const y2 = h.top + h.height / 2 - box.top;
      const my = (y1 + y2) / 2;
      next.push({
        id: item.id,
        d: `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`,
      });
    }
    setLines(next);
  }, [items]);

  useLayoutEffect(() => {
    measure();
  }, [measure, failed]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Mouse only: a touch tap must not leave a sticky "hover".
  const hover = (id: string) => ({
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") setHovered(id);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") setHovered(null);
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      if (e.currentTarget.matches(":focus-visible")) setFocused(id);
    },
    onBlur: () => setFocused(null),
  });
  const toggle = (id: string) => setSelected((s) => (s === id ? null : id));

  const activeItem = items.find((i) => i.id === active);

  const card = (item: ShowcaseItem) => {
    const n = numberOf(item.id);
    const on = active === item.id;
    return (
      <li key={item.id}>
        <button
          type="button"
          data-card={item.id}
          data-active={on}
          aria-pressed={selected === item.id}
          className="showcase-card"
          onClick={() => toggle(item.id)}
          {...hover(item.id)}
        >
          <span className="flex items-center gap-3">
            {n > 0 ? <span className="showcase-num">{n}</span> : null}
            <span className="text-primary">{item.name}</span>
            {item.pending ? (
              <span className="ml-auto rounded-full border border-dashed border-line px-2 py-1 text-[11px] leading-none text-secondary">
                {labels.pending}
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-sm text-secondary">
            {item.short}
          </span>
          {item.more ? (
            <span className="showcase-more" data-open={on}>
              <span className="block overflow-hidden text-sm text-secondary">
                <span className="block pt-2">{item.more}</span>
              </span>
            </span>
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape") setSelected(null);
      }}
    >
      <div className="grid gap-4 lg:gap-16">
        <ul
          aria-label={labels.list}
          className="order-2 grid gap-3 sm:grid-cols-2 lg:order-1 lg:gap-6"
        >
          {around("top").map(card)}
        </ul>

        <div className="order-1 lg:order-2">
          <div
            className="relative"
            style={{ aspectRatio: `${PICTURE.width} / ${PICTURE.height}` }}
            onClick={() => setSelected(null)}
          >
            {failed ? (
              <p className="flex h-full items-center justify-center text-sm text-muted">
                {labels.failed}
              </p>
            ) : (
              <Image
                src={src}
                alt={alt}
                fill
                sizes="(min-width: 1120px) 1072px, 100vw"
                className="object-fill"
                onError={() => setFailed(true)}
                onLoad={measure}
              />
            )}
            {/* Exact outline of the active part, when a mask path exists. */}
            {!failed && activeItem?.mask ? (
              <svg
                aria-hidden
                viewBox={`0 0 ${PICTURE.width} ${PICTURE.height}`}
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                <path d={activeItem.mask} className="showcase-mask" />
              </svg>
            ) : null}
            {!failed &&
              hotspots.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  data-dot={item.id}
                  data-active={active === item.id}
                  aria-label={item.name}
                  aria-pressed={selected === item.id}
                  className="showcase-dot"
                  style={{ left: `${item.x}%`, top: `${item.y}%` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(item.id);
                  }}
                  {...hover(item.id)}
                >
                  <span aria-hidden>{numberOf(item.id)}</span>
                </button>
              ))}
          </div>
        </div>

        <ul
          aria-label={labels.list}
          className="order-3 grid gap-3 sm:grid-cols-2 lg:gap-6"
        >
          {around("bottom").map(card)}
        </ul>
      </div>

      {inside.length ? (
        <div className="mt-6">
          <p className="t-label mb-3 text-secondary">{labels.inside}</p>
          <ul className="grid gap-3 sm:grid-cols-2">{inside.map(card)}</ul>
        </div>
      ) : null}

      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      >
        {lines.map((l) => (
          <path
            key={l.id}
            d={l.d}
            fill="none"
            data-active={active === l.id}
            className="showcase-line"
          />
        ))}
      </svg>
    </div>
  );
}
