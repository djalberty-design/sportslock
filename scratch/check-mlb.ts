async function checkMLB() {
  const dates = ["20260915", "20260916"];
  for (const date of dates) {
    console.log(\n---  ---);
    const res = await fetch(https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=);
    const data = await res.json();
    for (const ev of data.events || []) {
      console.log(${ev.name} |  | );
    }
  }
}
checkMLB().catch(console.error);
