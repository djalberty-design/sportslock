import { createFileRoute } from "@tanstack/react-router";
import { DeskPage } from "@/components/app/desk-page";
import { TicketPage } from "@/components/app/ticket-page";

export const Route = createFileRoute("/ticket")({
  validateSearch: (s: Record<string, unknown>): { id: string } => ({
    id: ticketSearchId(s),
  }),
  component: TicketRoute,
});

function ticketSearchId(s: Record<string, unknown>): string {
  const raw = s.id;
  if (typeof raw === "string" && raw) return raw;
  if (Array.isArray(raw)) return raw.map(String).join("|");
  if (raw != null && raw !== "") return String(raw);
  return "";
}

function TicketRoute() {
  const { id } = Route.useSearch();
  if (!id) return <DeskPage />;
  return <TicketPage ticketId={id} />;
}
