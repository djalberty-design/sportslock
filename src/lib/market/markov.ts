/**
 * Step 6.4: The Possession-Level Markov Chain
 * Instead of simulating final scores purely from a top-down standard deviation,
 * we use Transition Matrices to simulate pitch-by-pitch or possession-by-possession scripts.
 */

export type TransitionState = "Start" | "Run" | "Pass" | "Foul" | "Turnover" | "Score" | "End";

export type MarkovMatrix = Record<TransitionState, Record<TransitionState, number>>;

// A standard NBA possession transition matrix (simplified)
export const NBA_BASE_MATRIX: MarkovMatrix = {
  Start: { Start: 0, Run: 0.1, Pass: 0.7, Foul: 0.15, Turnover: 0.05, Score: 0, End: 0 },
  Run: { Start: 0, Run: 0.05, Pass: 0.3, Foul: 0.1, Turnover: 0.05, Score: 0.5, End: 0 },
  Pass: { Start: 0, Run: 0.05, Pass: 0.35, Foul: 0.1, Turnover: 0.1, Score: 0.4, End: 0 },
  Foul: { Start: 0, Run: 0, Pass: 0, Foul: 0, Turnover: 0, Score: 0.9, End: 0.1 }, // FTs
  Turnover: { Start: 0, Run: 0, Pass: 0, Foul: 0, Turnover: 0, Score: 0, End: 1 },
  Score: { Start: 0, Run: 0, Pass: 0, Foul: 0, Turnover: 0, Score: 0, End: 1 },
  End: { Start: 1, Run: 0, Pass: 0, Foul: 0, Turnover: 0, Score: 0, End: 0 },
};

export function simulatePossession(matrix: MarkovMatrix, startState: TransitionState = "Start"): TransitionState {
  let current = startState;
  
  // Cap at 20 transitions to prevent infinite loops in malformed matrices
  for (let step = 0; step < 20; step++) {
    if (current === "End") return "End";
    
    const row = matrix[current];
    const roll = Math.random();
    
    let cumulative = 0;
    for (const [nextState, prob] of Object.entries(row)) {
      cumulative += prob;
      if (roll <= cumulative) {
        current = nextState as TransitionState;
        break;
      }
    }
  }
  
  return "End";
}

/**
 * Adjust the base matrix based on specific player/team tendencies (The Edge).
 * e.g., A heavy passing offense increases the Pass transition probability.
 */
export function compoundMarkovMatrix(base: MarkovMatrix, runRate: number, passRate: number): MarkovMatrix {
  // In a real scenario, this normalizes the matrix using the team's true pace/rates.
  // For now, we return the base matrix injected with the dynamic weights.
  const dynamicMatrix = JSON.parse(JSON.stringify(base)) as MarkovMatrix;
  
  // Inflate pass probabilities
  dynamicMatrix.Start.Pass += (passRate * 0.1);
  dynamicMatrix.Start.Run -= (passRate * 0.1);
  
  // Normalize row
  const sum = Object.values(dynamicMatrix.Start).reduce((a, b) => a + b, 0);
  for (const key of Object.keys(dynamicMatrix.Start)) {
    dynamicMatrix.Start[key as TransitionState] /= sum;
  }
  
  return dynamicMatrix;
}