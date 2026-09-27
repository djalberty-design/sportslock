import { clip } from "./math.ts";
import type { ChanceInput } from "./chance.ts";

export type MlbParkMeans = {
  muH: number;
  muA: number;
  chaosAdd: number;
  empty: boolean;
  note?: string;
};

export function applyMlbParkToMeans(input: ChanceInput): MlbParkMeans {
  const {
    sport,
    parkRunFactor,
    weatherTemp,
    weatherWind,
    humidity,
    barometricPressure,
  } = input;

  // Park structure can run without weather. Pressure is off unless a real feed supplies it.
  // Do not invent 29.92 inHg to make the module look alive.
  if (sport !== "MLB" || parkRunFactor == null || Number.isNaN(parkRunFactor)) {
    return { muH: 1, muA: 1, chaosAdd: 0, empty: true };
  }

  const hasTemp = weatherTemp != null && !Number.isNaN(weatherTemp);
  const hasHumidity = humidity != null && !Number.isNaN(humidity);
  const hasPressure = barometricPressure != null && !Number.isNaN(barometricPressure);

  const tempCarry = hasTemp ? ((weatherTemp - 70) / 10) * 0.01 : 0;
  const pressureCarry = hasPressure ? (29.92 - barometricPressure) * 0.02 : 0;
  const humidityCarry = hasHumidity ? ((humidity - 50) / 10) * 0.001 : 0;

  let windCarry = 0;
  if (weatherWind != null && weatherWind >= 10) {
    const windForce = clip((weatherWind - 10) / 10, 0, 1.5);
    if (parkRunFactor > 1.0) {
      windCarry = 0.03 * windForce;
    } else if (parkRunFactor < 1.0) {
      windCarry = -0.03 * windForce;
    }
  }

  const carryFactor = clip(1.0 + tempCarry + pressureCarry + humidityCarry + windCarry, 0.85, 1.30);
  const finalMultiplier = parkRunFactor * carryFactor;

  let chaosAdd = 0;
  if (finalMultiplier > 1.05) {
    chaosAdd = Math.min(0.03, (finalMultiplier - 1.05) * 0.15);
  }

  return {
    muH: finalMultiplier,
    muA: finalMultiplier,
    chaosAdd,
    empty: false,
    note: `MLB Park: f=${parkRunFactor.toFixed(2)} c=${carryFactor.toFixed(3)}${hasPressure ? "" : " (pressure omitted — no station feed)"}`,
  };
}
