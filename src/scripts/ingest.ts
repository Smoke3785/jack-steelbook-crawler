import { runIngest } from "@/features/ingest/run-ingest";

async function main(): Promise<void> {
  const trigger = process.argv.includes("--cron") ? "cron" : "manual";

  console.log(`[ingest] starting (${trigger})`);

  const stats = await runIngest(trigger);

  const lines = stats.stores
    .filter((s) => !s.error || s.error === "disabled")
    .map(
      (s) =>
        `  ${s.storeId.padEnd(22)} fetched=${String(s.fetched).padStart(4)} new=${String(s.created).padStart(3)} price=${String(s.priceChanges).padStart(3)} avail=${String(s.availabilityFlips).padStart(3)} removed=${String(s.removed).padStart(3)}`,
    );

  console.log(`[ingest] stores:\n${lines.join("\n")}`);

  const errored = stats.stores.filter((s) => s.error && s.error !== "disabled");

  if (errored.length > 0) {
    console.error(`[ingest] ${errored.length} store(s) failed:`);

    for (const store of errored) {
      console.error(`  ${store.storeId}: ${store.error}`);
    }
  }

  console.log(
    `[ingest] parsed=${stats.parsed} editionsTouched=${stats.editionsTouched} tmdbMatched=${stats.tmdb.matched}/${stats.tmdb.matched + stats.tmdb.skipped}`,
  );
  console.log(`[ingest] done in ${Math.round((Date.now() - Date.parse(stats.startedAt)) / 1000)}s`);
}

main().catch((err) => {
  console.error("[ingest] fatal:", err);
  process.exitCode = 1;
});
