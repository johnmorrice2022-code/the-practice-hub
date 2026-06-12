# CLAUDE.md — The Hub Jam

This file is read automatically by Claude Code at the start of every session.
Update it at the end of any session where something significant changes.

---

## Project Overview

**Platform:** The Hub Jam — adaptive GCSE Maths and Physics practice platform
**Marketing name:** The Practice Hub (used in Stripe, pricing pages, and student-facing marketing)
**Live URL:** https://app.thehubjam.co.uk
**GitHub:** https://github.com/johnmorrice2022-code/the-practice-hub
**Stack:** React / TypeScript / Tailwind / Supabase / Netlify
**Owner:** John Morrice — qualified Physics teacher, platform founder
**AI engine:** Anthropic Claude Sonnet 4 via Supabase Edge Functions

**Positioning:** "Adaptive GCSE practice with intelligent marking and clear, exam-focused feedback." No emphasis on AI — outcomes-focused language only.

---

## Local Development

- Project at `~/Desktop/the-practice-hub-main`
- Run with `npm run dev`
- Open VS Code with `open -a "Visual Studio Code" ~/Desktop/the-practice-hub-main`
- Node installed via Homebrew
- Dev server runs on localhost:8080, 8081, or 8082 (picks first available port)
- Google OAuth always redirects to the live site — test locally with email/password accounts only

---

## Critical Working Rules

These rules exist because violations have caused real incidents. Follow them without exception.

1. **Never use heredoc commands** (`cat > file << 'EOF'`) to write files. This caused a major git corruption (session 21/05/2026). All file edits via VS Code only.

2. **Long files (>300 lines) can corrupt silently** during VS Code paste — missing tags, truncated generics. Always verify with `grep` or `sed -n` after saving.

3. **For targeted fixes**, save a Python script to `/tmp/fix.py` and run `python3 /tmp/fix.py`. Never use `python3 -c` with inline strings containing `!` — zsh interprets `!` as history expansion.

4. **Always press Cmd+S** to save files in VS Code before running any git commands.

5. **After every `supabase functions deploy`**, Verify JWT resets to ON. Manually turn it OFF afterwards in the Supabase dashboard.

6. **Edit in VS Code → save → verify with `grep` → commit.** This is the correct sequence.

7. **Never write `\u200B` as a literal character** via the Edit or Write tools — the tools silently emit the actual invisible zero-width space (U+200B) instead of the escape sequence, which breaks regexes and string replacements. Use a Python script (`/tmp/fix.py`) to write `\u200B` escape sequences into JS/TS source files.

---

## Infrastructure

| Service  | Detail |
|----------|--------|
| Hosting  | Netlify — auto-deploys from GitHub main branch |
| Database | Supabase Pro — project ref `wgcxwtgspmfnzugszhdc` |
| Storage  | Supabase Storage — bucket: `diagrams` (single bucket, public read) |
| Domain   | app.thehubjam.co.uk (Netlify) / thehubjam.co.uk (WordPress) |
| Payments | Stripe — currently in **test mode**; switch to live before launch |

**Supabase project URL:** `https://wgcxwtgspmfnzugszhdc.supabase.co`

### Storage RLS
The `diagrams` bucket requires an RLS policy for authenticated uploads. If ever recreated, run:
```sql
CREATE POLICY "Authenticated users can manage diagrams"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'diagrams')
WITH CHECK (bucket_id = 'diagrams');
```

### Table RLS — admin write policies
`announcements` and `livestream_links` have RLS enabled. Admin write access uses `auth.email()`:
```sql
CREATE POLICY "Admin can manage livestream_links"
  ON public.livestream_links FOR ALL TO authenticated
  USING (auth.email() = 'johnmorrice2022@gmail.com')
  WITH CHECK (auth.email() = 'johnmorrice2022@gmail.com');

CREATE POLICY "Admin can manage announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (auth.email() = 'johnmorrice2022@gmail.com')
  WITH CHECK (auth.email() = 'johnmorrice2022@gmail.com');
```
If these tables are ever recreated, re-run these policies or writes will silently fail.

