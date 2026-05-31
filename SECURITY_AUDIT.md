# Security Audit & Technical Debt — The Practice Hub

Last reviewed: 31/05/2026
Status key: `[ ]` open · `[~]` in progress · `[x]` done

Add new issues at the bottom of the relevant section as they are found.

---

## Critical Security

| Status | ID | File | Lines | Issue | Fix |
|--------|----|------|-------|-------|-----|
| [ ] | CRIT-1 | `src/pages/admin/AdminReviewQueue.tsx` | 44–46 | Supabase anon key hardcoded as string literal and committed to git. Used as the `Authorization` header for `generate-pending-questions` calls. | Replace with `import.meta.env.VITE_SUPABASE_ANON_KEY`. Better: use the real user access token from `supabase.auth.getSession()` for admin edge function calls. |
| [ ] | CRIT-2 | `src/contexts/AuthContext.tsx` line 139, `src/pages/admin/AdminReviewQueue.tsx` lines 831–838 | — | `isAdmin` is computed client-side only (`email === ADMIN_EMAIL`). No RLS policies restrict writes to `pending_questions`, `questions`, `seeded_questions`, or `generation_batches`. React guard is the sole line of defence. | Add RLS policies: `USING (auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin'))` on all admin-writable tables. |
| [ ] | CRIT-3 | All edge functions | — | JWT verification is disabled on every edge function (`mark-answer`, `generate-questions`, `jam-help`, `generate-mark-scheme`, `generate-pending-questions`). Any unauthenticated caller can burn Anthropic API credits. Function URLs are derivable from the client bundle. | Re-enable JWT verification in the Supabase dashboard. All client calls already send `Authorization: Bearer <access_token>`. |
| [ ] | CRIT-4 | `src/components/practice/PracticeRoom.tsx` | 177–191, 582 | Free tier 10-question-per-day limit is enforced in React state only. With JWT disabled (CRIT-3), anyone can call `generate-questions` directly with no limit. | Add server-side check in `generate-questions`: read `questions_used` from the caller's profile and return 403 if limit exceeded. Requires CRIT-3 first. |

---

## Medium Security

| Status | ID | File | Lines | Issue | Fix |
|--------|----|------|-------|-------|-----|
| [ ] | MED-1 | `src/components/practice/FeedbackCard.tsx`, `JamHelpPanel.tsx`, `QuestionCard.tsx`, `src/components/learn/LearningContent.tsx` | Multiple | XSS: AI response text is split on `\n\n`, wrapped in `<p>` tags, and injected via `dangerouslySetInnerHTML`. Non-KaTeX text segments are not HTML-escaped. A Claude response with `</p><script>...</script><p>` would execute. Student answers are passed to the AI with no sanitisation. | HTML-escape non-KaTeX text segments before wrapping: `text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')`. Apply in `renderMathInText.ts` and the inline `renderMath` copies. |
| [ ] | MED-2 | `supabase/functions/stripe-webhook/index.ts` | 48–49, 163–164 | Raw internal error messages (including Supabase table names, constraints) sent back in webhook response body. | Return generic `'Bad request'` / `'Internal error'` with no message body. Log detail with `console.error`. |
| [ ] | MED-3 | `supabase/functions/stripe-webhook/index.ts` | 65–70 | When `client_reference_id` is missing, calls `supabase.auth.admin.listUsers()` (returns all users) then `.find()` by email — O(n) full user scan. | Use `supabase.from('profiles').select('id').eq('email', email).single()` or return 400 rather than scanning all users. |
| [ ] | MED-4 | `src/components/PricingCards.tsx`, `src/pages/Login.tsx` lines 32–35, `src/components/onboarding/OnboardingFlow.tsx` lines 270–273 | — | `sessionStorage('pendingPlanUrl')` is used as a `window.open()` target with no hostname validation. An XSS exploit on the same origin (MED-1) could write a malicious URL here. | Validate hostname before use: `new URL(url).hostname === 'buy.stripe.com'`. |
| [ ] | MED-5 | `supabase/functions/generate-questions/index.ts` line 1209, `supabase/functions/generate-pending-questions/index.ts` line 365 | — | `count` parameter accepted from request body with no server-side upper bound. Caller could pass `count: 10000`. | `const safeCount = Math.min(count, 20)` before using it. |

