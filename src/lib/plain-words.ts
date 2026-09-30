/** Everyday labels. Ranking math does not live here. */

export type ChipId =
  | "look-strong"
  | "look-fair"
  | "look-thin"
  | "photo-from"
  | "photo-needed"
  | "tape-hr"
  | "research"
  | "edge-up"
  | "edge-down"
  | "the-call"
  | "top-pick"
  | "under-60"
  | "highest-today"
  | "early-mover"
  | "fee"
  | "lock-now"
  | "wait";

export const LOOK_LABEL = {
  high: "Strong look",
  medium: "Fair look",
  low: "Thin look",
} as const;

export const CHIP_LINE: Record<ChipId, { title: string; line: string }> = {
  "look-strong": {
    title: "Strong look",
    line: "We have a full enough picture to show this number. Not a promise it hits.",
  },
  "look-fair": {
    title: "Fair look",
    line: "Usable, some pieces missing.",
  },
  "look-thin": {
    title: "Thin look",
    line: "Thin data. Treat as research.",
  },
  "photo-from": {
    title: "Manual odds entry",
    line: "The odds were entered or confirmed from your sportsbook.",
  },
  "photo-needed": {
    title: "Confirm live price",
    line: "The % is research on a consensus number until confirmed on your sportsbook.",
  },
  "tape-hr": {
    title: "Sportsbook number",
    line: "A market price from our live odds consensus feed.",
  },
  research: {
    title: "Research only — verify live line",
    line: "This number is research. Check your sportsbook for live odds before tracking.",
  },
  "edge-up": {
    title: "Better than the book",
    line: "Our chance is higher than the chance baked into the book's price.",
  },
  "edge-down": {
    title: "Worse than the book",
    line: "Our chance is lower than the chance baked into the book's price.",
  },
  "the-call": {
    title: "The Call",
    line: "The gold-ribbon single — highest-conviction gated play of the day. Still not a guarantee. This site never places the bet.",
  },
  "top-pick": {
    title: "The Call",
    line: "The gold-ribbon single. Same gates as The Call. Still not a guarantee.",
  },
  "under-60": {
    title: "Under 60%",
    line: "Chance is under 60%. Not a hide, not a lock.",
  },
  "highest-today": {
    title: "Highest Probability Today",
    line: "Nobody on this delayed board cleared the 65% Safest floor, so the desk shows the highest-probability ticket instead of a blank column.",
  },
  "early-mover": {
    title: "Early Mover Advantage",
    line: "Prediction markets moved ahead of sportsbooks. Check your sportsbook before the line reprices.",
  },
  fee: {
    title: "Sportsbook Fee",
    line: "The cut the sportsbook takes. Higher fee = worse deal for you.",
  },
  "lock-now": {
    title: "Beat the Line Move",
    line: "Smart money is moving this number. Check your sportsbook before the key number moves. Not a guarantee it hits.",
  },
  wait: {
    title: "Wait for Better Price",
    line: "Heavy public betting is inflating the favorite. Waiting can yield a better underdog payout near game time.",
  },
};

export const HOW_IT_WORKS = [
  { n: "01", title: "Set bankroll", body: "Type what you can spend on Start." },
  { n: "02", title: "Pick a ticket", body: "AI Picks names one. Tap the card." },
  { n: "03", title: "Track on Ticket", body: "Add your bet to track it on your ledger." },
  { n: "04", title: "Auto-graded", body: "After the game, bets settle automatically." },
] as const;

