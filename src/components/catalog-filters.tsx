import Link from "next/link";
import { CONNECTORS, RACK_UNITS, type CatalogFilters, hasActiveFilters } from "@/lib/catalog-filter";
import { SERIES } from "@/lib/series";

const SORT_LABELS = {
  default: "По подразбиране",
  "fibers-asc": "Влакна: възходящо",
  "fibers-desc": "Влакна: низходящо",
  "density-asc": "Влакна/RU: възходящо",
  "density-desc": "Влакна/RU: низходящо",
} as const;

const control =
  "w-full rounded border border-zinc-400 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-600";

// A plain GET form: no JavaScript needed, and the chosen filters end up in
// the URL, so a filtered list can be shared as a link.
export function CatalogFiltersForm({ filters }: { filters: CatalogFilters }) {
  return (
    <form method="get" action="/" className="mb-6 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <label className="text-sm">
          Серия
          <select name="series" defaultValue={filters.series ?? ""} className={control}>
            <option value="">Всички</option>
            {SERIES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Конектор
          <select name="connector" defaultValue={filters.connector ?? ""} className={control}>
            <option value="">Всички</option>
            {CONNECTORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Височина (RU)
          <select name="ru" defaultValue={filters.rackUnits?.toString() ?? ""} className={control}>
            <option value="">Всички</option>
            {RACK_UNITS.map((r) => (
              <option key={r} value={r}>
                {r}RU
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Влакна от
          <input
            name="fmin"
            type="number"
            min={1}
            max={99999}
            inputMode="numeric"
            defaultValue={filters.fibersMin ?? ""}
            className={control}
          />
        </label>
        <label className="text-sm">
          Влакна до
          <input
            name="fmax"
            type="number"
            min={1}
            max={99999}
            inputMode="numeric"
            defaultValue={filters.fibersMax ?? ""}
            className={control}
          />
        </label>
        <label className="text-sm">
          Сплайс
          <select
            name="splice"
            defaultValue={filters.splice === null ? "" : filters.splice ? "1" : "0"}
            className={control}
          >
            <option value="">Всички</option>
            <option value="1">Със сплайс</option>
            <option value="0">Без сплайс</option>
          </select>
        </label>
        <label className="text-sm">
          Сортиране
          <select name="sort" defaultValue={filters.sort} className={control}>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <button
          type="submit"
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Приложи
        </button>
        {hasActiveFilters(filters) && (
          <Link href="/" className="text-sm underline">
            Изчисти
          </Link>
        )}
      </div>
    </form>
  );
}