**Region:** West Europe (London) — eu-west-2

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `subtopics` | All topics/subtopics — controls what appears in the app |
| `questions` | Live reviewed question bank — teacher-approved AI questions |
| `seeded_questions` | Hand-authored questions (John's own) |
| `pending_questions` | Holding pen for AI-generated drafts awaiting review |
| `pending_question_edits` | Audit log of edits made during review |
| `generation_batches` | One row per batch generation run |
| `learning_content` | In-app teaching resources — `sections` is a single JSONB column (array), not one row per section |
| `check_questions` | Multiple choice comprehension checks — column is `question_text`, not `question`; has `question_order` |
| `profiles` | Student profiles |
| `user_roles` | Admin / user roles |
| `session_results` | Progress tracking — one row per completed session |
| `subscriptions` | Stripe subscription per user |
| `livestream_links` | Weekly YouTube stream links per subject |
| `announcements` | Admin announcements visible to all subscribers — optional `link_url` and `link_image_url` columns for blog post previews |

### Key subtopic fields
- `subject` — Maths or Physics
- `topic` — e.g. Algebra, Geometry, Forces
- `subtopic_name` — displayed to students
- `exam_board` — Edexcel (Maths) or AQA (Physics)
- `tier` — Higher, Foundation, or Both
- `slug` — unique URL identifier
- `active` — true = live, false = hidden
- `sort_order` — controls display order
- `prompt_config` — JSONB: `system_prompt`, `marking_guidance`, `interactive_component`

### profiles table columns
`id`, `full_name`, `weekly_goal`, `created_at`, `updated_at`, `maths_tier`, `physics_tier`, `maths_exam_board`, `physics_exam_board`, `student_first_name`, `parent_email`, `parent_phone`, `onboarding_complete` (boolean, default false), `questions_used` (integer, default 0), `country`, `parent_name`, `questions_used_date` (date — for daily reset logic)

---

## Critical SQL Patterns

### learning_content insert — use direct jsonb cast
```sql
-- CORRECT
INSERT INTO learning_content (subtopic_id, sections)
VALUES ('uuid-here', '[{"heading": "...", "paragraphs": [...]}]'::jsonb);

-- WRONG — to_jsonb() stores as a JSON string scalar, not an array
-- VALUES ('uuid-here', to_jsonb($lc$[...]$lc$::text));
```

### Fix a sections column stored as string
```sql
UPDATE learning_content
SET sections = (sections #>> '{}')::jsonb
WHERE subtopic_id = 'UUID';
```

### Verify learning_content after insert
```sql
SELECT jsonb_typeof(sections), jsonb_array_length(sections)
FROM learning_content
WHERE subtopic_id = 'UUID';
```

### prompt_config updates — always use || merge operator
```sql
UPDATE subtopics
SET prompt_config = prompt_config || '{"system_prompt": "..."}'::jsonb
WHERE id = 'UUID';
```
This preserves existing fields. Never overwrite the whole JSONB column unless intentional.

### Useful test account SQL
```sql
-- Reset onboarding
UPDATE profiles SET onboarding_complete = false, student_first_name = null WHERE id = 'USER_ID';

-- Reset question counter
UPDATE profiles SET questions_used = 0, questions_used_date = null WHERE id = 'USER_ID';

-- Manually insert test subscription
INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, tier, status, current_period_end)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'EMAIL_HERE'),
  'cus_test_manual', 'sub_test_manual',
  'price_1TY6AQ64C8nH7JLRspCVhegw',
  'platform_both', 'active',
  NOW() + INTERVAL '1 year'
);
```

---

## Architecture Patterns

### Two-track question system
- **AI-generated questions** — for algebra, calculations, standard questions. Generated on demand or in batches via AdminReviewQueue.
- **Seeded questions** — John's hand-authored questions, stored in `seeded_questions`. LaTeX supported via `$...$` (inline) and `$$...$$` (display).

`pending_questions` and `questions` both have `diagram_component`/`diagram_params` columns (added 10/06/2026, mirroring `seeded_questions`). `AdminReviewQueue.handlePublish` copies these from `pending_questions` to `questions` — if `AdminReviewQueue.tsx` is changed, remember it must be **pushed and deployed to Netlify** before the next "approve & publish" run, or the new field won't be carried through (already-published rows can be backfilled from their matching `pending_questions` row by `question_text`).

### Seeded question mark scheme format (critical)
Use flat Edexcel M1/A1 format with a `criterion` string per mark. **Never use nested objects, `methods` arrays, or `requirement`/`reason` fields** — these confuse the marking AI and produce broken step_breakdown output.

```json
[
  {"mark": "M1", "criterion": "specific method step — name the theorem/rule used"},
  {"mark": "M1", "criterion": "next step — for alternatives use: Method 1: X OR Method 2: Y"},
  {"mark": "A1", "criterion": "correct final answer with all reasons stated"},
  {"mark": "TOTAL", "criterion": "N marks"}
]
```

- `M1` — method/working step (shows as **Method** badge)
- `A1` — final answer accuracy (shows as **Accuracy** badge)
- Alternative approaches: express inline as `Method 1: ... OR Method 2: ...` in the criterion string
- Be specific — name the exact theorem (e.g. "angle at circumference is half angle at centre"), never vague ("used a circle theorem")

**Worked solution format:** separate each step with `\n` so FeedbackCard renders them as individual boxes. Use `$...$` for LaTeX. For multiple methods, label them `Method 1:` and `Method 2:` with a blank line (`\n\n`) between methods.

**Runtime note:** `mark_scheme` stored as a JSON string scalar (common when inserted via Supabase table editor) is handled automatically by the `parsedScheme` normaliser in `mark-answer/index.ts`. Prefer inserting via SQL with `'[...]'::jsonb` cast to store it correctly.

### LaTeX quick reference (for content authoring)
| Output | LaTeX |
|--------|-------|
| Inline expression | `$x^2 + 1$` |
| Display (centred) | `$$E = mc^2$$` |
| Degree symbol | `$90^{\circ}$` |
| Greek theta | `$\theta$` |
| Fraction | `$\frac{a}{b}$` |
| Square root | `$\sqrt{x}$` |

LaTeX renders in: learning content section headings, paragraph text, question text, mark schemes, and JAM Help responses.
- `PracticeRoom.tsx` merges both pools, shuffles, picks up to 4. Falls back to live AI generation only when both tables are empty.


### MathEditor chip architecture (critical for iOS)
`MathEditor.tsx` uses a `contentEditable` div for text input with visual chip elements for fractions, powers, and roots. Key design constraint: **chips inside the contenteditable are always in locked (non-editing) state** — no `<input>` elements ever render inside the contenteditable DOM tree.

When the user inserts or taps a chip, an **edit panel renders below the contenteditable** (in-flow, same flex column). All chip inputs live in the panel. This prevents iOS Safari from focusing inputs inside the contenteditable, which caused the cursor to veer off-screen.

- `EditingChipState` drives the panel; `ChipState` drives the in-contenteditable visual
- Portals render chips with `editing: false` always
- `confirmChipEdit` saves panel data, updates `chipsRef`, focuses contenteditable
- `cancelChipEdit` closes panel, auto-deletes chip if data is all-empty
- A ZWS text node (U+200B) is inserted after each chip span so iOS can anchor the caret correctly; stripped by `serialise()`

**Chip serialisation format** (sent to the marking AI):
- Fraction: `(numerator)/(denominator)` — e.g. `(3)/(5)`
- Power: `(base)^(exponent)` — e.g. `(x)^(2)`
- Square root: `sqrt(radicand)` — e.g. `sqrt(4)`
- Nth root: `n*sqrt(radicand)` — e.g. `3*sqrt(8)`

`mark-answer/index.ts` has a STUDENT ANSWER NOTATION section (both Maths and Physics prompts) explaining this notation to Claude. If the serialisation format ever changes, update that section too.

### All AI functions returning 500 simultaneously
If `generate-questions`, `mark-answer`, and `jam-help` all fail at the same time, check the **Anthropic Console** first — quota exhausted or billing issue is the most likely cause. All five edge functions share the same `ANTHROPIC_API_KEY`. A code regression in one function would not cause all to fail simultaneously.

### Diagram component pattern (overhauled 11/06/2026 — see DIAGRAMS.md)
Parametric SVG diagram library. **DIAGRAMS.md** (repo root) is the source of truth for all param schemas — read it before touching any diagram component. Each diagram family:
- A pure renderer component in `src/components/diagrams/` (inline SVG, validates own params, renders null + `console.warn` on malformed params — never throws)
- An entry in `QUESTION_DIAGRAM_REGISTRY` (`questionDiagramRegistry.tsx`): `{ component, questionSafe }`
- `diagram_component` + `diagram_params` fields on the question record

**Registry mechanics:**
- Components receive `({ params, mode })` where `mode` is `'question' | 'feedback'` (default `'question'`). Feedback-only layers (resultants, answer labels, completed histogram bars) only render when `mode === 'feedback'`. QuestionCard passes `'question'`; FeedbackCard and LearningContent pass `'feedback'`.
- `questionSafe: boolean | (params) => boolean` — whether the diagram may appear in QuestionCard at all. QuestionCard consults `isQuestionSafe(key, params)`; FeedbackCard renders everything. This replaced the old hardcoded `quadratic-inequality-graph` exclusion.

**Registry keys (all live):**

| Key | questionSafe | Params / feedback-only layer |
|---|---|---|
| `probability-tree` | true | 2-stage tree config; `hidden` branches make it interactive in QuestionCard |
| `quadratic-inequality-graph` | **false** | `{ roots: [n,n], a?, inequality? }` — shows the answer region |
| `completing-the-square-area-model` | true | `{ b: number }` |
| `parabola-vertex-graph` | **false** | `{ p, q, a? }` — shows the vertex (flag added 11/06; was a leak risk) |
| `free-body-diagram` | true | `{ object?: box\|dot\|car\|rocket, forces[], balanced? }`; feedback layer: `showResultant` |
| `vector-diagram` | true | `{ vectors[], grid?, axes?, tipToTail? }`; feedback layer: `showResultant`+`resultantLabel` |
| `wave-diagram` | true | `{ type: transverse\|longitudinal, cycles?, amplitude?, labels?, markers?, energyArrow?, secondWave?, axisLabels? }`; feedback layer: `answerLabels`. **`markers`** = lettered arrows (transverse) / section brackets (longitudinal) for "Which arrow/section shows…?" questions answered by a letter — the answerable replacement for the old "identify on a bare diagram" pattern (see DIAGRAMS.md §5). `energyArrow` (longitudinal) draws the direction-of-energy-transfer arrow. Has a composer `editor`. |

Still to build (DIAGRAMS.md priority order): `histogram`, `vector-geometry-diagram`, `circuit-diagram`.

**Diagram Gallery** (`/admin/diagram-gallery`, card in AdminHub → Content Tools) — developer QA harness. For every registry key: live preview, Question/Worked-solution mode toggle, question-safe badge, editable JSON params with apply, preset examples, and Download SVG (standalone file via XMLSerializer). New registry entries appear automatically; add presets to `GALLERY_METADATA` in `AdminDiagramGallery.tsx`.

**AI diagram generation wired in prompt_config:**
- `inequalities-higher` → `quadratic-inequality-graph` (pre-existing; also documented in `HIGHER_OUTPUT_FORMAT` in `generate-pending-questions`)
- `wave-properties` → `wave-diagram` (11/06/2026; schema + rules + 2 few-shots in `system_prompt`. The Physics insert path passes `diagram_component`/`diagram_params` through generically, so no edge function change was needed)

**Known data issue (found 11/06/2026, RESOLVED 12/06/2026):** `prompt_config` was stored as a JSON **string scalar** (not an object) on several Physics subtopics — the edge functions read `promptConfig.system_prompt` as `undefined`, so those configs were silently ignored. All six (`sound-ultrasound-seismic`, `em-spectrum`, `light-reflection-refraction-colour`, `lenses-magnification`, `black-body-radiation`, `conservation-dissipation-energy`) were repaired 12/06/2026 (parse + write back as object) — alongside the earlier `wave-properties` fix. Repair pattern if it recurs: read, `JSON.parse`, write back as object (or SQL `(prompt_config #>> '{}')::jsonb`).

**Diagram next steps:**
1. **Circuit component** (`circuit-diagram`, DIAGRAMS.md Phase 5): symbol sub-library first, John signs off each AQA symbol in the gallery before layout work. NOTE: the close-out brief referenced a circuit reference prototype in `docs/reference/` to port from, but **no `docs/` directory exists in the repo** — locate/obtain this prototype from John before starting.
2. **Seeded Question Composer** — DONE 12/06/2026 (`/admin/seeded-composer`, `AdminSeededComposer.tsx`). Shell + Waves editor + save flow built; awaiting John's iPad sign-off before adding free-body/vector editors or polish. Extend by adding an `editor` (+ `editorDefaults`/`label`) to a registry entry — the composer shell auto-discovers families with an editor. NEXT family editors: free-body, vector. Composer is single-part only so far (multi-part `parts` not yet supported).
3. Remaining components in priority order: `histogram`, `vector-geometry-diagram`, then circuit.
4. **Review Queue renders `diagram_params` visually** — DONE 12/06/2026 (`DiagramReviewPanel` in `AdminReviewQueue.tsx`): question/worked-solution toggle, inline warnings for unknown/malformed params, error boundary; A/E/R shortcuts intact.

### prompt_config — system_prompt field rules
The `system_prompt` in `prompt_config` is injected into the paper prompt builder. The builders already handle question format, mark scheme structure, LaTeX rules, and forbidden question types.

**system_prompt must contain:** spec statements, key vocabulary, specific constraints, exam-board specific details.
**system_prompt must NOT contain:** question format instructions, mark scheme format, LaTeX rules, generic exam technique advice.

**`marking_guidance` injection (fixed 10/06/2026):** `prompt_config.marking_guidance` is injected as a "SUBTOPIC-SPECIFIC MARKING GUIDANCE" block into all Maths Foundation/Higher P1/P2/P3 builders in both `generate-questions/index.ts` and `generate-pending-questions/index.ts`, plus the Physics builder. If adding a new builder/paper variant, copy this block too — it was previously Physics-only, which silently meant any `marking_guidance` written for a Maths subtopic was never sent to Claude.

### AuthContext pattern
`src/contexts/AuthContext.tsx` — key design decisions:
- `fetchUserData` takes an `initialLoad` flag — loading states only toggled on first load, never on `refreshProfile()` calls. Without this, silent refreshes cause redirect guard flicker.
- `initialLoadDoneRef` (useRef) tracks whether the first load has run. Subsequent session changes (e.g. `TOKEN_REFRESHED` when switching tabs) call `fetchUserData` with `initialLoad: false`, so `ProtectedRoute` never sees a loading state and never unmounts the page. Without this, switching browser tabs would remount pages and clear all form state.
- Both `subscriptions` and `profiles` fetched in parallel via `Promise.all`
- `.maybeSingle()` used throughout — eliminates 406 errors for users with no row
- Daily reset logic: if `questions_used_date` is not today, `questionsUsed` is treated as 0

### Free tier gate constants (PracticeRoom.tsx)
```tsx
const FREE_QUESTION_LIMIT = 10;
const FREE_JAM_HELP_TURNS = 2;
const SUBSCRIBER_JAM_HELP_TURNS = 5;
```

### Learning content paragraph styles
Stored in `sections[].paragraphs[].style` (or `is_non_example: true` for legacy watch-out):

| style | Renders as |
|-------|-----------|
| _(none)_ | Plain body text |
| `key-point` | Amber left-border block |
| `exam-tip` | Green bordered block with "Exam tip" label |
| `watch-out` | Green bordered block with "Pro tip" label (data value unchanged for backward compat; legacy `is_non_example: true` also maps here) |
| `worked-example` | Light blue block with "Worked example" label — text split on `\n`, each line rendered as a separate row. First line (when it doesn't start with "Step N:") is styled as the problem statement (medium weight, divider below). Consecutive pure-equation lines (`$...$`) followed by continuation lines (`$= ...`) are auto-grouped into a KaTeX `aligned` block so all `=` signs align on the same column. |
| `subheading` | Bold inline subheading |
| `higher-only` | Purple block with "Higher ▲" label — visible to all tiers, signals Higher content |

Mirrors UK GCSE textbook convention: Foundation students see everything; Higher content is highlighted inline.

### Admin CMS architecture

Single entry point: `/admin` (AdminHub) → three labelled sections:

**Content Tools:** Content Pipeline, Review Queue, Members Area, Question Feedback.
**Maths Tools:** Probability Questions (live) + coming soon authoring cards (Trig, Vector, Higher Probability, Frequency Trees & Venn).
**Physics Tools:** placeholder section — ready for physics-specific authoring tools as they are built.

**Content Pipeline** (`/admin/content-pipeline`) is the primary workflow entry point for new subtopics:
- Create subtopic rows (subject, topic, name, slug, tier — exam_board auto-set from subject)
- **Edit subtopic name** inline — text input with Save button in the expanded panel
- Edit `prompt_config` (system_prompt + marking_guidance) inline — no SQL needed
- Toggle `active` (Draft / Live) with one tap — no SQL needed
- Copy UUID — eliminates Supabase dashboard hunting
- Status chips per subtopic: Prompt ✓/✗, Content ✓/✗, Checks (n), Questions (n)
- Deep links into Learning Content Editor and Review Queue, pre-filtered to that subtopic via URL params

**Learning Content Editor** (`/admin/learning-content`) has 4 tabs per subtopic:
1. **Learning Content** — sections and styled paragraphs; each paragraph has inline diagram upload (SVG/PNG/JPG → `diagrams/` Storage bucket). Upload, replace, and remove without leaving the editor. Diagram URL is saved with the normal "Save changes" button. Paragraphs can be reordered with ▲▼ buttons next to the style dropdown (added 08/06/2026, mirrors the section ▲▼ pattern) — **known bug:** John reports the swap doesn't behave as a true up/down move when diagrams or subheadings are involved (suspects the embedded image is the cause); needs reproduction and fix before relying on it.
2. **Check Questions** — up to 5 MCQ comprehension checks (full CRUD)
3. **Live Seeded** — all seeded practice questions; inline edit + delete
4. **Live AI** — all approved AI practice questions; inline edit + delete

Accepts `?subtopicId=UUID` to pre-select the subtopic (used by Content Pipeline deep links).
Accepts `?tab=checks` to jump directly to the Check Questions tab.

**Diagram upload flow (inline):** file → Supabase Storage (`diagrams/{subject}/{topic}/{slug}/para-{si}-{pi}-{ts}.{ext}`) → public URL stored in `working[section][para].diagram_url` → saved on "Save changes". Orphaned storage files can occur if the editor is closed before saving — acceptable trade-off.

**Review Queue** (`/admin/review-queue`) accepts `?subject=Physics&subtopicId=UUID` for pre-filtering from Content Pipeline.

**Important:** `seeded_questions` does NOT have a `calculator_allowed` column. Selecting it causes a silent Supabase error returning empty data. Use only: `id, question_text, worked_solution, mark_scheme, diagram_component` (+ `question_order`, `diagram_url`, `diagram_params` as needed).

### Unauthenticated pricing flow
When a logged-out user clicks a paid plan:
1. `PricingCards.tsx` stores the Stripe URL in `sessionStorage('pendingPlanUrl')` → `/signup`
2. `Signup.tsx` → on success → `/onboarding` (not `/login`)
3. `OnboardingFlow.tsx` → on complete → opens Stripe URL with `?client_reference_id=user.id` → `/dashboard`
4. `Login.tsx` → on success → also checks `sessionStorage` (for returning users who click plan then log in)

---

## File Structure (key files)

```
DIAGRAMS.md                       -- param schema source of truth for all diagram components
src/
  lib/
    renderMathInText.ts           -- shared KaTeX renderer ($...$ and $$...$$)
  contexts/
    AuthContext.tsx               -- auth, subscription, onboarding, questionsUsed, isAdmin
  pages/
    Login.tsx                     -- consumes sessionStorage pendingPlanUrl after login
    ResetPassword.tsx
    Members.tsx                   -- manage subscription link at bottom
    JamSessions.tsx               -- public curriculum/livestream page; tracks object holds Sept-May per-track session schedule
    Practice.tsx                  -- page wrapper: setup → learning → check → practice flow
    admin/
      AdminHub.tsx
      AdminContentPipeline.tsx    -- create subtopics, edit prompt_config, toggle active, status view, deep links
      AdminLearningContent.tsx    -- 4 tabs: Learning Content (with inline diagram upload), Check Questions, Live Seeded, Live AI; ?subtopicId= param
      AdminReviewQueue.tsx        -- Maths/Physics toggle; ?subject=&subtopicId= URL params for pre-filtering
      AdminProbabilityQuestions.tsx
      AdminMembers.tsx
      AdminFeedback.tsx           -- review flagged questions
      AdminDiagramGallery.tsx     -- diagram QA harness: preview, presets, JSON editor, SVG download
      AdminReviewQueue.tsx        -- + DiagramReviewPanel: renders pending diagrams via registry (Q/solution toggle, warnings)
      AdminSeededComposer.tsx     -- Seeded Question Composer; touch-first, registry editor field; first family Waves
      LiveQuestionsTab.tsx        -- shared component for Live Seeded + Live AI tabs
  components/
    Navbar.tsx                    -- Jam Sessions in both navLinks and appLinks
    ProtectedRoute.tsx            -- requireAdmin prop; skips onboarding redirect for admin routes
    onboarding/
      OnboardingFlow.tsx          -- on complete, opens Stripe if sessionStorage pendingPlanUrl set
    learn/
      LearningContent.tsx         -- section-by-section reader with styled paragraph types
      InteractiveSection.tsx
    practice/
      PracticeRoom.tsx            -- merged pool, free tier gate, incrementQuestionsUsed
      QuestionCard.tsx            -- uses MathEditor for answer input
      FeedbackCard.tsx
      JamHelpPanel.tsx            -- keyed by questionId, resets only on question change
      MathEditor.tsx              -- contenteditable + chip toolbar; chips always locked in div, edit panel below
      MathInput.tsx               -- legacy file (may still exist but no longer imported)
      SessionSetup.tsx
      chips/
        FractionChip.tsx          -- numerator/bar/denominator visual chip
        PowerChip.tsx             -- base + raised exponent chip
        RootChip.tsx              -- √ chip, simple (√x) and full (ⁿ√xᵐ) variants
    diagrams/
      ProbabilityTree.tsx
      InteractiveProbabilityTree.tsx
      CirclePartsToggle.tsx
      MeckGentToggle.tsx
      MeckGentCards.tsx
      CircleTheoremDiagram.tsx
      QuadraticInequalityGraph.tsx
      CompletingTheSquareAreaModel.tsx
      ParabolaVertexGraph.tsx
      FreeBodyDiagram.tsx          -- AQA forces; box/dot/car/rocket objects
      VectorDiagram.tsx            -- grid vectors, column vectors + scale drawings
      WaveDiagram.tsx              -- transverse/longitudinal waves; markers (lettered arrows/section brackets), energyArrow
      questionDiagramRegistry.tsx  -- registry: { component, questionSafe, editor?, editorDefaults?, label? }, mode prop
      editors/
        WaveDiagramEditor.tsx      -- touch-first params editor for the composer (wave family)
supabase/
  functions/
    generate-questions/
    generate-pending-questions/
    mark-answer/
    jam-help/
    generate-mark-scheme/
    create-checkout-session/
    stripe-webhook/               -- handles checkout.session.completed, subscription.updated/deleted
```

---

## Pricing and Stripe

**Free tier:** 10 practice questions/day, 2 JAM Help exchanges/question. Resets daily.

| Product | Price/month | Stripe Price ID | Tier value |
|---------|-------------|-----------------|------------|
| The Practice Hub | £10.99 | `price_1TY61I64C8nH7JLRp76K4fDu` | `platform` |
| + Maths Livestreams | £18.99 | `price_1TY65l64C8nH7JLRWFVtLed9` | `platform_maths` |
| + Physics Livestreams | £18.99 | `price_1TY68a64C8nH7JLRvGrJ5YKA` | `platform_physics` |
| + Maths & Physics Livestreams | £24.99 | `price_1TY6AQ64C8nH7JLRspCVhegw` | `platform_both` |

**All payment links above are TEST MODE.** Live links must be created and substituted before launch.

Stripe Customer Portal (test): https://billing.stripe.com/p/login/test_00w14ggP40WMblCdqyf7i00
Live portal link will be different — update `Members.tsx` before launch.

Webhook events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
Webhook URL: `https://wgcxwtgspmfnzugszhdc.supabase.co/functions/v1/stripe-webhook`

---

## UI / Brand System

- **Background:** `#f9f3eb` (warm cream)
- **Brand red:** `#E23D28`
- **Brand orange:** `#F5A623`
- **Brand gradient:** `linear-gradient(135deg, #E23D28 0%, #F5A623 100%)`
- **Font:** Helvetica Neue
- **Terminology:** Jam Sessions, JAM Feedback, Your Journey, The Hub, Mini-Jams, JAM Help

---

## Content Philosophy

### The maths gap problem
Many GCSE Physics students have weak maths foundations. Science and Maths departments rarely coordinate. The Hub Jam addresses this quietly — students at home, at their own pace, without classroom social pressure.

### Principles for all Physics learning content
1. **Never assume prerequisite maths is secure.** Address maths dependencies directly within the content — rearranging, substitution, unit conversion, fractions, standard form.
2. **Foundation tier assumes the maths gap exists.** Always offer the accessible route (e.g. use 0.5 not ½ for rearrangement, show unit conversions step by step).
3. **Real-world anchoring before abstraction.** Physical intuition before the equation. Students who understand the concept can tolerate not fully understanding the maths.
4. **Spec accuracy is necessary but not sufficient.** Claude ensures spec accuracy and mark scheme structure. John applies teaching experience for pedagogical quality.
5. **Diagrams are layered in over time.** Every paragraph has a `diagram_url` slot. The platform accumulates personality gradually.

### Design for the least confident student
Every feature must pass this test: if a Year 10 Foundation student who is already anxious about maths encounters this for the first time, unsupervised, will they be able to use it without getting stuck? Small learning curves acceptable. Catastrophic failure modes are not.

---

## Physics Content Pipeline

### Live Physics subtopics
- **Internal Energy and Changes of State** (`internal-energy-changes-of-state`) — LIVE ✅
  - ID: `5f604bc6-d7b1-45f5-ac28-c27bab593aec`
  - Sections: What is Internal Energy?, Changes of State, Why Temp Stays Constant, Specific Heat Capacity, Evaporation
- **Specific Latent Heat** (`specific-latent-heat`) — DRAFT (content present, needs activation)
  - ID: `eae3af22-a15f-4c2c-b223-cbe39b6abbaa`
  - Sections: Specific Latent Heat (split from the above on 06/06/2026)
- **Specific Heat Capacity** (`specific-heat-capacity`) — DRAFT (content + 5 check Qs + prompt config complete)
  - ID: `ef243d86-3744-477b-a39d-7c60a37d114c`
  - Topic: Energy | Tier: Both | Exam board: AQA
  - Sections: What is SHC?, The Equation, Using the Equation, Rearranging, Using It in an Exam
  - Built from lesson PowerPoint (06/06/2026) — activate when ready

### Factory process for each new Physics subtopic
1. Share AQA source document — upload to session OR read from Google Drive (Drive MCP available: `johnmorrice2022@gmail.com`)
2. Create subtopic in **Content Pipeline** (or confirm it already exists) — copy UUID
3. Set `system_prompt` + `marking_guidance` in **Content Pipeline** prompt config editor
4. Claude writes learning content + 5 check questions in session → inserts directly via Supabase service role (Node.js script to `/tmp/`) — no SQL paste needed
5. Verify in **Learning Content Editor** and tweak as needed
6. Generate 20 questions in **Review Queue** (pre-filtered via Content Pipeline link) → review and publish
7. Add diagrams via **Diagram CMS** over time
8. Set `active = true` via **Content Pipeline** toggle

### Known Physics issue (to fix)
Physics questions show "No calculator" label — all AQA Physics papers allow calculators. Fix needed in `PracticeRoom.tsx` (calculator mode default for Physics) and `generate-questions` output (`calculator_allowed: true` for Physics).

---

## Database Scripting Pattern
Claude can update the database directly from VS Code using the Supabase JS client with the service role key. This is used for bulk data operations (content inserts, migrations, style updates) that would be impractical via the Supabase dashboard.

**Pattern:** Write a Node.js ESM script to `/tmp/script.mjs`, run with `SUPA_SERVICE_KEY=... node --input-type=module < /tmp/script.mjs`. The service role key bypasses RLS — never commit it to code.

**Service role key retrieval:** `npx supabase projects api-keys --project-ref wgcxwtgspmfnzugszhdc` (requires Supabase CLI login).

## Google Drive Access
Claude has MCP access to John's Google Drive (`johnmorrice2022@gmail.com`) within VS Code sessions. Use `mcp__claude_ai_Google_Drive__read_file_content` to read lesson materials (PowerPoints, PDFs) for content authoring. Tool schema must be loaded via `ToolSearch` before first use each session.

---

## Security & Technical Debt
See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) — living checklist of all known security issues, code quality findings, and product backlog, ordered by priority.

---

## Jam Sessions Curriculum (school-year structure)

`JamSessions.tsx` schedules now follow the UK school year rather than a generic rolling cycle:
- **September–February** — new topic coverage, 6 monthly focuses per track (FM/HM/FP/HP), unchanged content from the original 6-month cycle, just relabelled with real months
- **March–May** — exam revision: March = Paper 1 topics, April = Paper 2/3 topics, May = mixed past-paper practice and exam technique
- A note under the curriculum disclaimer states livestreams run during UK school term times

**Use as content roadmap:** the Sept–Feb topic list per track is a build order for `subtopics` — as each month's livestream topic comes round, prioritise that subtopic for learning content + question generation in Content Pipeline so the practice platform stays roughly in step with what's being taught. The March–May revision rows are cross-topic/exam-technique sessions, not new subtopics — they map more naturally onto a "revision pack" or mixed-topic practice set using existing content.

---

## Current Priorities (as of 11/06/2026)

### Recently completed (11/06/2026 — diagram library session)
- **DIAGRAMS.md** created: approved param schemas for 6 diagram families (free body, vector, wave, histogram, vector geometry, circuit), shared conventions, question-safe rules. All schema decisions recorded in its Section 10.
- **Diagram Gallery** built at `/admin/diagram-gallery` (AdminHub card under Content Tools): live preview per registry key, mode toggle, presets, JSON params editor, standalone SVG download. Replaces the GeoGebra/Concepts Pro workflow for one-off SVGs.
- **Registry refactor**: `questionSafe` metadata + `mode: 'question' | 'feedback'` prop replace QuestionCard's hardcoded exclusion; `parabola-vertex-graph` now correctly excluded from questions.
- **Built + visually signed off**: `free-body-diagram` (car/rocket drawings, per-axis magnitude scaling), `vector-diagram`, `wave-diagram` (amplitude annotation in reserved left margin; separated compression/rarefaction labels).
- **Wave AI generation wired**: `wave-properties` `prompt_config.system_prompt` now carries the wave-diagram schema, attachment rules (answer labels → `answerLabels` only), and 2 few-shot examples; repaired its string-scalar `prompt_config` storage in the same update and removed a stale "Generate exactly 4 questions" instruction.

### Recently completed (10/06/2026)
- Fixed `marking_guidance` not being injected into Maths prompt builders (Foundation/Higher, both edge functions) — was Physics-only
- Rewrote Inequalities-Higher `prompt_config` to mandate the sketch-the-curve method for quadratic inequalities (was deviating into trial-and-error)
- Added `diagram_component`/`diagram_params` to `pending_questions`/`questions`; quadratic inequality questions now carry a `quadratic-inequality-graph` worked-solution diagram through generation → review → publish → FeedbackCard
- Both edge functions redeployed with `--no-verify-jwt` (Verify JWT confirmed OFF — see CRIT-3 below for the longer-term tension between this dev convenience and re-enabling JWT)
- Built out `completing-the-square` subtopic from scratch (had no prompt config or learning content): new original `CompletingTheSquareAreaModel` diagram (registry key `completing-the-square-area-model`), 6-section learning content, 5 check questions, and `prompt_config` updated with `marking_guidance` + 3 few-shot worked examples (halve-and-adjust method). Informed by a copyrighted goteachmaths.co.uk presentation John shared — used only as a method/sequence reference, all wording/examples/diagrams original.
- Reused `CompletingTheSquareAreaModel` (no new component needed) to add area-model diagrams to 3 more existing worked examples in `completing-the-square` learning content: "Including a Constant" (b=6), "Finding the Minimum Point" (b=4), "Solving Equations" (b=2).
- Added new 7th section "Completing the Square When a > 1" to `completing-the-square` learning content (id `f215bc4f-cf60-4dac-a9a2-09a924815e67`) — factor-out-`a` method, two worked examples (write in form, minimum point) each with an area-model diagram (the diagram shows the post-factoring `b/a` value, e.g. `2x^2+12x+7` → diagram b=6).
- Expanded `completing-the-square` `prompt_config`: spec statement now covers `a>1` (was previously explicitly excluded), `system_prompt` has a new "WHEN THE LEADING COEFFICIENT a IS NOT 1" method block plus EXAMPLE 4 (write in form) and EXAMPLE 5 (minimum point) few-shots for `a>1`, `marking_guidance` and `common_mistakes` extended with `a>1` marking rules. Generation should now produce `a>1` questions for this subtopic.
- Fixed `CompletingTheSquareAreaModel`: side labels were hardcoded to a generic "ᵇ⁄₂" symbol regardless of `b` — now show the actual computed half-value (e.g. b=6 → "3", b=8 → "4") to match the worked example text. Added new `ParabolaVertexGraph` (registry key `parabola-vertex-graph`) — sketches $y=(x+p)^2+q$ with vertex + axis guide lines; swapped in for the "Finding the Minimum Point" worked example (`{p:2, q:3}` → vertex (-2,3)). Both pushed (`6c757be`).
- Refined `completing-the-square` `prompt_config` for question generation (informed by a copyrighted PhysicsAndMathsTutor.com past paper John shared — used only for general phrasing patterns, not copied): removed all diagram instructions/examples from `system_prompt` (real Edexcel exam questions don't carry diagrams — area-model diagram stays in learning content only); added a "QUESTION PHRASING STYLE" section covering Edexcel structures ("for all values of x... find p and q", "Express... Hence", two-part minimum-point/solve follow-ons, standalone "by completing the square" questions) with an explicit copyright instruction not to copy the reference paper; added a "QUESTION VARIETY" block requiring a roughly even spread of question types and a=1/a>1 across each batch, and forbidding reuse of few-shot/canonical example numbers; expanded `command_words`.
- Generated and reviewed a 17-question pending batch for `completing-the-square` under the new prompt — good mix of a=1/a>1, all three question types, varied phrasing, no diagrams. An earlier 20-question batch (generated before the diagram-removal fix, still carrying `completing-the-square-area-model`) was bulk-deleted from `pending_questions`.

### Recently completed (12/06/2026 — wave questions + composer session)
- **Repaired all six string-scalar `prompt_config` rows** (`sound-ultrasound-seismic`, `em-spectrum`, `light-reflection-refraction-colour`, `lenses-magnification`, `black-body-radiation`, `conservation-dissipation-energy`) — parse + write back as object; verified `system_prompt` now resolves.
- **Review Queue renders diagrams** (`DiagramReviewPanel` in `AdminReviewQueue.tsx`) — question/worked-solution toggle, inline warnings for unknown/malformed params + error boundary, A/E/R shortcuts intact. The gate for all future AI diagram wiring.
- **WaveDiagram `markers`** — the core fix for un-answerable wave questions. Lettered arrows (transverse: amplitude/wavelength/peak-to-trough/half-wavelength/point) and lettered horizontal **section brackets** (longitudinal: compression/rarefaction/wavelength) so "Which arrow/section shows…?" is answered by a LETTER. Plus `energyArrow` (longitudinal direction-of-energy-transfer arrow). Gallery presets added; both signed off by John. See DIAGRAMS.md §5 + [[feedback-questions-answerable-in-text-box]].
- **`wave-properties` prompt rewritten** — mandates lettered-marker multi-part identification (answer = a letter, mark scheme names it), forbids "identify on a bare diagram", drops diagrams from calculations. Deleted 3 broken live + broken pending wave questions from the old batch.
- **Seeded Question Composer built** (`/admin/seeded-composer`) — Task 3 phase 1: shell + Waves editor + save → `seeded_questions` → QuestionCard confirmation. **Awaiting John's iPad sign-off.**

### Immediate next session — Diagram library (see "Diagram next steps" in the diagram section)
- [ ] Circuit component — **first locate the reference prototype** (`docs/reference/` referenced in close-out brief does not exist in the repo)
- [ ] Seeded Composer: after iPad sign-off, add free-body + vector editors (registry `editor` field); consider multi-part `parts` support
- [ ] `histogram` + `vector-geometry-diagram` components (note: histogram "complete the histogram" has the same answerability problem as waves — needs a letter/number answer, not a draw action)
- [ ] Review + publish the good `markers` wave-properties pending questions; consider wiring markers generation into more Waves subtopics now their `prompt_config` is repaired

### Immediate next session — Bug fix
- [ ] **Fix paragraph reorder bug in Learning Content Editor** — ▲▼ buttons added 08/06/2026 to move paragraphs within a section don't produce a true up/down swap; John reports it behaves more like swapping sections, particularly when a paragraph has an embedded diagram or is a subheading. Reproduce in browser (need test admin credentials) and trace through `moveParagraphUp`/`moveParagraphDown` in `AdminLearningContent.tsx` — possible `key={pi}` reconciliation issue with `ParagraphRow`'s internal upload state.

### Immediate next session — Security (do before any marketing)
Security audit sessions planned (see SECURITY_AUDIT.md for full detail):
- **Session 1 — Critical:** CRIT-3 (re-enable JWT on edge functions), CRIT-1 (hardcoded anon key), CRIT-4 (server-side question limit), CRIT-2 (RLS on admin tables), MED-1 (XSS in renderMath), MED-5 (cap count param)
- **Session 2 — Quick wins + fragile:** MAINT-1/2/3, LOW-1, MAINT-6, MED-2/3, FRAG-1/2/5
- **Session 3 — Refactor:** DUP-2 (extract prompt builders to _shared), DUP-1 (centralise renderMath), FRAG-3

### Content
- [ ] Review and publish the 17-question pending batch for `completing-the-square` in Review Queue (good a=1/a>1 + question-type variety, no diagrams) — generate further batches as needed.
- [ ] Activate Specific Latent Heat subtopic (content present, needs review questions + activation)
- [ ] Activate Specific Heat Capacity subtopic (content + checks complete, needs review questions + activation)
- [ ] Fix Physics "No calculator" label — `PracticeRoom.tsx` + `generate-questions`
- [ ] Extend seeded question authoring form for Physics
- [ ] Delete exposed Stripe test key from Google Doc ("Untitled document" in Drive)

### Before marketing
- [ ] ICO registration (ico.org.uk, £40/year)
- [ ] Privacy Policy
- [ ] Safeguarding Policy
- [ ] Terms & Conditions
- [ ] Re-enable email confirmation in Supabase Auth

### Before Stripe goes live
- [ ] Create live mode Stripe products and payment links
- [ ] Update 4 payment links in `PracticeRoom.tsx`
- [ ] Update 4 payment links in `PricingCards.tsx`
- [ ] Update Manage subscription portal link in `Members.tsx`
- [ ] Set live `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Supabase secrets
- [ ] Create live mode webhook destination in Stripe

### Go-to-market
- [ ] Start YouTube — Free Lesson Mondays + Wed/Thu paid streams
- [ ] Pricing page on thehubjam.co.uk
- [ ] Path to first 100 paying subscribers

---

## Roles
- **John** — teaching/learning architect, content author, QA, product decisions
- **Claude** — technical implementation, SQL, code, content drafting under John's direction

John is the architect. Claude executes. Pedagogical and product judgements belong to John.
