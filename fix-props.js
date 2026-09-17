const fs = require('fs');

let props = fs.readFileSync('src/lib/market/props.ts', 'utf8');
props = props.replace(
  /    const grudgeLayer = applyRefereeGrudgeToProps\(parsed\.stat, input\.player, input\.officials\);\n    if \(grudgeLayer\) push\(layers, grudgeLayer\);\n  \}/,
  `    const grudgeLayer = applyRefereeGrudgeToProps(parsed.stat, input.player, input.officials);
    if (grudgeLayer) push(layers, grudgeLayer);
  }

  // Step 6.3: In-Game Micro-Correlations (Foul Trouble Ripple)
  if (input.matchupFoulRate != null && Number.isFinite(input.matchupFoulRate)) {
    if (parsed.stat === "points" || parsed.stat === "pra") {
      const z = clip((input.matchupFoulRate - 4.0) / 2.0, -0.4, 0.4); // 4.0 fouls/36 is avg for bigs
      if (Math.abs(z) > 0.05) {
        push(layers, {
          id: "foul_ripple",
          label: "Foul Trouble Ripple",
          p: invLogit(z),
          precision: 2.5,
          family: "alpha",
          note: \`[ALPHA] Primary matchup is highly prone to foul trouble (FoulRate: \${input.matchupFoulRate}).\`,
        });
      }
    }
  }`
);
fs.writeFileSync('src/lib/market/props.ts', props);