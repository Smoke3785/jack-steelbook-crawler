import type { Metadata } from "next";
import { getStatus, type IngestRunSummary } from "@/features/status/queries";
import { Badge } from "@/shared/ui/badge";
import { formatDateTime, timeAgo, timeUntil } from "@/shared/lib/format";
import { storeName } from "@/shared/lib/stores";

export const metadata: Metadata = {
  title: "Status",
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border-b border-r border-zinc-800 p-[6px]">
      <div className="flex h-full flex-col bg-zinc-900 p-[6px]">
        <p className="text-[11px] uppercase tracking-wide text-zinc-400">
          {label}
        </p>
        <p className="mt-0.5 text-lg font-semibold text-zinc-50" title={hint}>
          {value}
        </p>
        {hint ? <p className="text-[11px] text-zinc-400">{hint}</p> : null}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-x border-zinc-800 px-[18px] pb-1 pt-[3.5rem] text-xs font-medium uppercase tracking-wide text-zinc-400">
      {children}
    </h2>
  );
}

function RunRow({ run }: { run: IngestRunSummary }) {
  const failed = run.stores.filter((s) => s.error && s.error !== "disabled");

  return (
    <li className="flex flex-col gap-1 border-b border-zinc-800 px-[18px] py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge
          tone={
            run.finished_at
              ? failed.length > 0
                ? "new"
                : "available"
              : "sold-out"
          }
        >
          {run.finished_at
            ? failed.length > 0
              ? `${failed.length} store error(s)`
              : "ok"
            : "running"}
        </Badge>
        <span className="text-sm font-medium text-zinc-200">
          run #{run.id} · {run.trigger}
        </span>
        <span className="text-xs text-zinc-400">
          {formatDateTime(run.started_at)} · {timeAgo(run.started_at)}
        </span>
        <span className="ml-auto text-xs text-zinc-400">
          {run.duration_seconds !== null ? `${run.duration_seconds}s` : "—"}
        </span>
      </div>

      <p className="text-xs text-zinc-400">
        {run.stores
          .filter((s) => !s.error)
          .reduce((sum, s) => sum + s.fetched, 0)
          .toLocaleString()}{" "}
        products fetched · {run.stores.reduce((sum, s) => sum + s.created, 0)}{" "}
        new · {run.stores.reduce((sum, s) => sum + s.priceChanges, 0)} price
        changes · {run.stores.reduce((sum, s) => sum + s.availabilityFlips, 0)}{" "}
        stock flips
        {run.parsed !== null ? ` · ${run.parsed} parsed` : ""}
        {run.tmdb_matched !== null
          ? ` · TMDB ${run.tmdb_matched}/${(run.tmdb_matched ?? 0) + (run.tmdb_skipped ?? 0)}`
          : ""}
      </p>

      {failed.length > 0 ? (
        <p className="text-xs text-rose-500">
          {failed.map((s) => `${storeName(s.storeId)}: ${s.error}`).join(" · ")}
        </p>
      ) : null}
    </li>
  );
}

export default async function StatusPage() {
  const status = await getStatus();

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-x border-zinc-800 px-[18px] pb-[12px] pt-[18px]">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          Status
        </h1>
        <p className="text-xs text-zinc-400">
          next scheduled ingest {formatDateTime(status.next_cron_at)} ·{" "}
          {timeUntil(status.next_cron_at)}
        </p>
      </div>

      <div className="grid grid-cols-2 border-l border-t border-zinc-800 sm:grid-cols-3 xl:grid-cols-6">
        <Stat
          label="Listings"
          value={status.listing_count.toLocaleString()}
          hint={`${status.removed_count.toLocaleString()} delisted`}
        />
        <Stat label="Editions" value={status.edition_count.toLocaleString()} />
        <Stat
          label="Movies"
          value={status.movie_count.toLocaleString()}
          hint={`${status.matched_edition_count.toLocaleString()} editions matched`}
        />
        <Stat
          label="Stores"
          value={`${status.enabled_store_count}/${status.store_count}`}
          hint="enabled / registered"
        />
        <Stat
          label="Events"
          value={status.events_total.toLocaleString()}
          hint="all time"
        />
        <Stat
          label="TMDB"
          value={status.tmdb_configured ? "configured" : "off"}
          hint={
            status.tmdb_configured
              ? "matching active"
              : "set TMDB_API_KEY to enable"
          }
        />
      </div>

      <p className="border-x border-zinc-800 px-[18px] py-1.5 text-[11px] text-zinc-400">
        {status.db_path}
        {status.db_size_bytes !== null
          ? ` · ${(status.db_size_bytes / 1024 / 1024).toFixed(1)} MB`
          : ""}
      </p>

      <SectionLabel>Events · last 24 hours</SectionLabel>

      <ul className="border-x border-t border-zinc-800">
        {status.events_last_24h.length === 0 ? (
          <li className="border-b border-zinc-800 px-[18px] py-2 text-sm text-zinc-400">
            No listing events recorded.
          </li>
        ) : (
          status.events_last_24h.map((e) => (
            <li
              key={e.type}
              className="flex items-center justify-between border-b border-zinc-800 px-[18px] py-1.5 text-sm"
            >
              <span className="text-zinc-300">{e.type}</span>
              <span className="font-semibold text-zinc-100">
                {e.n.toLocaleString()}
              </span>
            </li>
          ))
        )}
      </ul>

      <SectionLabel>Ingest runs</SectionLabel>

      <ul className="border-x border-t border-zinc-800">
        {status.recent_runs.length === 0 ? (
          <li className="border-b border-zinc-800 px-[18px] py-2 text-sm text-zinc-400">
            No runs yet — start one with `npm run ingest`.
          </li>
        ) : (
          status.recent_runs.map((run) => <RunRow key={run.id} run={run} />)
        )}
      </ul>
    </main>
  );
}
