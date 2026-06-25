# STEPPED_QUESTIONS.md — deterministic marking spec

Source of truth for the stepped / answer-model marking system (the move off AI
marking). **Principle: the platform checks answers deterministically; the AI only
coaches and never delivers a verdict.** No function that decides right/wrong calls
an LLM. Read this before touching `src/lib/steppedQuestion.ts`, `SteppedPlayer`,
or the Review Queue step editor.

Status: **§1–§7 shipped (Phase 1 complete, 25/06/2026). Player UX revised + validated 25/06/2026 (see §5 — answer-box-first for all, givens inside stepped help). `select_steps` (§6) now has its player checklist + §7 ordered reveal + Review Queue editor. Phase 2 generator (`generate-stepped-questions`) shipped + deployed 25/06/2026.**

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
Per-option `hint` is a misconception-specific nudge. Options are **shuffled
randomly** on mount so the correct answer isn't always in the same position.

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

## 5. Modes — "answer-first" (SHIPPED; UX revised + validated 25/06/2026)
One authored question, two entry points, all deterministic. Solves
"support the nervous student → challenge the able" without ever AI-marking prose.

- **Direct mode (the default for every question, all tiers)** — show the question
  and a single **final answer + unit** box (the `numeric` step). The **marks** are
  shown as a pill (e.g. "4 marks"). **Givens are NOT shown here** — the student
  extracts the variables from the prose, as in a real exam. Correct → full marks,
  done. A wrong value still fires its distractor-specific hint (deterministic).
- **Stepped mode** — the guided one-step-at-a-time player. Reached on demand via
  **"Provide stepped help"**. Opening it reveals the **given chips** (I, V, …) as
  part of the scaffold, then the steps.

**Help is explicit and always available** (Direct mode, under a "Need a hand?"
divider) — two buttons:
- **"JAM Help — discuss this question"** → opens JAM Help (Socratic coaching, never
  a verdict).
- **"Provide stepped help"** → unfolds the full scaffold (= Stepped mode).

In Stepped mode, **"Let me just answer"** jumps back to the Direct box.

**Why this changed from the original tier-based spec (25/06/2026, John's call after
testing):** defaulting Foundation to a fully-unfolded scaffold with givens on show
was *too much scaffold* — students must learn to identify what's what, since exam
questions don't label the variables. Answer-box-first with opt-in stepped help is
the supportive-but-not-hand-holding middle. So:
- **No tier-based default mode** — every question opens on the answer box.
- **`show_givens`** no longer means "show up front"; it now only governs whether the
  givens appear *inside the stepped help* (default `true`; an author can set `false`
  to withhold them even in the scaffold).
- **`default_mode`** is no longer read by the player (the field may remain on rows;
  it is inert). Direct is always the entry point.

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

## One final answer per calculation (LOCKED 25/06/2026)
A stepped **calculation** has **exactly ONE numeric (final answer) step** — enforced
by `validateSteppedQuestion` (calc = has any choose_equation/substitute/numeric; must
have exactly one numeric) and by both edge functions. A 5–6 mark question still has
ONE answer; the marks reward the *working* (rearrangement, multiple equations), not
extra answers. Intermediate values (a temperature change Δθ = T₂−T₁, a unit
conversion, a P-before-E result) are **working**: their result goes straight into the
substitute slot value (with a distractor tile for the common wrong value), and the
full method is shown in the **stored `worked_solution`** (line-per-step LaTeX
breakdown) + **stored `mark_scheme`** (AQA 1-mark-per-step). Multi-equation methods
are **combined into one expression** where clean (E = IVt, not P=IV then E=Pt). The
generator + converter author the `worked_solution`/`mark_scheme`; the mark screen
prefers them (falls back to `buildWorking`); the in-place publish carries them onto
the live row; the Review Queue stepped view displays them. `select_steps` is exempt
(no numeric step). Reason (John, 25/06/2026): asking ~3 answers in one question breaks
exam authenticity.

## Locked decisions (24/06/2026; #1–#2 revised 25/06/2026)
1. Answer-first is the standard model. **Every question opens on the Direct answer
   box, all tiers** (no tier-based default mode). The scaffold is opt-in via
   "Provide stepped help"; help is explicit and always shown (JAM Help + stepped
   help). *(Revised 25/06/2026 — was "Direct vs Stepped default by tier".)*
