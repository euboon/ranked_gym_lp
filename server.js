const express = require("express");
const db = require("./db");
const {
  TIERS,
  DIVS,
  globalLpIndex,
  strengthPrescription,
  passStrength
} = require("./difficulty");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const SCHEDULE = {
  1: ["bench", "row"],
  3: ["squat", "ohp"],
  5: ["deadlift", "pullup"]
};

function epleyE1RM(weight, reps) {
  return weight * (1 + reps / 30);
}

function getState() {
  return new Promise((resolve, reject) => {
    db.get("SELECT tier, division, lp FROM state WHERE id = 1", (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function setState(state) {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE state SET tier = ?, division = ?, lp = ?, updated_at = datetime('now') WHERE id = 1",
      [state.tier, state.division, state.lp],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

function addChallenge({ name, success, lp_value, lp_change }) {
  return new Promise((resolve, reject) => {
    db.run(
      `
      INSERT INTO challenges (name, success, lp_value, lp_change, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      `,
      [name, success ? 1 : 0, lp_value, lp_change],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

function applyLpChange(state, change, { noCarryover = false } = {}) {
  const maxIndex = TIERS.length * 4 * 100 - 1;
  const currentIdx = globalLpIndex(state);
  const nextIdx = Math.max(0, Math.min(maxIndex, currentIdx + change));

  const currentDivIndex = Math.floor(currentIdx / 100);
  const nextDivIndex = Math.floor(nextIdx / 100);

  let lp = nextIdx % 100;

  if (noCarryover && nextDivIndex !== currentDivIndex) {
    lp = nextDivIndex > currentDivIndex ? 0 : 100;
  }

  const tierIndex = Math.floor(nextDivIndex / 4);
  const divIndex = nextDivIndex % 4;

  return {
    tier: TIERS[tierIndex] || TIERS[0],
    division: DIVS[divIndex] || DIVS[0],
    lp
  };
}

function getBaseline(exercise_key) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM exercise_baselines WHERE exercise_key = ?",
      [exercise_key],
      (err, row) => {
        if (err) return reject(err);
        resolve(row);
      }
    );
  });
}

app.get("/api/state", async (req, res) => {
  const state = await getState();
  res.json({ state });
});

app.post("/api/placements", (req, res) => {
  const { exercise_key, rm_reps, rm_weight, step } = req.body;

  if (!exercise_key) return res.status(400).json({ error: "exercise_key required" });
  const reps = Number(rm_reps);
  const w = Number(rm_weight);

  if (!Number.isFinite(reps) || reps < 5 || reps > 8) {
    return res.status(400).json({ error: "rm_reps must be 5-8" });
  }
  if (!Number.isFinite(w) || w <= 0) {
    return res.status(400).json({ error: "rm_weight must be > 0" });
  }

  const e1rm = epleyE1RM(w, reps);
  const st = Number(step) || 5;

  db.run(
    `
    INSERT INTO exercise_baselines (exercise_key, rm_reps, rm_weight, e1rm, step, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(exercise_key) DO UPDATE SET
      rm_reps=excluded.rm_reps,
      rm_weight=excluded.rm_weight,
      e1rm=excluded.e1rm,
      step=excluded.step,
      updated_at=datetime('now')
    `,
    [exercise_key, reps, w, e1rm, st],
    (err) => {
      if (err) return res.status(500).json({ error: "db error" });
      return res.json({ exercise_key, rm_reps: reps, rm_weight: w, e1rm });
    }
  );
});

app.get("/api/today", async (req, res) => {
  const state = await getState();
  const dow = new Date().getDay();
  const todays = SCHEDULE[dow] || [];

  const plan = [];
  for (const ex of todays) {
    const base = await getBaseline(ex);
    if (!base) {
      plan.push({ exercise_key: ex, needsPlacement: true });
      continue;
    }
    const prescription = strengthPrescription({
      state,
      e1rm: base.e1rm,
      step: base.step
    });
    plan.push({ exercise_key: ex, prescription });
  }

  res.json({ state, dow, plan });
});

app.post("/api/score-day", async (req, res) => {
  const { performed } = req.body;
  const state = await getState();

  const dow = new Date().getDay();
  const todays = SCHEDULE[dow] || [];

  if (todays.length === 0) {
    return res.json({ message: "rest day (no ranked match today)", before: state, after: state });
  }

  let allPass = true;
  const details = [];

  for (const ex of todays) {
    const base = await getBaseline(ex);
    if (!base) {
      allPass = false;
      details.push({ exercise_key: ex, pass: false, reason: "needs placement" });
      continue;
    }

    const prescription = strengthPrescription({ state, e1rm: base.e1rm, step: base.step });
    const perf = performed?.[ex];
    const pass = passStrength(prescription, perf);

    if (!pass) allPass = false;

    details.push({ exercise_key: ex, pass, prescription });
  }

  const lpValue = 22;
  const lp_change = allPass ? lpValue : -lpValue;

  const next = applyLpChange(state, lp_change, { noCarryover: true });
  await setState(next);

  await addChallenge({
    name: `Day ${dow} ${allPass ? "WIN" : "LOSS"}`,
    success: allPass,
    lp_value: lpValue,
    lp_change
  });

  return res.json({ before: state, after: next, allPass, lp_change, details });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Ranked Gym LP running on port ${port}`);
});
