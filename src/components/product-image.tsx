// Placeholder until real product photos exist (they come from the product
// owner). Keeps a fixed aspect ratio so the layout does not jump.
export function ProductImage({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 text-sm text-zinc-500 dark:from-zinc-800 dark:to-zinc-700 dark:text-zinc-400 ${className}`}
    >
      Снимка
    </div>
  );
}
