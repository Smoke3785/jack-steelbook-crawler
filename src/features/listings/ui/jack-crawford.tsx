import Image from "next/image";

/**
 * The hardcoded Jack Crawford result. Pinned into results (both views) when
 * the search query matches him — no listing behind it, price is what it is.
 */

const META_LINE = "The collector himself";

/** True when the search query would surface Jack as a result (e.g. "jack", "crawford", "jac"). */
export function matchesJackCrawfordQuery(q: string): boolean {
  const tokens = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const names = ["jack", "crawford"];

  return tokens.some((token) =>
    names.some((name) => token.startsWith(name) || name.startsWith(token)),
  );
}

export function JackCrawfordCard() {
  return (
    <div className="flex flex-col border-b border-r p-[6px] border-zinc-800">
      <div className="flex flex-1 flex-col p-[6px] bg-zinc-900">
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-800">
          <Image
            src="/jack-crawford.jpg"
            alt="Jack Crawford"
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            priority={false}
            className="object-cover"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2 pt-2">
          <div>
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">
              Jack Crawford
            </h3>
            <p className="mt-0.5 text-xs text-zinc-400">{META_LINE}</p>
          </div>

          <div className="mt-auto flex items-center justify-between gap-2">
            <span className="text-sm font-semibold italic text-zinc-100">
              Priceless
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function JackCrawfordRow() {
  return (
    <div className="flex items-center border-b border-r p-[6px] border-zinc-800">
      <div className="flex min-w-0 flex-1 items-center gap-3 p-[6px] bg-zinc-900">
        <div className="relative h-[72px] w-12 shrink-0 overflow-hidden bg-zinc-800">
          <Image
            src="/jack-crawford.jpg"
            alt="Jack Crawford"
            fill
            sizes="48px"
            className="object-cover"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-sm font-semibold text-zinc-100">
            Jack Crawford
          </span>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-400">
            <span>{META_LINE}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end">
          <span className="text-sm font-semibold italic text-zinc-100">
            Priceless
          </span>
        </div>
      </div>
    </div>
  );
}
