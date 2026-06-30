# STEPPED_QUESTIONS.md — deterministic marking spec

Source of truth for the stepped / answer-model marking system (the move off AI
marking). **Principle: the platform checks answers deterministically; the AI only
coaches and never delivers a verdict.** No function that decides right/wrong calls
an LLM. Read this before touching `src/lib/steppedQuestion.ts`, `SteppedPlayer`,
or the Review Queue step editor.

Status: **§1–§8 shipped (Physics complete), §9 is planning only (Maths, not started). Phase 1 complete 25/06/2026; player UX revised + validated 25/06/2026 (see §5 — answer-box-first for all, givens inside stepped help). `select_steps` (§6) has its tap-in-sequence player + two-attempt order grading (28/06/2026) + §7 ordered reveal + Review Queue editor. Phase 2 generator (`generate-stepped-questions`) shipped + deployed 25/06/2026. Scaffold (§8) for ai_freeresponse questions shipped 28/06/2026, hardened 30/06/2026 — AI marking is now the locked, permanent design for Explain/State/Show/Prove (decision #7) and for multi-method Maths topics like Circle Theorems (decision #8), not a gap to close. Physics question stock cleaned + validated 30/06/2026 — John is testing extensively before Maths (Phase 4, §9) begins; JAM Help scrutiny is the other pre-Maths priority.**

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

## 6. select_steps marks (SPEC — locked, order grading added 28/06/2026)
Tap-in-sequence UI: tapping a statement numbers it (1, 2, 3…) — the tap order IS
the student's claimed method order. Distractors are unnumbered until tapped.

**Two attempts (John's call, 28/06/2026):**
- **Attempt 1** is formative only — submitting shows "X/Y correct" and, if all
  correct points were selected, whether they're in the right order. No marks
  awarded. A "Try again" button lets the student adjust their selection/order.
- **Attempt 2** awards marks:

```
base    = clamp( correctSelected − wrongSelected, 0, maxMarks )
awarded = orderCorrect ? base : max(0, base − 1)
```

- `orderCorrect` = the correct statements, taken in the student's tap sequence
  (distractors ignored), are in ascending canonical `order`. Computed by
  `checkSelectSteps` → `StepCheckResult.orderCorrect`.
- Order only costs **1 mark**, not all of them — a student who knows the full
  method but transposes two steps still passes content.
- Reason this isn't graded on attempt 1 too: required-practical method order
  is a genuine AQA mark (a jumbled but complete method loses marks), but
  jumping straight to a penalty without feedback isn't supportive — the
  two-attempt model separates "do you know the method?" (formative) from
  "can you state it in order?" (summative).

## 7. Workings / feedback reveal (SPEC — locked)
**Full workings are shown on the mark screen on every path** (Physics rewards
working; this teaches exam technique even when the answer was right):

- **Calculations:** assemble equation → substitution-with-real-numbers → answer+unit
  straight from the `steps` (always consistent with the scaffold). An optional
  hand-written `worked_solution` may supplement it.
- **select_steps:** reveal the correct method points **in `order`**, marking each as
  the student's hit / missed. (28/06/2026: `buildSelectStepsReveal` now returns
  only the correct statements — distractors are dropped from this reveal, since
  by the mark screen the marks are settled and showing wrongly-picked distractors
  added noise without teaching value.)

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
4. `select_steps`: tap-in-sequence selection; **content marks** via
   `correctSelected − wrongSelected` clamped to `[0, maxMarks]`; **two attempts**
   (attempt 1 formative-only feedback, attempt 2 awards marks); **order now costs
   1 mark** if the correct statements aren't in canonical sequence (revised
   28/06/2026 — was "order ignored"; required-practical method order is a genuine
   AQA mark). Feedback reveal shows only the correct steps in order.
5. Challenge the able through harder *physics* (rearrangement, multi-equation chains,
   unit conversion, value extraction), not by removing deterministic checks.
6. Genuine prose ("show that"/"prove that" in Maths, Phase 4) is the one exception —
   scaffold mandatory or self-assessment reveal; not in scope for Physics.
7. **AI marking stays for Explain/State/Show/Prove `ai_freeresponse` questions —
   permanently, not a gap to close (decided 28/06/2026).** Writing a constructed
   response IS the exam skill being tested; reducing it to a `select_steps`
   checklist would test recognition instead of construction. The supportive
   addition is the **Scaffold** (§8) — a static "Need a hand?" reveal — not a
   conversion to deterministic marking.
