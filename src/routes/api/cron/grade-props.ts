import { createFileRoute } from "@tanstack/react-router";
import { gradeProps } from "@/lib/market/prop-grader";

export const Route = createFileRoute("/api/cron/grade-props")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const result = await gradeProps();
        return Response.json(result);
      },
    },
  },
});
