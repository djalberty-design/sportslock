const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/lib/market/props.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add usageRipple to PropInput
content = content.replace(
  "seasonRate?: number;",
  "usageRipple?: number;\n  seasonRate?: number;"
);

// 2. Add usageRipple to propContextFromBrief return type
content = content.replace(
  "| \"awayLooks\"",
  "| \"awayLooks\"\n    | \"usageRipple\""
);

// 3. Add logic in propContextFromBrief
const propContextRegex = /const vsHand = oppHand === "L" \? ownLooks\?\.vsLeft : oppHand === "R" \? ownLooks\?\.vsRight : undefined;/;
const propContextReplacement = `const vsHand = oppHand === "L" ? ownLooks?.vsLeft : oppHand === "R" ? ownLooks?.vsRight : undefined;

  let usageRipple = 0;
  if (player && (stat === "rec_yds" || stat === "receptions" || stat === "rush_yds" || stat === "rush_att" || stat === "pass_yds" || stat === "pass_td" || stat === "points" || stat === "assists" || stat === "rebounds")) {
    const isOut = (st: string) => /out|il|doubtful|suspended|pup|ir/i.test(st ?? "");
    const ownInjuries = (brief?.injuries ?? []).filter(i => {
       const p = (brief?.players ?? []).find(p2 => p2.name && i.player && (p2.name === i.player || p2.name.includes(i.player) || i.player.includes(p2.name)));
       if (!p) return false;
       const pAway = p.team ? (p.team.toLowerCase() === opts.away.toLowerCase() || opts.away.toLowerCase().includes(p.team.toLowerCase())) : playerIsAway(p, opts.home, opts.away, p.team);
       return pAway === awaySide && isOut(i.status) && p.name !== player.name;
    });

    for (const inj of ownInjuries) {
       const p = (brief?.players ?? []).find(p2 => p2.name && inj.player && (p2.name === inj.player || p2.name.includes(inj.player)));
       if (!p) continue;
       const pos = (p.position || "").toUpperCase();
       const isGridiron = brief?.sport === "NFL" || brief?.sport === "NCAAF";
       const isHardwood = brief?.sport === "NBA" || brief?.sport === "NCAAB";
       
       if (isGridiron) {
         if (stat === "rec_yds" || stat === "receptions") {
           if (pos === "WR" || pos === "TE") usageRipple += 0.08; 
         } else if (stat === "rush_yds" || stat === "rush_att") {
           if (pos === "RB") usageRipple += 0.12; 
         } else if (stat === "pass_yds" || stat === "pass_td") {
           if (pos === "WR" || pos === "TE") usageRipple -= 0.04;
         }
       }
    }
  }`;

content = content.replace(propContextRegex, propContextReplacement);

// 4. Add usageRipple to the returned object
const returnRegex = /homeLooks: brief\?\.homeLooks,\n\s*awayLooks: brief\?\.awayLooks,\n\s*\};\n\}/;
const returnReplacement = `homeLooks: brief?.homeLooks,
    awayLooks: brief?.awayLooks,
    usageRipple: usageRipple !== 0 ? usageRipple : undefined,
  };
}`;
content = content.replace(returnRegex, returnReplacement);

// 5. Apply the usageRipple in buildPropChance
const buildPropChanceEndRegex = /const hitting =[\s\S]*?parsed\.stat === "walks";/;
const buildPropChanceEndReplacement = `
  if (input.usageRipple != null && Math.abs(input.usageRipple) > 0.01) {
    push(layers, {
      id: "ripple",
      label: "Usage Ripple Reallocation",
      p: invLogit(input.usageRipple),
      precision: 4.8,
      family: "alpha",
      note: \`[ALPHA] Teammate injury detected. Usage vacuum shifts \${(input.usageRipple > 0 ? "more" : "less")} volume to \${parsed.player}.\`,
    });
  }

  const hitting =
    parsed.stat === "hits" ||
    parsed.stat === "hr" ||
    parsed.stat === "rbi" ||
    parsed.stat === "runs" ||
    parsed.stat === "total_bases" ||
    parsed.stat === "hrr" ||
    parsed.stat === "walks";`;

content = content.replace(buildPropChanceEndRegex, buildPropChanceEndReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Rewrote props.ts to implement Usage Ripple Reallocation!");