8. **Multi-method Maths topics (e.g. Circle Theorems) stay AI-marked by design —
   same status as #7, decided 30/06/2026.** When a question has more than one
   genuinely valid solution path (a different theorem chain reaching the same
   answer), forcing one prescribed deterministic chain would mark a correct
   alternative method wrong. Full detail: §9.

## 8. Scaffold for ai_freeresponse questions (NEW — 28/06/2026)
A static, pre-written "Need a hand?" reveal for the student who can't yet write
the answer unaided AND isn't ready to articulate a JAM Help question. **No AI
call at render time** — authored at generation time, reviewed before publish,
same trust model as mark_scheme/worked_solution.

```jsonc
{ "vocabulary": ["resistance", "current", "potential difference"],
  "sentence_starter": "The current increases because..." }
```

- `vocabulary`: 3–5 key terms the answer should use (the building blocks, not
  the content).
- `sentence_starter`: one short opener that gets the student writing, stopping
  *before* any content that would give the marking-point answer away.
- Lives in a `scaffold` jsonb column on `questions` + `pending_questions`
  (nullable; migration `20260628120000`), per-question and per-part.
- `generate-pending-questions` drafts it for `ai_freeresponse` questions/parts
  (excluded for Physics calc parts, which already have the deterministic
  stepped scaffold) — **`scaffold` is optional, not required**: pure
  recall/naming questions ("Name component X", "State the unit of...") get
  `scaffold: null` since there's no sentence to build.
- Review Queue: view panel + JSON edit textarea, carried through edit-audit and
  publish (both fresh-insert and in-place-conversion branches).
- `PracticeRoom`: a "Need a hand?" toggle next to JAM Help (only rendered when
  `scaffold` is set) reveals vocabulary chips ("Key words you might need:")
  and an italic sentence starter ("Try completing the following statement:").
  **Single-part questions only so far** — multi-part non-stepped scaffold
  display is not yet wired into `MultiPartSteppedView` (the data is generated
  and stored per-part, just not rendered there yet).

**Quality hardening (30/06/2026, after reviewing the first backfill pass found bad output):**
- **Pure recall gets no scaffold.** "Name component X" / "State the unit of..."
  questions were getting generic filler ("component, symbol, circuit" — useless,
  no sentence to construct). The prompt (both `generate-pending-questions` and
  the one-off `backfill-scaffold`) now has an explicit skip rule for these.
- **Vocabulary must not restate the question.** Was getting `thermistor,
  resistance, temperature` for a thermistor-resistance question — the prompt now
  forbids echoing words already in the question text.
- **Mark-scheme leak found and fixed.** A diagram-dependent comparison question's
  sentence_starter restated its first mark scheme criterion **verbatim**
  ("Wave B has a shorter wavelength than Wave A" — itself a mark). Prompt
  instructions alone weren't reliable enough, so a **deterministic safety net**
  (`leaksMarkScheme()` — checks substring containment + 4-word sliding-window
  overlap against every mark scheme criterion, not just the conclusion) now runs
  in both edge functions and strips/rejects any leaking scaffold before it can
  reach a student. A skip/null scaffold is always preferred over a leaking one.
- Lesson: don't trust an LLM's self-restraint on "don't reveal X" for content it
  just authored itself — verify deterministically, same principle as the rest of
  this whole marking system.

## 9. Phase 4 — Maths marking strategy (PLANNING ONLY, 30/06/2026 — not started)
**Not started.** John is spending the next session(s) converting remaining legacy
Physics calc questions + generating/reviewing fresh batches to validate quality
before any Maths work begins; JAM Help (still pure prompt-engineered AI coaching,
no deterministic backstop) is also flagged as needing the same scrutiny just
applied to Scaffold (§8) before Maths starts. This section records the strategy
worked out for *when* that work begins, so it isn't re-derived from scratch.

