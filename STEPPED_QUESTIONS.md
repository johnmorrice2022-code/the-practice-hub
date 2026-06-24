# STEPPED_QUESTIONS.md — deterministic marking spec

Source of truth for the stepped / answer-model marking system (the move off AI
marking). **Principle: the platform checks answers deterministically; the AI only
coaches and never delivers a verdict.** No function that decides right/wrong calls
an LLM. Read this before touching `src/lib/steppedQuestion.ts`, `SteppedPlayer`,
or the Review Queue step editor.

Status: **§1–§5 shipped + §7 for calculations (24/06/2026). `select_steps` pure checker (§6) shipped + tested; its UI (player input + editor panel) and ordered-steps reveal are the only parts left.**

---

## 1. answer_model (shipped)
`text NOT NULL`, on `seeded_questions` / `questions` / `pending_questions`, default
`ai_freeresponse`. Values: `numeric_single` | `numeric_with_working` |
`stepped_calculation` | `multiple_choice` | `ai_freeresponse`. Only
`stepped_calculation` is wired so far; the rest still use the legacy AI path.

## 2. Data model (shipped, with §5 additions)
A `stepped_calculation` question stores `steps` jsonb = `{ given[], steps[] }` plus
the §5 mode fields:

```jsonc
{
  "given": [ { "symbol": "I", "value": 2, "unit": "A", "label": "current" }, ... ],
  "default_mode": "direct" | "stepped",   // §5 — optional; else derived from tier
  "show_givens": true,                      // §5 — render the parsed given chips?
  "steps": [ /* §3 */ ]
}
```

## 3. Step kinds
Each step is checked in isolation by a pure function in `steppedQuestion.ts`.

### `choose_equation` (shipped)
Pick the correct equation from options. Exact match on the `correct` option.
Per-option `hint` is a misconception-specific nudge.

### `substitute` (shipped)
Tap given values into `[slot]` blanks in `expression`. Correct ⇔ every slot holds
its value. Returns `wrongSlots` so the player clears only the bad tiles. Tray =
slot values + `distractorValues`.

### `numeric` (shipped)
Final value within `tolerance` (default 0) + unit string match via `acceptedUnits`.
**Also serves as the single answer box in Direct mode (§5).**

### `select_steps` (NEW — §6)
Build an extended-response / required-practical answer by **selecting** the correct
statements from a pool that also contains distractors. **Order is not graded.**

```jsonc
{
  "id": "method",
  "kind": "select_steps",
  "prompt": "Describe a method to investigate how the resistance of a thermistor varies with temperature.",
  "maxMarks": 6,
  "options": [
    { "id": "s1", "text": "Set up the thermistor in series with an ammeter…", "correct": true,  "order": 1 },
    { "id": "s2", "text": "Place the thermistor in a beaker of water and heat it…", "correct": true,  "order": 2 },
    { "id": "s3", "text": "Record the temperature and the current at regular intervals…", "correct": true, "order": 3 },
    { "id": "s4", "text": "Measure the mass of the water with a balance",            "correct": false },  // distractor
    …
  ]
}
```

- `correct: true` items are the marking points; `order` is the canonical sequence
  used **only** for the feedback reveal (§7), never for grading.
- `correct: false` items are distractors (no `order`).

## 4. checkStep / validation (shipped for §3 existing kinds)
`checkStep(step, response)` dispatches by kind. `validateSteppedQuestion()` is the
structural gate used by the Review Queue and (later) the generator.

---

## 5. Modes — adaptive "answer-first" (SPEC)
One authored question, two entry points, all deterministic. Solves
"support the nervous student → challenge the able" without ever AI-marking prose.

- **Direct mode** — show the question (givens hidden if `show_givens: false`) and a
  single **final answer + unit** box (the `numeric` step). Correct → full marks,
  done. Wrong → offer **"Break it down"**, which unfolds the full scaffold.
- **Stepped mode** — the guided one-step-at-a-time player (already shipped).

**Defaults & agency:**
- Foundation default = Stepped, `show_givens: true`.
- Higher default = Direct, `show_givens: false`.
- Always show both overrides: **"Break it down"** in Direct, **"Let me just answer"**
  in Stepped. Smart default, student override.

