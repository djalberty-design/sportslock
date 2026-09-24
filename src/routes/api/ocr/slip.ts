import { createFileRoute } from "@tanstack/react-router";
import { parseSlipImageEdge, type EdgeSlipResult, type MatchCandidate } from "@/lib/market/slip-ocr-edge";

export const Route = createFileRoute("/api/ocr/slip")({
  server: {
    handlers: {
      POST: async ({ request }) => handleOcrSlip(request),
    },
  },
});

async function handleOcrSlip(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const image = typeof body.image === "string" ? body.image.trim() : "";

    if (!image) {
      return new Response(
        JSON.stringify({ ok: false, error: "Image data (base64 or data URL) is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const mime = typeof body.mime === "string" ? body.mime : "image/jpeg";
    const candidates: MatchCandidate[] = Array.isArray(body.candidates) ? body.candidates : [];

    const result: EdgeSlipResult = await parseSlipImageEdge({
      image,
      mime,
      activeCandidates: candidates,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[api/ocr/slip] Processing error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Slip OCR processing failed: " + (err?.message || String(err)),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