**Why the original plan (blanket `numeric_single`/`numeric_with_working`
conversion) doesn't fit.** Physics converted cleanly because almost every calc
question reduces to one shape: pick the equation → substitute → one number.
Maths (26 active subtopics vs Physics' 9) doesn't have one dominant shape:

| Answer shape | Example subtopics | What's needed |
|---|---|---|
| Single number | Percentages, Compound Interest, Direct/Inverse Proportion, Ratio Problems, Solving Linear Equations, parts of Probability | Reuses the existing Physics-style pattern — cheapest, pilot here first |
| Multiple numbers, order-independent | Simultaneous Equations (x, y), Quadratics (two roots) | `select_steps`'s "pick the right values, order doesn't matter for content" checker maps onto this better than a fresh build |
| Expression as the answer | ~half of Algebra: Factorising, Expanding, Rearranging Formulae, Algebraic Fractions, Sequences nth term, Completing the Square | **Genuinely new** — an expression-equivalence checker (is `3x(x+2)` the same as `3x²+6x`? is `x(x+5)` accepted but not `1x(x+5)`?). Nothing like this exists yet. The long pole — blocks the single biggest topic. |
| Multi-method reasoning | Circle Theorems and similar | **Deliberately NOT forced into one deterministic chain** — locked decision #8. Several genuinely different valid theorem chains can reach the same answer; prescribing one path marks a correct alternative wrong. |
| Genuine prose | "show that"/"prove that" anywhere | Already the locked exception (#6) — its own UX, not a reuse of the Physics scaffold pattern |
| Explain/Describe | Scattered across topics | Zero new engineering — same AI-marked + Scaffold pattern as Physics §8, just apply it |

**Plan, in order, once started:**
1. **Universal Scaffold rollout for Maths first.** Same additive, marking-untouched
   pattern already built and hardened for Physics (§8 — skip pure recall, no
   question-restating vocabulary, deterministic `leaksMarkScheme()` safety net).
   Safe to ship ahead of any marking-model decisions since it doesn't change how
   anything is marked.
2. **Audit Maths mark schemes for alternative-method coverage.** The
   `"Method 1: X OR Method 2: Y"` pattern (CLAUDE.md — Seeded question mark
   scheme format) already exists but needs checking it's actually used
   everywhere a genuine alternative method exists, especially Circle Theorems.
   A mark scheme that only encodes one path is the biggest cause of an AI
   marker unfairly penalising a correct answer.
3. **Build a marking-quality eval harness for multi-method topics.** Not a
   deterministic unit test (it's judging prose/reasoning) — a repeatable
   structured check: a set of question + multiple genuinely-different-but-correct
   student answers per topic, run through `mark-answer`, scores reviewed by
   John. Re-run whenever the marking prompt changes. Same spirit as the vitest
   suite for the deterministic side, human-in-the-loop instead of pass/fail.
4. **Hybrid model for topics like Circle Theorems.** When a question ends in
   one number (the angle), check that value deterministically as a backstop
   even while the reasoning/method marks stay AI-judged — narrows the AI's job
   to just the part that needs judgment, without forcing one theorem chain.
5. **Single-number topics convert via existing patterns** — `numeric_single`
   for answer-only, the existing `stepped_calculation` shape for
   working-required. Pilot here first to confirm no Maths-specific gotchas
   before tackling anything harder.
6. **Expression-equivalence checker is its own dedicated build** — pilot on
   one clean case (e.g. Factorising Quadratics) before generalising to the
   rest of Algebra. The genuinely novel piece of engineering in this phase.

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

## Live RP "describe the method" questions (28/06/2026)
Two AQA required-practical `select_steps` questions with registered apparatus
diagrams, inserted as reviewed content (`source: 'reviewed'`, `tier: 'Both'`):

- **RP3 — Resistance of a wire** (`69b408ef-…`) in **Resistance and Potential
  Difference** (`1e789681-…`). Diagram: `rp-resistance-of-a-wire` (no params).
- **RP1 — Specific heat capacity** (`c71a1582-…`) in **Specific Heat Capacity**
  (`ef243d86-…`). Diagram: `rp-specific-heat-capacity` (`showInsulation: true`).

Each has 6 correct method statements + 4 distractors, `maxMarks: 6`. The diagram
renders above the `SelectStepsView` checklist. Marking is deterministic:
`clamp(correct − wrong, 0, 6)`. The `showInsulation` param on the SHC diagram
gives a free evaluation variant later (hide insulation → "why was the measured c
higher than expected?").

**Diagram rendering fix (28/06/2026):** `SteppedPlayer` and `FeedbackCard`
previously required `diagramParams` to be truthy — diagrams with no params (like
`rp-resistance-of-a-wire`) were silently skipped. Fixed to default to `{}`.

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

**Next:** `select_steps` *generation* (generator is calc-only; hand-authored RP
content exists as of 28/06/2026 — see "Live RP questions" above). Phase 4 Maths
(§9) is planned but deliberately not started — John is testing Physics
extensively first (converting remaining legacy calc questions, generating +
reviewing fresh batches) and JAM Help needs the same scrutiny just applied to
Scaffold before Maths work begins.
