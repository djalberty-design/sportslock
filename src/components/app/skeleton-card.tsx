export function SkeletonCard() {
  return (
    <div className="paper-card animate-pulse p-4 flex flex-col gap-4">
      <div className="h-3 w-1/3 rounded bg-panel-border" />
      <div className="h-5 w-2/3 mt-2 rounded bg-panel-border" />
      <div className="h-12 w-20 mt-4 rounded bg-panel-border" />
      <div className="h-2 w-full mt-2 rounded bg-panel-border" />
    </div>
  );
}