---

## Low Security

| Status | ID | File | Lines | Issue | Fix |
|--------|----|------|-------|-------|-----|
| [ ] | LOW-1 | `src/contexts/AuthContext.tsx` line 18, `src/pages/admin/AdminReviewQueue.tsx` line 43 | — | `ADMIN_EMAIL` constant hardcoded identically in two files — must be kept in sync manually. | Extract to `src/lib/constants.ts`. |
| [ ] | LOW-2 | `supabase/functions/create-checkout-session/` | — | Listed in CLAUDE.md but directory appears absent from repo. | Confirm whether this function is needed; if not, remove references from CLAUDE.md. |
| [ ] | LOW-3 | `src/components/onboarding/OnboardingFlow.tsx` | 421 | `parent_email` stored to `profiles` with no server-side format validation beyond browser `type="email"`. | Add regex check before the Supabase upsert call. |
| [ ] | LOW-4 | `src/components/practice/FlagFeedback.tsx` | 42–58 | `catch` block only does `console.error` — student sees no indication their flag submission failed. | Show inline error message or toast on failure. |

---

## Fragile Code

| Status | ID | File | Lines | Issue | Fix |
|--------|----|------|-------|-------|-----|
| [ ] | FRAG-1 | `src/components/practice/PracticeRoom.tsx` | 177–191 | Race condition: `questionsUsed + 1` uses stale React state. Two rapid loads both read the same value and write the same increment — only one question is counted. | Atomic server-side increment: `UPDATE profiles SET questions_used = questions_used + 1 WHERE id = ?` |
| [ ] | FRAG-2 | `src/components/practice/PracticeRoom.tsx` | 256, 330 | `incrementQuestionsUsed` called in both `loadQuestions` and its fallback `generateAIQuestions` — double-increment possible if `loadQuestions` partially fails. | Use a ref to guard against double-fire per session load. |
| [ ] | FRAG-3 | `src/components/practice/PracticeRoom.tsx` | 543–549 | `saveSession` called inside a `setState` callback via `setTimeout(100ms)`. Side effects inside `setState` are forbidden by React; the 100ms is a guess that async marking is complete. | Await all `markAnswer` promises explicitly inside `handleFinish`, then call `saveSession` directly with the collected results. |
| [ ] | FRAG-4 | `src/contexts/AuthContext.tsx` | 79–112 | `fetchUserData` is not memoised with `useCallback` — stale closure risk if its dependencies ever change; linter won't catch it. | Wrap in `useCallback` with proper dependencies. |
| [ ] | FRAG-5 | `supabase/functions/stripe-webhook/index.ts` | 90–123 | Separate `select` then `insert`/`update` is not atomic — two simultaneous Stripe events for the same user could both pass the `existing` check. | Use a true upsert: `supabase.from('subscriptions').upsert({...}, { onConflict: 'user_id' })`. |
| [ ] | FRAG-6 | `src/components/practice/MathEditor.tsx` | 159–164 | On mount, `divRef.current.textContent = value` sets raw serialised chip text — chips cannot be visually restored from a saved value. Currently acceptable (answers aren't re-loaded), but breaks if answers are ever pre-populated. | Document the limitation clearly; implement chip reconstruction if pre-population is ever added. |
| [ ] | FRAG-7 | `supabase/functions/stripe-webhook/index.ts` | 52, 125 | `console.error` used for success/informational log lines, polluting error monitoring. | Use `console.log` for info; `console.error` only for actual errors. |

---

## Duplication

| Status | ID | Files | Issue | Fix |
|--------|----|-------|-------|-----|
| [ ] | DUP-1 | `src/components/practice/FeedbackCard.tsx`, `src/components/practice/JamHelpPanel.tsx`, `src/lib/renderMathInText.ts` | `renderMath` is implemented independently in all three files. The shared file exists but isn't used by the other two. | Extend `renderMathInText.ts` with a `{ newlineToBr?: boolean }` option and import from both `FeedbackCard` and `JamHelpPanel`. |
| [ ] | DUP-2 | `supabase/functions/generate-questions/index.ts`, `supabase/functions/generate-pending-questions/index.ts` | All prompt builder functions (`buildFoundationP1Prompt` etc.) are copy-pasted between both files. Prompt changes must be made in two places. `generate-questions` is 1,466 lines as a result — difficult to navigate. | Extract builders to `supabase/functions/_shared/prompts-maths.ts` and `_shared/prompts-physics.ts`; import from both functions. `generate-questions/index.ts` drops to ~270 lines (serve handler only). Highest-risk duplication for content accuracy. |
| [ ] | DUP-3 | `src/components/practice/PracticeRoom.tsx`, `src/components/PricingCards.tsx` | Four Stripe payment URLs appear as magic strings in both files. | Extract to `src/lib/stripe.ts`. |
| [ ] | DUP-4 | `src/contexts/AuthContext.tsx` line 18, `src/pages/admin/AdminReviewQueue.tsx` line 43 | `ADMIN_EMAIL` duplicated — see LOW-1. | Covered by LOW-1. |

---

## Maintainability

| Status | ID | File | Issue | Fix |
|--------|----|------|-------|-----|
| [ ] | MAINT-1 | `package.json` line 56 | `mathlive` (~2MB) still in dependencies, no longer imported. | `npm uninstall mathlive` |
| [ ] | MAINT-2 | `src/components/practice/MathInput.tsx` | Dead file, not imported anywhere, contains a `dangerouslySetInnerHTML` call. | Delete the file. |
| [ ] | MAINT-3 | `src/components/Navbar.tsx.bak` | Backup file committed to git. | `git rm src/components/Navbar.tsx.bak` |
| [ ] | MAINT-4 | All edge functions | Pervasive `any` types on AI responses — missing fields propagate silently as `NaN` or `undefined`. | Define `interface AIQuestion`, `interface MarkSchemeItem`, `interface ClaudeMarkingResponse` and use type guards at the AI API boundary. |
| [ ] | MAINT-5 | `src/pages/Signup.tsx` lines 26–28 | `role` field (`"student"` / `"parent"`) stored in `user_metadata` but nothing in the app reads or branches on it. | Either use `role` to personalise the experience or remove the role selection UI. |
| [ ] | MAINT-6 | All edge functions | Claude model ID `claude-sonnet-4-20250514` hardcoded as a string literal in all five edge functions. When the model needs updating (deprecation or upgrade), it must be changed in five places simultaneously — and missing one causes silent divergence. | Create `supabase/functions/_shared/config.ts` exporting `export const CLAUDE_MODEL = '...'`. Import in all functions. Can be done in the same session as DUP-2. |

---

## Product Backlog (non-security)

### Next session
- [ ] Fix Physics "No calculator" label — `PracticeRoom.tsx` calculator mode default for Physics + `generate-questions` output (`calculator_allowed: true` for Physics)
- [ ] Second Physics subtopic end-to-end (candidate: `density-states-of-matter`)
- [ ] Legal documents — Privacy Policy, Safeguarding Policy, Terms & Conditions
- [ ] ICO registration (ico.org.uk, £40/year)
- [ ] Re-enable email confirmation in Supabase Auth

### Before Stripe goes live
- [ ] Create live mode Stripe products and payment links
  - On each Payment Link: After payment → Redirect to website → `https://app.thehubjam.co.uk/dashboard`
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

## New Issues (add here as found)

_None yet._
