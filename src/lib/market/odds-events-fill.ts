/** Free Odds API /events list. Does not spend quota. */

export async function fetchEventSchedule(sportKey: string, apiKey: string): Promise<any[]> {
  if (!apiKey) return [];
  try {
    const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sportKey}/events?apiKey=${apiKey}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fillMissingEvents(mains: any[], apiKey: string, sports: string[]): Promise<any[]> {
  if (!Array.isArray(mains)) return mains || [];
  const out = mains.map((g) => ({ ...g, data: Array.isArray(g.data) ? [...g.data] : [] }));
  const keys = [...new Set([...out.map((g: any) => g.sport), ...sports])].filter(Boolean);
  await Promise.all(keys.map(async (sport) => {
    const events = await fetchEventSchedule(sport, apiKey);
    if (!events.length) return;
    let group = out.find((g: any) => g.sport === sport);
    if (!group) {
      group = { sport, data: [] };
      out.push(group);
    }
    const have = new Set(group.data.map((e: any) => e?.id));
    for (const ev of events) {
      if (!ev?.id || have.has(ev.id)) continue;
      group.data.push({
        id: ev.id,
        sport_key: sport,
        sport_title: ev.sport_title,
        commence_time: ev.commence_time,
        home_team: ev.home_team,
        away_team: ev.away_team,
        bookmakers: [],
      });
      have.add(ev.id);
    }
  }));
  return out;
}
