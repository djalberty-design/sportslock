import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/desk")({
  component: DeskRedirect,
});

function DeskRedirect() {
  return <Navigate to="/ticket" />;
}
