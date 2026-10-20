import Link from "next/link";
import { getDict, localePath, type Lang } from "@/i18n";
import { CONNECTORS, RACK_UNITS, type CatalogFilters, hasActiveFilters } from "@/lib/catalog-filter";
import { SERIES_KEYS, seriesName } from "@/lib/series";

const control =
  "w-full rounded border border-zinc-400 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-600";

// A plain GET form: no JavaScript needed, and the chosen filters end up in
// the URL, so a filtered list can be shared as a link.
export function CatalogFiltersForm({ filters, lang }: { filters: CatalogFilters; lang: Lang }) {
  const t = getDict(lang).filters;
  const action = localePath(lang, "/products");
  return (
    <form method="get" action={action} className="mb-6 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <label className="text-sm">
          {t.series}
          <select name="series" defaultValue={filters.series ?? ""} className={control}>
            <option value="">{t.all}</option>
            {SERIES_KEYS.map((key) => (
              <option key={key} value={key}>
                {seriesName(key, lang)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t.connector}
          <select name="connector" defaultValue={filters.connector ?? ""} className={control}>
            <option value="">{t.all}</option>
            {CONNECTORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t.rackUnits}
          <select name="ru" defaultValue={filters.rackUnits?.toString() ?? ""} className={control}>
            <option value="">{t.all}</option>
            {RACK_UNITS.map((r) => (
              <option key={r} value={r}>
                {r}RU
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {t.fibersFrom}
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
          {t.fibersTo}
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
          {t.splice}
          <select
            name="splice"
            defaultValue={filters.splice === null ? "" : filters.splice ? "1" : "0"}
            className={control}
          >
            <option value="">{t.all}</option>
            <option value="1">{t.withSplice}</option>
            <option value="0">{t.withoutSplice}</option>
          </select>
        </label>
        <label className="text-sm">
          {t.sort}
          <select name="sort" defaultValue={filters.sort} className={control}>
            {Object.entries(t.sorts).map(([value, label]) => (
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
          {t.apply}
        </button>
        {hasActiveFilters(filters) && (
          <Link href={action} className="text-sm underline">
            {t.clear}
          </Link>
        )}
      </div>
    </form>
  );
}
