import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/parlay")({
  beforeLoad: () => {
    throw redirect({ to: "/picks" });
  },
});
