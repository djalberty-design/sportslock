const fs = require('fs');

// 1. Update joint-grade.ts
let joint = fs.readFileSync('src/lib/market/joint-grade.ts', 'utf8');
joint = joint.replace(
  /export type JointLeg = \{[\s\S]*?isProp\?: boolean;\n\};/,
  `export type JointLeg = {\n  eventId: string;\n  marketType: string;\n  side: string;\n  fairProb?: number;\n  simFair?: number;\n  price?: number;\n  isProp?: boolean;\n  selection?: string;\n  sport?: string;\n};`
);
fs.writeFileSync('src/lib/market/joint-grade.ts', joint);

// 2. Update copula.ts
let copula = fs.readFileSync('src/lib/market/copula.ts', 'utf8');
copula = copula.replace(
  /export function sameGameRho\(legs: \{ marketType: string; side: string; fairProb\?: number \}\[\]\): number \{/,
  `export function sameGameRho(legs: { marketType: string; side: string; fairProb?: number; selection?: string; sport?: string }[]): number {`
);

let copulaLogic = `
  else if (types.has("prop") && (types.has("ml") || types.has("spread"))) {
    // Step 5.2: Correlated SGP Pricing (Monte Carlo Sandbox Matrix Edge)
    // When combining a Player Prop with a Game Script (ML/Spread), we dynamically price 
    // the true correlation. E.g., RBs rushing OVER correlates massively with their team covering the spread.
    const prop = legs.find((l) => l.marketType === "prop");
    const game = legs.find((l) => l.marketType === "ml" || l.marketType === "spread");
    
    if (prop && game && prop.selection) {
      const isOver = /over/i.test(prop.side) || /over/i.test(prop.selection);
      const isUnder = !isOver;
      const isRush = /rush/i.test(prop.selection);
      const isPass = /pass|yds/i.test(prop.selection) && !isRush;
      
      // Approximation: If the game leg has > 50% win probability, they are the expected winner
      const teamWinning = game.fairProb ? (game.fairProb > 0.5) : true;

      if (isRush) {
        // Rushing is positively correlated with winning (killing the clock late in blowouts)
        baseRho = isOver ? (teamWinning ? 0.65 : -0.45) : (teamWinning ? -0.35 : 0.50);
      } else if (isPass) {
        // Passing is negatively correlated with blowouts, highly correlated with trailing
        baseRho = isOver ? (teamWinning ? -0.25 : 0.60) : (teamWinning ? 0.40 : -0.35);
      } else {
        baseRho = isOver ? 0.20 : -0.20; // Generic prop correlation
      }
    } else {
      baseRho = 0.15;
    }
  } else if (types.has("prop")) {
`;

copula = copula.replace(
  /  \} else if \(types\.has\("prop"\)\) \{/,
  copulaLogic.trim()
);
fs.writeFileSync('src/lib/market/copula.ts', copula);

console.log("Replaced successfully!");