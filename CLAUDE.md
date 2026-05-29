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
- Dev server runs on localhost:8080 or 8081
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

---

## Infrastructure

| Service  | Detail |
|----------|--------|
| Hosting  | Netlify — auto-deploys from GitHub main branch |
| Database | Supabase Pro — project ref `wgcxwtgspmfnzugszhdc` |
| Storage  | Supabase Storage — bucket: `diagrams` (single bucket, public) |
| Domain   | app.thehubjam.co.uk (Netlify) / thehubjam.co.uk (WordPress) |
| Payments | Stripe — currently in **test mode**; switch to live before launch |

**Supabase project URL:** `https://wgcxwtgspmfnzugszhdc.supabase.co`
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
| `announcements` | Admin announcements visible to all subscribers |

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
- `PracticeRoom.tsx` merges both pools, shuffles, picks up to 4. Falls back to live AI generation only when both tables are empty.

### Diagram component pattern
Each diagram type gets:
- A renderer component in `src/components/diagrams/`
- An authoring form at `/admin/[type]-questions`
- `diagram_component` + `diagram_params` fields in the question record

Established diagram types: `ProbabilityTree`, `InteractiveProbabilityTree`, `CirclePartsToggle`, `MeckGentToggle`, `CircleTheoremDiagram`.

### prompt_config — system_prompt field rules
The `system_prompt` in `prompt_config` is injected into the paper prompt builder. The builders already handle question format, mark scheme structure, LaTeX rules, and forbidden question types.

**system_prompt must contain:** spec statements, key vocabulary, specific constraints, exam-board specific details.
**system_prompt must NOT contain:** question format instructions, mark scheme format, LaTeX rules, generic exam technique advice.

### AuthContext pattern
`src/contexts/AuthContext.tsx` — key design decisions:
- `fetchUserData` takes an `initialLoad` flag — loading states only toggled on first load, never on `refreshProfile()` calls. Without this, silent refreshes cause redirect guard flicker.
- Both `subscriptions` and `profiles` fetched in parallel via `Promise.all`
- `.maybeSingle()` used throughout — eliminates 406 errors for users with no row
- Daily reset logic: if `questions_used_date` is not today, `questionsUsed` is treated as 0

### Free tier gate constants (PracticeRoom.tsx)
```tsx
const FREE_QUESTION_LIMIT = 10;
const FREE_JAM_HELP_TURNS = 2;
const SUBSCRIBER_JAM_HELP_TURNS = 5;
```

---

## File Structure (key files)

```
src/
  lib/
    renderMathInText.ts           -- shared KaTeX renderer ($...$ and $$...$$)
  contexts/
    AuthContext.tsx               -- auth, subscription, onboarding, questionsUsed
  pages/
    Login.tsx
    ResetPassword.tsx
    Members.tsx                   -- manage subscription link at bottom
    JamSessions.tsx               -- public curriculum/livestream page
    Practice.tsx                  -- page wrapper: setup → learning → check → practice flow
    admin/
      AdminHub.tsx
      AdminReviewQueue.tsx        -- Maths/Physics toggle, subjectFilter state
      AdminProbabilityQuestions.tsx
      AdminDiagrams.tsx           -- works for all subjects
      AdminMembers.tsx
  components/
    Navbar.tsx                    -- Jam Sessions in both navLinks and appLinks
    ProtectedRoute.tsx            -- reads from AuthContext, no Supabase query on mount
    onboarding/
      OnboardingFlow.tsx
    practice/
      PracticeRoom.tsx            -- merged pool, free tier gate, incrementQuestionsUsed
      QuestionCard.tsx
      FeedbackCard.tsx
      JamHelpPanel.tsx            -- maxTurns prop, effectiveMaxTurns
      MathInputToolbar.tsx
      SessionSetup.tsx
    diagrams/
      ProbabilityTree.tsx
      InteractiveProbabilityTree.tsx
      CirclePartsToggle.tsx
      MeckGentToggle.tsx
      MeckGentCards.tsx
      CircleTheoremDiagram.tsx
      questionDiagramRegistry.tsx
supabase/
  functions/
    generate-questions/
    generate-pending-questions/
    mark-answer/
    jam-help/
    generate-mark-scheme/
    create-checkout-session/
    stripe-webhook/
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
- **Internal Energy and Specific Latent Heat** (`internal-energy-specific-latent-heat`) — LIVE ✅
  - ID: `5f604bc6-d7b1-45f5-ac28-c27bab593aec`

### Factory process for each new Physics subtopic
1. Upload AQA source document to session (past paper / mark scheme — for style analysis only)
2. Identify subtopic slug and ID from database
3. Write scoped `system_prompt` + `marking_guidance` for `prompt_config`
4. Write learning content (6 sections typical)
5. Write 5 check questions
6. Run SQL — use direct `'[...]'::jsonb` cast (see SQL Patterns above)
7. Verify with `jsonb_typeof` / `jsonb_array_length`
8. Generate 20 questions in AdminReviewQueue (Physics tab) → review and publish
9. Add diagrams via Diagram CMS over time
10. Set `active = true` when ready

### Known Physics issue (to fix)
Physics questions show "No calculator" label — all AQA Physics papers allow calculators. Fix needed in `PracticeRoom.tsx` (calculator mode default for Physics) and `generate-questions` output (`calculator_allowed: true` for Physics).

---

## Current Priorities (as of 29/05/2026)

### Stripe — COMPLETE ✅
End-to-end Stripe subscription flow is working:
- Unauthenticated users who click a paid plan are taken through signup → onboarding → Stripe (plan URL preserved in `sessionStorage`)
- Returning users who click a plan and log in are taken directly to Stripe
- Webhook (`stripe-webhook` Edge Function) writes correct tier + price ID to `subscriptions` table on `checkout.session.completed`
- `.env` updated to point at correct Supabase project (`wgcxwtgspmfnzugszhdc`)

### Next session
- [ ] Fix Physics "No calculator" label
- [ ] Extend seeded question authoring form for Physics
- [ ] Second Physics subtopic end-to-end (candidate: `density-states-of-matter`)

### Before marketing
- [ ] ICO registration (ico.org.uk, £40/year)
- [ ] Privacy Policy
- [ ] Safeguarding Policy
- [ ] Terms & Conditions
- [ ] Re-enable email confirmation in Supabase Auth

### Before Stripe goes live
- [ ] Create live mode Stripe products and payment links
- [ ] Update 4 payment links in `PracticeRoom.tsx`
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
