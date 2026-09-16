$content = Get-Content src/components/app/board-page.tsx -Raw
$newGameCard = @"
function GameCard({
  game: g,
  isCore,
  briefs,
  quotes,
  predict,
  rows,
  picks,
}: {
  game: ScanRow;
  isCore: boolean;
  briefs?: EventBrief[];
  quotes?: { eventId: string; awayRecord?: string; homeRecord?: string }[];
  predict?: PredictQuote[];
  rows: ScanRow[];
  picks?: DeskPick[];
}) {
  const existingPick = picks?.find((p) => p.eventId === g.eventId);
  if (existingPick) {
    return <PickCard pick={existingPick} featured={isCore} />;
  }
  const brief = briefs?.find((b) => b.eventId === g.eventId);
  const quote = quotes?.find((q) => q.eventId === g.eventId);
  const awayRec = brief?.awayRecord ?? quote?.awayRecord;
  const homeRec = brief?.homeRecord ?? quote?.homeRecord;
  const pred = predict?.find((p) => p.eventId === g.eventId);
  const fav = researchedFavorite(
    rows.filter((r) => r.eventId === g.eventId),
    brief,
    { home: g.home, away: g.away, kalshiHome: pred?.kalshiHome, polyHome: pred?.polyHome },
  );
  const lean = leanEnglish({
    home: g.home,
    away: g.away,
    oddsHome: g.side === "home" ? g.fairProb : 1 - g.fairProb,
    espnHome: brief?.espnHomeWin,
    ensembleHome: fav?.homeChance,
    crowdHome: pred?.kalshiHome ?? pred?.polyHome,
  });

  const awayLogo = g.awayLogo || (g.awayAbbr ? espnLogoUrl(g.sport, g.awayAbbr) : "");
  const homeLogo = g.homeLogo || (g.homeAbbr ? espnLogoUrl(g.sport, g.homeAbbr) : "");

  return (
    <article className={cn("paper-card relative p-4", isCore && "p-5 ring-2 ring-gold md:p-6")}>
      <Link
        to="/game/$eventId"
        params={{ eventId: g.eventId }}
        className="block"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="stamp text-gold">
            {isCore ? "THE PLAY" : sportLabel(g.sport)}
            {g.phase === "preseason" ? " · Preseason" : g.phase === "playoff" ? " · Playoff" : ""}
          </p>
          {(homeLogo || awayLogo) ? (
            <span className="flex -space-x-2">
              {awayLogo ? <img src={awayLogo} alt="" className="size-8 rounded-full bg-wash object-contain" /> : null}
              {homeLogo ? <img src={homeLogo} alt="" className="size-8 rounded-full bg-wash object-contain" /> : null}
            </span>
          ) : null}
        </div>
        <LiveStamp row={g} className="mt-1 block" />
        <h3 className={cn("font-display mt-2 text-ink", isCore ? "text-2xl md:text-3xl" : "text-lg")}>
          {lean.title}
        </h3>
        <p className="mt-1 text-sm text-gold">
          {g.start && !g.inPlay ? formatKickoff(g.start, true) : ""}
          {g.away && g.home ? ` · ${g.away}${awayRec ? ` (${awayRec})` : ""} @ ${g.home}${homeRec ? ` (${homeRec})` : ""}` : ""}
        </p>

        {isCore ? (
          <>
            {fav ? (
              <WagerMeter
                className="mt-3"
                size="lg"
                chance={fav.chance}
                price={g.price}
                label={`${fav.name} to win`}
              />
            ) : Number.isFinite(g.fairProb) ? (
              <WagerMeter className="mt-3" size="lg" chance={g.fairProb} price={g.price} />
            ) : null}
          </>
        ) : (
          <>
            {fav ? (
              <WagerMeter
                className="mt-3"
                size="sm"
                chance={fav.chance}
                price={g.price}
                label={`${fav.name} to win`}
              />
            ) : Number.isFinite(g.fairProb) ? (
              <WagerMeter className="mt-3" size="sm" chance={g.fairProb} price={g.price} />
            ) : null}
          </>
        )}

        <p className="mt-2 text-xs text-muted">
          {brief?.weather ?? ""}
          {brief?.injuryCount ? ` · ${brief.injuryCount} injury listings` : ""}
        </p>
        <p className="mt-3 text-xs font-medium text-gold">Bet this one game →</p>
      </Link>
    </article>
  );
}
"@
$content = $content -replace '(?s)function GameCard\(\{.*?\} \)\{.*?<\/Link>`n    \);`n  \}', $newGameCard
Set-Content src/components/app/board-page.tsx $content
