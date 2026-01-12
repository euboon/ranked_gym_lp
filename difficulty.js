const TIERS = ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master"];
const DIVS = [4, 3, 2, 1];

function globalLpIndex({ tier, division, lp }) {
  const t = TIERS.indexOf(tier);
  const d = DIVS.indexOf(division);
  if (t < 0 || d < 0) return 0;
  return (t * 4 + d) * 100 + Number(lp || 0);
}

function difficultyPct(state) {
  const idx = globalLpIndex(state);

  const start = 0.65;
  const slope = 0.00055;
  const cap = 0.88;

  const pct = start + slope * idx;
  return Math.max(start, Math.min(cap, pct));
}

function roundToStep(x, step = 5) {
  const s = Number(step) || 5;
  return Math.round(x / s) * s;
}

function strengthPrescription({ state, e1rm, step }) {
  const pct = difficultyPct(state);
  const targetWeight = roundToStep(e1rm * pct, step);

  return {
    kind: "strength",
    sets: 3,
    reps: 5,
    pct: Math.round(pct * 1000) / 10,
    targetWeight
  };
}

function passStrength(prescription, performedSets, tolerance = 0.975) {
  if (!Array.isArray(performedSets)) return false;
  if (performedSets.length < prescription.sets) return false;

  const needed = prescription.targetWeight * tolerance;

  for (let i = 0; i < prescription.sets; i += 1) {
    const s = performedSets[i];
    if (!s) return false;
    if (Number(s.reps) < prescription.reps) return false;
    if (Number(s.weight) < needed) return false;
  }
  return true;
}

module.exports = {
  TIERS,
  DIVS,
  globalLpIndex,
  difficultyPct,
  strengthPrescription,
  passStrength
};