2. **Givens are shown only inside the stepped help, never up front** — students
   extract the variables from the prose, as in an exam. `show_givens` now only
   governs whether givens appear *within the scaffold* (default true).
   *(Revised 25/06/2026 — was "off for Higher, on for Foundation".)*
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
real published set. **Player UI tweaks done + validated 25/06/2026** (§5):
marks pill, answer-box-first for all, givens inside stepped help, two explicit
help buttons, and the mark screen drops the summary line (straight to breakdown +
worked solution). John: "far more supportive for students."

## Build order
1. ~~`select_steps` kind: type + `checkSelectSteps` + validation + vitest.~~ **DONE 24/06/2026.**
2. ~~Player input for `select_steps` + the §7 ordered-steps reveal.~~ **DONE 25/06/2026** —
   `SelectStepsView` checklist in `SteppedPlayer` (single-`select_steps` questions;
   partial-marks Submit, no advance-gating); `buildSelectStepsReveal` (pure + tested)
   maps correct points in `order` (hit/missed) + flagged wrong picks onto the
   FeedbackCard breakdown; `completeStepped` records partial marks; FeedbackCard hides
   the empty Worked-solution block.
3. ~~Review Queue editor panel for `select_steps`.~~ **DONE 25/06/2026** —
   `SelectStepsFields` in `SteppedQuestionEditor` (max marks, statements with
   correct/order/distractor) + preview.
4. ~~Adaptive modes (§5)~~ **DONE 24/06, revised 25/06/2026** — answer-box-first for all.
5. ~~Workings reveal (§7) on the calculation mark screen~~ **DONE 24/06/2026.**

## Phase 2 — generator (DONE 25/06/2026)
`supabase/functions/generate-stepped-questions` proposes `stepped_calculation`
DRAFTS into `pending_questions` for review. Physics-calculation focused
(choose-equation → substitute → numeric, with misconception distractors + hints);
"Both" tier splits Foundation + Higher (Higher = rearrangement / multi-equation
chains / unit conversion). It reads the subtopic's `prompt_config.system_prompt`
as the spec/equation/vocabulary context, and (25/06/2026) its
`marking_guidance` + `common_mistakes` as **KNOWN MISCONCEPTIONS** that seed the
distractor equations, distractor tiles and wrong-answer hints — so the nudges
reflect the mistakes a real AQA examiner flags (verified on SHC: it produced the
g→kg mass-conversion and Δθ-vs-final-temp distractors straight from the mark
scheme). Structural validation drops malformed drafts; numeric strings are
coerced. **Substitute expressions must be fully substitutable — a bare
non-slot symbol on the RHS is rejected (the validator), and the prompt tells the
model to rearrange so the unknown is the subject (e.g. "a = [F] \div [m]")
rather than leave "F = [m] × a"** — found + fixed in the 25/06 pressure test.
**`\frac` forbidden in substitute expressions (25/06/2026):** use `\div` instead —
LaTeX fractions break the slot rendering when the expression is split on `[slot]`
patterns. `\frac` is fine in `prompt` text and `choose_equation` option `latex`.
Triggered by the **"Generate 6 stepped"** button on Physics
subtopics in the Review Queue. Deployed `--no-verify-jwt`. **model id `claude-sonnet-4-6`
— now the 6th place the id lives.** Verified live against Electrical Power and Energy
Transfers (valid Foundation P=IV + a Higher P=IV→E=Pt chain, arithmetic correct).

## Phase 3 — convert legacy AI-marked calc questions to stepped (PILOT DONE 25/06/2026)
Converts EXISTING live AI-marked calculation questions to `stepped_calculation`,
**in place** (no duplicate), preserving the original prose and numbers.

- **`pending_questions.source_question_id`** (uuid, nullable, FK→`questions`, migration
  `20260625120000`): when set, the draft is a conversion of that live row.