export const WORDS_WE_USE: { id: string; word: string; line: string }[] = [
  { id: "chance", word: "Chance it hits", line: "How often we think this ticket wins." },
  { id: "book", word: "Book", line: "Chance baked into the sportsbook's price." },
  { id: "edge", word: "Edge", line: "Our chance minus the book’s chance." },
  {
    id: "look",
    word: "Strong / Fair / Thin look",
    line: "How complete the information is. Not the chance it hits.",
  },
  {
    id: "photo",
    word: "Check live odds",
    line: "Always check your sportsbook for the latest lines.",
  },
  { id: "call", word: "The Call", line: "The gold-ribbon single of the day. Highest-conviction gated play. Not a guarantee." },
  { id: "best-value", word: "Best Value", line: "The column of smart extra vs the sportsbook fee. Not the gold ribbon." },
  { id: "parlay", word: "Combo Bet", line: "Multiple picks tied together. All must win to get paid, but it pays much higher." },
  { id: "same-game", word: "Same-Game Combo", line: "Multiple picks from the exact same game tied together." },
  { id: "who-wins", word: "Pick Who Wins", line: "Simply pick which team wins the game. No point spread." },
  { id: "margin", word: "Score Margin", line: "Your team must win by more than this number of points (or lose by less)." },
  { id: "combined", word: "Combined Score", line: "The total points or runs scored by both teams combined." },
  { id: "fee", word: "Sportsbook Fee", line: "The cut the sportsbook takes. Higher fee = worse deal for you." },
  { id: "smart-value", word: "Smart Value (+Edge)", line: "You are getting paid more than the true statistical chance of it happening." },
  { id: "beat-market", word: "Beating the Market", line: "Getting a better number early before the rest of the public moves the line." },
  { id: "smart-money", word: "Smart Money Moving", line: "Large amounts of money just moved this number. Act now before it gets worse." },
  { id: "push", word: "Tie / Refund", line: "The game landed on the exact number. You get your original money back." },
  { id: "luck", word: "Game Luck vs. Strategy", line: "Normal good or bad bounces (fumbles, referee calls) that happen in sports." },
  { id: "live", word: "Live", line: "The game already started." },
  { id: "log", word: "Ticket Tab", line: "Where your tracked bets wait, settling automatically or manually." },
  { id: "never-bet", word: "This site never places a bet", line: "You place it at your sportsbook if you want." },
];

export const MORE_LINKS = [
  { to: "/more", hash: "how", label: "How this site works", note: "Four simple steps to track your action." },
  { to: "/more", hash: "desks", label: "Desks and pin", note: "Every desk and the live constants." },
  { to: "/more", hash: "never", label: "What this site will never do", note: "Hard lines. A later feature cannot cross them." },
  { to: "/more", hash: "words", label: "Words we use", note: "Chance, look, The Call, Best Value." },
  { to: "/more", hash: "money", label: "My money", note: "Core 85% and Fun 15%. What you typed on Start." },
  { to: "/gameday", hash: "", label: "Game day", note: "Kickoff, the pick, the dollars. One screen." },
  { to: "/parlay", hash: "", label: "Combos", note: "2-, 3-, and 4-pick tickets. Same-game included." },
  { to: "/learn", hash: "", label: "Learn", note: "Short lessons." },
  { to: "/guide", hash: "", label: "Guide", note: "The full walkthrough." },
  { to: "/slate", hash: "", label: "Fantasy", note: "DraftKings Fantasy — salary cap, not a sportsbook ticket." },
  { to: "/alerts", hash: "", label: "Reminders / honesty", note: "Delays. No auto-bet. This site never places a bet." },
  { to: "/admin", hash: "", label: "Admin", note: "Allowlist, algorithm knobs, master ledger, feed health." },
] as const;

export const PHOTO_BANNER =
  "Check your sportsbook for live odds, then track your bets on the Ticket tab.";

export function lookChipId(band: "high" | "medium" | "low"): ChipId {
  if (band === "high") return "look-strong";
  if (band === "medium") return "look-fair";
  return "look-thin";
}

export function tapeChip(
  stamp?: "photographed" | "hr-fl" | "research",
  researchOnly?: boolean,
  fromUserPhoto?: boolean,
): {
  id: ChipId;
  label: string;
} {
  if (fromUserPhoto) return { id: "photo-from", label: "Price from your photo" };
  if (researchOnly || stamp === "research") {
    return { id: "research", label: "Research only — photo still needed for the live price" };
  }
  if (stamp === "hr-fl" || stamp === "photographed") {
    return { id: "tape-hr", label: "Hard Rock number (not from your photo)" };
  }
  return { id: "photo-needed", label: "Photo to lock this price" };
}
