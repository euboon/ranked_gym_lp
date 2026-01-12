
# Ranked Gym LP

A League-style LP ladder for gym lifting.

## Idea
- Create Weekly schedule for exercises
- Before a user recieves a rank, will do "Placements": enter top set in 5–8 reps for each exercise to estimate e1RM
- Every workout day is a "ranked match"
- To WIN the day, you must hit the generated prescription
- WIN = gain LP, LOSS = lose LP
- As LP rises, target weights rise smoothly

## Tech
- Node.js + Express
- SQLite
- EJS pages + minimal vanilla JS

## Run locally
```bash
npm install
npm start
