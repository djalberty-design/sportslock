import { useState, useEffect } from "react";
import { resolveLegTeam, resolvePlayerHeadshotSync, fetchPlayerHeadshot } from "@/lib/market/logos";
import { cn } from "@/lib/utils";

export function TicketLegAvatar({
  leg,
  size = "md",
}: {
  leg: {
    selection?: string;
    sport?: string;
    home?: string;
    away?: string;
    homeLogo?: string | null;
    awayLogo?: string | null;
    homeAbbr?: string | null;
    awayAbbr?: string | null;
    player?: string | null;
    headshot?: string | null;
    isProp?: boolean;
    marketType?: string;
    side?: string;
  };
  size?: "sm" | "md";
}) {
  const isProp = Boolean(
    leg?.isProp ||
    leg?.player ||
    leg?.marketType === "prop" ||
    String(leg?.marketType || "").startsWith("player_")
  );
  const playerName = leg?.player;
  const [headshot, setHeadshot] = useState<string | null>(
    leg?.headshot || (playerName ? resolvePlayerHeadshotSync(playerName) : null)
  );
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    if (leg?.headshot) {
      setHeadshot(leg.headshot);
      setImgErr(false);
      return;
    }
    if (isProp && playerName) {
      const sync = resolvePlayerHeadshotSync(playerName);
      if (sync) {
        setHeadshot(sync);
        setImgErr(false);
      } else {
        fetchPlayerHeadshot(playerName, leg?.sport).then((url) => {
          if (url) {
            setHeadshot(url);
            setImgErr(false);
          }
        });
      }
    }
  }, [leg?.headshot, isProp, playerName, leg?.sport]);

  const teamInfo = resolveLegTeam({
    sport: leg?.sport,
    home: leg?.home,
    away: leg?.away,
    homeAbbr: leg?.homeAbbr,
    awayAbbr: leg?.awayAbbr,
    homeLogo: leg?.homeLogo,
    awayLogo: leg?.awayLogo,
    selection: leg?.selection,
    side: leg?.side,
  });

  const logoUrl = teamInfo.selectionLogo || teamInfo.homeLogo || teamInfo.awayLogo;
  const sizeClass = size === "sm" ? "size-7" : "size-8";
  const initials = playerName
    ? playerName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : (teamInfo.homeAbbr || teamInfo.awayAbbr || leg?.sport?.slice(0, 3) || "?").toUpperCase();

  if (isProp && headshot && !imgErr) {
    return (
      <span className={cn("relative shrink-0 rounded-full overflow-hidden bg-panel ring-1 ring-line/80 flex items-center justify-center", sizeClass)}>
        <img
          src={headshot}
          alt={playerName || "Athlete"}
          className="size-full object-cover object-top"
          onError={() => setImgErr(true)}
        />
      </span>
    );
  }

  if (logoUrl && !imgErr) {
    return (
      <span className={cn("relative shrink-0 rounded-full overflow-hidden bg-white p-0.5 ring-1 ring-line/80 flex items-center justify-center", sizeClass)}>
        <img
          src={logoUrl}
          alt={leg?.selection || "Team"}
          className="size-full object-contain"
          onError={() => setImgErr(true)}
        />
      </span>
    );
  }

  return (
    <span className={cn("relative shrink-0 rounded-full bg-obsidian border border-line flex items-center justify-center text-[10px] font-mono font-bold text-muted", sizeClass)}>
      {initials}
    </span>
  );
}
