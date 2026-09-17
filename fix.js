const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/lib/market/props.ts');

let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ Gridiron Weather Compounding[\s\S]*?if \(bits\.length && Math\.abs\(z\) > 0\.01\)/;
const replacement = `// Gridiron Weather Compounding
    if (isGridiron) {
      let runRatio = 0.5;
      const passYds = input.ownLooks?.season?.passYdsG;
      const rushYds = input.ownLooks?.season?.rushYdsG;
      if (passYds && rushYds) {
         runRatio = rushYds / (passYds + rushYds);
      }

      if (wind != null && wind >= 12) {
        const passReliance = Math.max(0, 0.7 - runRatio);
        const windPenalty = clip((wind - 10) * 0.02 * passReliance, 0, 0.25);
        
        if (isPassing) {
          z -= windPenalty;
          bits.push(\`wind \${wind} mph (Pass Reliance: \${(passReliance * 100).toFixed(0)}%)\`);
        } else if (isRushing) {
          z += (windPenalty * 0.5); 
          bits.push(\`wind \${wind} mph forces ground game\`);
        }
      }

      if (precip != null && precip >= 40) {
         if (isPassing) {
           z -= 0.05;
           bits.push(\`rain \${precip}% cuts air game\`);
         } else if (isRushing) {
           z += 0.03;
           bits.push(\`rain \${precip}% forces ground game\`);
         }
      }
    }

    // Baseball Weather
    if (isBaseball) {
      if (wind != null && wind >= 12) {
        if (parsed.stat === "hr") {
          z += clip((wind - 10) * 0.006, 0, 0.08);
          bits.push(\`wind \${wind} mph\`);
        }
      }
      if (precip != null && precip >= 40 && parsed.stat === "hits") {
        z -= 0.05;
        bits.push(\`rain \${precip}%\`);
      }
      if (temp != null && temp >= 85 && (parsed.stat === "hr" || parsed.stat === "hits")) {
        z += 0.04;
        bits.push(\`\${temp}F\`);
      }
    }

    if (bits.length && Math.abs(z) > 0.01)`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log("Fixed props.ts weather block");