**Marks (calculations):**
- Correct final answer (Direct) → full marks. (Matches AQA: a correct calc answer
  earns the marks without written working.)
- Wrong → scaffold; the player only advances on a correct step, so **completing the
  scaffold = full marks**. No penalty for needing it — differentiation is
  speed/independence, not score (confidence-first).
- A wrong Direct answer that matches a known distractor value fires that
  distractor's specific hint **deterministically** before unfolding the scaffold.

## 6. select_steps marks (SPEC — locked)
Partial credit, distractors cost a mark, order ignored:

```
awarded = clamp( correctSelected − wrongSelected, 0, maxMarks )
```

- Selecting some wrong steps still leaves partial marks (doesn't zero out).
- The distractor penalty stops "select everything" winning full marks.
- Submitting is the completion action (no per-step advance).

## 7. Workings / feedback reveal (SPEC — locked)
**Full workings are shown on the mark screen on every path** (Physics rewards
working; this teaches exam technique even when the answer was right):

- **Calculations:** assemble equation → substitution-with-real-numbers → answer+unit
  straight from the `steps` (always consistent with the scaffold). An optional
  hand-written `worked_solution` may supplement it.
- **select_steps:** reveal the correct method points **in `order`**, marking each as
  the student's hit / missed, and flag any distractors they wrongly picked. So even
  though order isn't graded, the student always sees the correct ordered method.

---

## Locked decisions (24/06/2026)
1. Answer-first is the standard model; Direct vs Stepped default by tier, student can override either way.
2. `show_givens` flag — off for Higher (must extract values from the prose), on for Foundation.
3. Full workings shown on the mark screen on every path, assembled from the steps.
4. `select_steps`: **selection only, order not graded**; **partial marks** via
   `correctSelected − wrongSelected` clamped to `[0, maxMarks]`; feedback **shows the
   correct steps in order**.
5. Challenge the able through harder *physics* (rearrangement, multi-equation chains,
   unit conversion, value extraction), not by removing deterministic checks.
6. Genuine prose ("show that"/"prove that" in Maths, Phase 4) is the one exception —
   scaffold mandatory or self-assessment reveal; not in scope for Physics.

## Live test content (24/06/2026)
Four `stepped_calculation` rows are published in **Electrical Power and Energy
Transfers** (`subtopic_id 7f35c052-3376-458c-bbbf-7092d09c5659`) for
pressure-testing the player — they exercise the full spread:
- **P = I × V** (3m, mode auto) — the original; carries 3 Direct-mode distractors.
- **Find the current** (3m, Direct, `show_givens:false`) — rearrangement I = P/V, prose extraction.
- **Energy chain** (6m, Direct) — two equations P=IV → E=Pt, intermediate numeric step.
- **Heater energy** (4m, Stepped) — minutes→seconds unit-conversion step first.

These are **test rows in the live `questions` table** (inserted via service-role
script, `source: 'reviewed'`). Delete or keep as wanted; they are not part of a
real published set. **Pending: a couple of slight player UI tweaks John flagged
after testing (to be specified).**

## Build order (next)
1. ~~`select_steps` kind: type + `checkSelectSteps` + validation + vitest (pure, no UI).~~ **DONE 24/06/2026** — `checkSelectSteps` + 9 tests in `steppedQuestion.ts`/`.test.ts`.
2. Player input for `select_steps` + the §7 ordered-steps reveal. **(next)**
3. Review Queue editor panel for `select_steps`.
4. ~~Adaptive modes (§5)~~ **DONE 24/06/2026** — `default_mode`/`show_givens` on the
   `SteppedQuestion` root + editor controls; Direct entry reuses the final `numeric`
   step; "Break it down" / "Let me just answer" overrides; `numericDistractorHint`
   fires a misconception nudge on a wrong Direct answer.
5. ~~Workings reveal (§7) on the calculation mark screen~~ **DONE 24/06/2026** —
   `buildWorking()` assembles equation→substitution→answer from the steps into the
   completion `worked_solution`, shown on every path.
