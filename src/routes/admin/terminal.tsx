import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Clock, Wifi } from "lucide-react";
import { getOddsQuotaFn } from "@/lib/market/server";
import { getTapeStatsFn } from "@/lib/market/tape-server";
import { useDeskDecision } from "@/lib/market/use-board";

export const Route = createFileRoute("/admin/terminal")({ component: Live Status });
