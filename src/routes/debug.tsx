import { getBoardSnapshot } from ""../lib/market/server"";
import { createFileRoute } from ""@tanstack/react-router"";

export const Route = createFileRoute(""/debug"")({
  loader: async () => {
    const snap = await getBoardSnapshot();
    return snap;
  },
  component: () => {
    const snap = Route.useLoaderData();
    return (
      <div className=""p-10 text-white"">
        <h1>Debug Snapshot</h1>
        <pre>{JSON.stringify(snap, null, 2)}</pre>
      </div>
    );
  }
});