- **`supabase/functions/convert-legacy-to-stepped`**: reads a subtopic's live
  AI-marked single-answer questions; for each calculation, authors a stepped
  scaffold using the question's OWN numbers (its `worked_solution` is the source of
  truth); skips explain/recall/multi-part (returns `{skip:true}`); same validation +
  bare-non-slot-symbol guard as the generator; inserts drafts tagged with
  `source_question_id`. Idempotent (skips questions that already have a pending
  conversion). model `claude-sonnet-4-6` (**7th place the id lives**). Deployed
  `--no-verify-jwt` → confirm Verify JWT OFF.
- **Review Queue**: green **"Convert calc → stepped"** button (Physics); a
  **"Converts live ✓ in place"** badge in review; `handlePublish` branches — a draft
  with `source_question_id` **UPDATEs the original live row** (answer_model→stepped,
  steps→scaffold, stale AI mark-scheme/worked-solution cleared) instead of inserting.
- **Rollout (25/06/2026): 27 single-answer calc conversions across 4 subtopics**,
  all verified (27/27 source links resolve, 30/30 arithmetic links correct against
  the originals): Specific Heat Capacity 11, Internal Energy 8, Wave Properties 6,
  Series/Parallel 2. All await John's review → approve → publish (the in-place swap).
- **Standard-form fix (25/06/2026):** specific-latent-heat conversions first dropped
  because the model wrote large values (L = 3.34×10⁵) as LaTeX/standard-form strings.
  `num()` now coerces standard-form text to a real number, and the prompt mandates
  plain JSON numbers (334000 / 3.34e5). Recovered all drops.
- **KNOWN GAPS (still AI-marked):**
  - **Circuit Symbols** (and other recall/explain) — no calculations; correctly
    stay AI-marked until `select_steps` generation exists.

## Deliverable 2 — stepped inside multi-part questions (DONE 25/06/2026)
Multi-part Physics calc questions (V=IR chains, parallel current splitting, etc.)
now get **per-part deterministic checking**: calc parts render `SteppedPlayer` with
the full answer-first + JAM Help + "Provide stepped help" UX; non-calc parts
(explain/state/reason) stay AI-marked. No database migration — `parts` is already
jsonb; per-part `answer_model`, `steps`, `mark_scheme`, `worked_solution` are just
new fields within each part object.

- **`SteppedPlayer` `compact` prop** — hides the marks pill and question stem so
  the player can be embedded inside a multi-part layout without duplicating headers.
- **`SteppedPlayer` diagram rendering** — `diagramComponent`/`diagramParams` props;
  renders registered diagrams (e.g. `circuit-diagram`) after the question stem.
  Previously diagrams were missing on all stepped questions.
- **`MultiPartSteppedView`** in `PracticeRoom.tsx` — renders shared stem + diagram,
  then each part as either `SteppedPlayer` (calc) or `MathEditor` (non-calc). New
  `steppedPartResults` state tracks per-part completion. Hybrid marking: only
  non-stepped parts go to the AI marker; results are merged with deterministic
  stepped results. All-stepped multi-part questions skip the AI call entirely.
- **Review Queue** — per-part "Stepped" / "AI marked" badges with
  `SteppedQuestionPreview` per calc part. `handlePublish` carries `parts` through
  the in-place update.
- **Converter** — `convert-legacy-to-stepped` now handles multi-part questions:
  sends all parts to Claude in one call; per-part scaffold validation; non-calc
  parts preserved as `ai_freeresponse` with original mark scheme and worked
  solution. Uses `prompt_version: 'convert-stepped-v2-multipart'`.
- **Substitute expression LaTeX fix** — `SubstituteInput` now renders the full
  expression as one KaTeX block (handles `\frac`, `\div` etc. correctly). Slot
  values show in green when filled. Both prompts (generator + converter) now forbid
  `\frac` in substitute `expression` fields (use `\div` instead); `\frac` remains
  fine in `prompt` text and `choose_equation` option `latex`.
- **Series/Parallel rollout:** 5 multi-part conversions (3 Foundation, 2 Higher)
  created and tier-tagged. John reviewed and approved in the Review Queue.

**The stepped system is now generic across all Physics subtopics.** No code is
hardcoded to specific subtopics — the generator reads `prompt_config`, the converter
reads `worked_solution`, the player checks `answer_model`+`steps`. New subtopics
get stepped support automatically.

**Next:** `select_steps` *generation* (generator is calc-only); Phase 4 Edexcel
Maths `numeric_single` / `numeric_with_working`.
