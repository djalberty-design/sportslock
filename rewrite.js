const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/lib/market/chance.ts');
let content = fs.readFileSync(filePath, 'utf8');

const buildChanceRegex = /const pooled = poolLayers\(layers, input\.oddsHome \?\? input\.bookHome, input\.layerHaircuts\);[\s\S]*?because: "Apex Engine evaluation complete.",\n  \};\n\}/;

const newBuildChance = `const pooled = poolLayers(layers, input.oddsHome ?? input.bookHome, input.layerHaircuts);
  let home = pooled.mean;

  if (input.total != null && input.total > 0) {
    const avg = leagueTotal(sport);
    const chaos = Math.max(0, Math.min(0.22, (input.total - avg) / (avg * 4)));
    home = 0.5 + (home - 0.5) * (1 - chaos);
  }

  home = Math.min(FINAL_HI, Math.max(FINAL_LO, home));

  const n = layers.length;
  const std = pooled.std;
  const agreement = Math.max(0, 1 - std / 0.14);
  const families = new Set(layers.map((l) => l.family)).size;
  const confidence: ChanceReport["confidence"] =
    n >= 6 && families >= 3 && std < 0.05 && pooled.posteriorVar < 0.012 ? "high" : n >= 3 && std < 0.1 ? "medium" : "low";

  const favorite = home >= 0.5 ? "home" : "away";
  const chance = favorite === "home" ? home : 1 - home;
  
  // Phase 1.1: Visual Shadowing of Double-Counted Layers
  const activeIds = new Set(pooled.activeIds || []);
  for (const l of layers) {
    if (!activeIds.has(l.id) && l.id !== "market" && !l.empty && pooled.isAnchored) {
      l.note = "[PRICED IN] " + l.note;
      // We don't mark as empty because we still want the UI to show the data,
      // but the UI or the math now knows it was mathematically ignored.
    }
  }

  return {
    home,
    away: 1 - home,
    favorite,
    favoriteName: favorite === "home" ? input.home : input.away,
    chance,
    confidence,
    agreement,
    layers,
    posteriorVar: pooled.posteriorVar,
    because: "Apex Engine evaluation complete.",
  };
}`;

content = content.replace(buildChanceRegex, newBuildChance);


const poolLayersRegex = /function poolLayers\([\s\S]*?return \{\n\s*mean: invLogit\(z, FINAL_LO, FINAL_HI\),\n\s*std,\n\s*posteriorVar: 1 \/ precSum,\n\s*overdispersed,\n\s*\};\n\}/;

const newPoolLayers = `function poolLayers(
  layers: ChanceLayer[],
  marketHome?: number,
  haircuts?: Record<string, number>,
): { mean: number; std: number; posteriorVar: number; overdispersed: boolean; activeIds?: string[]; isAnchored?: boolean } {
  const active = layers
    .map((l) => {
      const h = haircuts?.[l.id];
      if (h == null || h === 1 || !Number.isFinite(h)) return l;
      return { ...l, precision: l.precision * Math.max(0, h) };
    })
    .filter((l) => l.precision > 0 && !l.empty);
    
  if (!active.length) {
    return { mean: 0.5, std: 0, posteriorVar: 1, overdispersed: false };
  }
  
  const meanP = active.reduce((s, l) => s + l.home, 0) / active.length;
  const variance = active.reduce((s, l) => s + (l.home - meanP) ** 2, 0) / active.length;
  const std = Math.sqrt(variance);

  // STEP 1.1: THE SHARP ANCHOR
  // If a highly efficient market baseline exists (Pinnacle/Sportsbook), it becomes the absolute Prior.
  // We DO NOT blend public information (injuries, weather, records, form) against it because the 
  // market has already mathematically priced them in. Doing so causes Bayesian Double-Counting.
  const anchorLayer = active.find((l) => l.id === "market" || l.id === "open" || l.id === "book" || l.id === "spread");

  if (anchorLayer && marketHome != null) {
    let z = logit(marketHome);
    const activeIds = [anchorLayer.id];

    // STEP 1.2: THE ALPHA HOOK SYSTEM
    // We only apply specific market inefficiencies that sportsbooks famously misprice (Alpha Plugins)
    // or crowd prediction markets (Kalshi/Polymarket) to find discrepancies against the bookmaker.
    const alphaPlugins = ["officials", "steam", "b2b", "rest"]; // Contextual Alpha
    const crowdPlugins = ["kalshi", "poly"]; // Wisdom of the Crowd Alpha

    for (const l of active) {
      if (alphaPlugins.includes(l.id)) {
        // Extract the raw logit deviation this alpha provides, and compound it onto the anchor.
        const delta = logit(l.home) - logit(0.5);
        z += delta;
        activeIds.push(l.id);
      }
      if (crowdPlugins.includes(l.id)) {
        // Blend prediction markets against the sportsbook using their respective precision weights.
        const totalPrec = anchorLayer.precision + l.precision;
        z = (z * anchorLayer.precision + logit(l.home) * l.precision) / totalPrec;
        activeIds.push(l.id);
      }
    }

    return {
      mean: invLogit(z, FINAL_LO, FINAL_HI),
      std,
      posteriorVar: 1 / (anchorLayer.precision * 1.5),
      overdispersed: false,
      activeIds,
      isAnchored: true
    };
  }

  // BOTTOM-UP BAYESIAN BLENDER (Synthetic Generator)
  // If NO market line exists (e.g., generating synthetic odds weeks in advance),
  // we default back to pooling the raw public data (injuries, form, records, Elo).
  const precSum0 = active.reduce((s, l) => s + l.precision, 0);
  const logitMean0 = active.reduce((s, l) => s + logit(l.home) * l.precision, 0) / precSum0;

  let chi = 0;
  for (const l of active) chi += l.precision * (logit(l.home) - logitMean0) ** 2;
  const df = Math.max(1, active.length - 1);
  const overdispersed = chi / df > 1.35;

  const scaled = active.map((l) => {
    if (!overdispersed) return l;
    if (l.family === "market") return l;
    const shrink = Math.max(0.35, 1.35 / (chi / df));
    return { ...l, precision: l.precision * shrink };
  });

  const precSum = scaled.reduce((s, l) => s + l.precision, 0);
  let z = scaled.reduce((s, l) => s + logit(l.home) * l.precision, 0) / precSum;

  return {
    mean: invLogit(z, FINAL_LO, FINAL_HI),
    std,
    posteriorVar: 1 / precSum,
    overdispersed,
    activeIds: active.map(l => l.id),
    isAnchored: false
  };
}`;

content = content.replace(poolLayersRegex, newPoolLayers);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Rewrote poolLayers and buildChance in chance.ts!");