import { ScreenshotIngest } from "./screenshot-ingest";

export function PhotoWagerCta({ what }: { what: string }) {
  return (
    <details className="mt-4 rounded-md bg-wash px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-ink">
        Don't see your {what}? Upload a Custom Parlay.
      </summary>
      <p className="mt-2 text-xs text-muted">
        Only use this to upload a screenshot of a custom parlay that cannot be built on SportsLock.
      </p>
      <div className="mt-3">
        <ScreenshotIngest embedded heading="Upload a Custom Parlay" />
      </div>
    </details>
  );
}
