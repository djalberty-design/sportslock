import { createAPIFileRoute } from '@tanstack/react-start/api';
import { gradeProps } from '@/lib/market/prop-grader';

export const APIRoute = createAPIFileRoute('/api/cron/grade-props')({
  GET: async ({ request }) => {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    const result = await gradeProps();
    return Response.json(result);
  },
});
