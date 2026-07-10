# HANDOFF — School Portal (Canvas-style Platform)

**Status:** Functionally complete backend + frontend for all three roles, wired end-to-end against a
real Postgres/Redis stack. Test suite and AWS deployment are both **partially working, not fully
green** — see below for exact state, verified by re-running everything in this session rather than
trusting prior notes.

**Date:** 2026-07-09

---

## 1. What's actually done

### Backend (Fastify + Kysely + Postgres + Redis)
- 8 services: auth, users, classes, assignments, submissions, grades, teacher-groups, stats.
- JWT + HttpOnly cookie sessions; Google OAuth **routes** implemented server-side.
- Schema matches `PLAN.md`: single `users` table with role enum, append-only `submission_versions`
  for resubmission history, `grades` tied to the exact version graded, RESTRICT on
  `classes.teacher_id` / `submissions.student_id` / `grades.graded_by` so suspending a user preserves
  history instead of cascading deletes.
- Stats endpoints are aggregate SQL (no N+1), Redis-cached.
- `npm run migrate` creates 11 tables; `npm run seed` populates 1 admin, 2 teachers, 5 students, 2
  classes, 6 assignments, 7 submissions, 3 grades — verified working in this session.

### Frontend (Next.js 15 + React 19)
- Real login → Fastify `/auth/login`, session restored via `/auth/me` on mount.
- Admin / Teacher / Student pages call the real API (no mock data left in the pages themselves).
- Middleware (`src/middleware.ts`) redirects unauthenticated/wrong-role requests before pages load.
- `npx tsc --noEmit` — clean, no errors.
- `npm run build` — succeeds (10.3s), all expected routes generated.

### Test credentials (seeded)
```
Admin:    admin@example.com    / password123
Teacher:  teacher1@example.com / password123
Student:  student1@example.com / password123
```

---

## 2. Verified problems (this is the part worth reading carefully)

I re-ran the test suite, the build, and checked the AWS state directly rather than trust the prior
draft of this file — several things it claimed turned out to be wrong or incomplete. Corrections:

### a) Frontend component tests exist but never run
`vitest.config.ts` has:
```ts
include: ['src/**/*.test.ts'],
```
This glob matches `.ts` only — **not `.tsx`**. The three component test files
(`src/app/admin/page.test.tsx`, `src/app/login/page.test.tsx`, `src/app/student/page.test.tsx`) are
silently excluded from every `npm run test` invocation. They were written, but nobody — including
CI — has ever actually executed them. There are also currently uncommitted fixes in the working tree
to two of these files (a `useToast` mock was missing `dismiss`/`toasts` fields), which is further
evidence they haven't been run since last edited.

**Fix:** change the include glob to `['src/**/*.test.{ts,tsx}']`, then run them and fix whatever
breaks — treat them as untested code, not passing code.

### b) Backend tests pass in isolation, fail when run together
Running a single unit test file (e.g. `stats.service.test.ts`) against a freshly-truncated DB: **22/22
pass.** Running the whole `unit/` directory together: 53 failed / 32 passed. Running the full suite
(`npx vitest run`): 78 failed / 35 passed, plus one unhandled exception surfaced from a Fastify hooks
internal during the auth integration test.

Root cause: tests share one Postgres database with no transaction rollback or reset between files —
seed/insert collisions (`duplicate key value violates unique constraint "users_email_key"`,
`submissions_student_id_fkey` violations) cascade across files that run in the same process. The
previous note in this file recommended running unit and integration suites separately; that is **not
sufficient** — unit test files collide with each other too.

**Fix:** wrap each test in a transaction that rolls back (`BEGIN`/`ROLLBACK` per test), or truncate
all tables in a global `beforeEach`. This is real work, not a one-line fix — budget for it before
claiming "100% coverage" in a CI gate, since a red suite can't produce a meaningful coverage number.

### c) AWS: an instance was actually launched — the app was never deployed onto it
The previous version of this file claimed AWS deployment was fully blocked by an `iam:PassRole`
permissions-boundary deny on `sandbox-ssm-instance`, and that only local verification was done. That's
inaccurate. There is currently a **running** EC2 instance:

```
i-0b15b934bb0808fc9   t3.small   us-east-1   running   launched 2026-07-10T02:03:59Z
IAM profile: sandbox-ssm-instance (attached correctly)
Public IP: 100.60.76.233
```

So the `run-instances` call did succeed at some point (whatever blocked it earlier was resolved or a
later attempt got through). However:
- Nothing answers on ports 3000/3001 at that IP.
- Via SSM, Docker is installed and the daemon is running, but `docker ps -a` returns zero containers.
- `/home/ubuntu` has only default dotfiles — the repo/image was never copied or pulled onto the box.

**In short: the instance launch succeeded; the actual app deployment step never happened.** This
instance is presumably still billing. Next step is either finish the deploy (`scp`/`git clone` the
repo via SSM, `docker compose up`, point `docs/AWS_DEPLOYMENT.md` at this exact instance) or terminate
it (`aws ec2 terminate-instances --instance-ids i-0b15b934bb0808fc9`) if it's not going to be used for
the walkthrough demo — leaving it running with nothing on it burns budget for no benefit.

### d) Leftover dead code
`src/app/api/dev-login/route.ts` still exists in the tree despite an earlier note claiming "dev-login
is gone." It's unused (the login page has no dev-login call and no Google button either — OAuth is
backend-only, no frontend chooser, as the original notes said). Harmless but should be deleted along
with cleanup, since it's a stale auth bypass route sitting in the built output.

---

## 3. Feature completeness

| Feature | Status | Notes |
|---|---|---|
| Authentication | ✅ Complete | JWT + cookies. Google OAuth routes exist server-side; no frontend button. |
| Admin: User CRUD | ✅ Complete | Create, suspend, list with search. |
| Admin: Teacher Groups | ✅ Complete | CRUD groups, manage members. |
| Teacher: Classes | ✅ Complete | CRUD classes, enroll/remove students. |
| Teacher: Assignments | ✅ Complete | Create, publish, grade submissions. |
| Student: Submissions | ✅ Complete | Submit, view feedback/grades. |
| Student: Classes | ✅ Complete | View enrolled classes + assignments. |
| Stats API | ✅ Complete | 6 endpoints, aggregate SQL, Redis-cached. |
| Backend unit/integration tests | ⚠️ Written, fail when run together | See §2b — DB isolation bug, not a logic bug. |
| Frontend component tests | ⚠️ Written, never executed | See §2a — vitest config excludes `.tsx`. |
| E2E tests (Playwright) | ❓ Not verified this session | 3 specs exist (`e2e/admin|teacher|student.spec.ts`); not run/confirmed passing. |
| Docker + CI/CD | ✅ Present | `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml` exist. |
| AWS deployment | ⚠️ Instance running, app not deployed | See §2c. |
| Chatbot (extra credit) | ❌ Not implemented | Out of scope, per `PLAN.md`. |

---

## 4. Quick start

```bash
docker compose up -d        # Postgres 17 + Redis 7
npm run migrate
npm run seed
npm run dev                 # frontend :3000
npm run server:dev          # backend :3001 (separate terminal)
# log in at localhost:3000 with the credentials in §1
```

---

## 5. Architecture decisions (unchanged from earlier notes, still accurate)

1. **Real auth, not mock** — Fastify issues a JWT in an HttpOnly cookie; frontend restores session via
   `/auth/me` on mount. Simpler and more secure for this scope than a token-in-localStorage scheme.
2. **No mock data in production pages** — every page hits the real API; a seed script populates the DB
   instead. Surfaces real API mismatches instead of hiding them behind fixtures.
3. **Single API client layer** (`src/lib/api/client.ts`) — one place to change base URL/headers, easy
   to mock in tests.
4. **Radix UI + Tailwind** — accessible primitives, fast to build, not pixel-polished by design given
   the time box.
5. **Middleware over per-page guards** — `src/middleware.ts` blocks unauthorized requests before a page
   even renders, rather than rendering-then-redirecting.
6. **Schema**: single `users` table across all 3 roles (avoids duplicating "name" three times);
   append-only `submission_versions` preserves full resubmission history; RESTRICT (not CASCADE) on
   teacher/student foreign keys so admin "delete" maps to suspend, keeping grade/class history intact.

---

## 6. What I'd do next, in priority order

1. **Fix the vitest include glob** (`src/**/*.test.{ts,tsx}`) and actually run the component tests —
   5 minutes to fix, unknown time to fix what it then reveals.
2. **Fix backend test isolation** (transaction-per-test or truncate-per-file) — this is the highest-
   leverage fix since it's currently impossible to trust a green/red signal from `npm run test`, which
   also blocks a meaningful CI coverage gate.
3. **Decide on the EC2 instance** — either finish deploying onto `i-0b15b934bb0808fc9` (repo pull +
   `docker compose up` + point DNS/security group at it) for the live walkthrough, or terminate it.
   Leaving it half-provisioned is the worst of both options cost-wise.
4. **Run the Playwright E2E specs** and fix whatever they find — never confirmed passing in this
   session.
5. **Delete `src/app/api/dev-login/route.ts`** — dead code, unused, shouldn't ship.
6. **Commit the working-tree changes** (the `useToast` mock fixes in `admin/login page.test.tsx`) —
   currently uncommitted.
7. Nice-to-haves if time remains: Google OAuth button on the login page (backend already supports it),
   file upload for submissions, request body size limits, refresh tokens, stats pagination, audit log.

---

## 7. Known limitations (still true, carried forward)

- No file upload UI — assignments are text-only.
- No frontend Google OAuth chooser — backend routes exist, unused.
- JWT expires in 24h, no refresh token flow.
- Stats API has no pagination — fine at seed-data scale, not at real scale.
- No audit log — writes land in domain tables only.
- No request body size limit on Fastify — a very large text submission would go through uncapped.

---

**Bottom line:** the product itself — auth, all three roles, grading workflow, stats API — works
end-to-end against a real stack. The two things that would fail a closer look are the test suite (real
tests, broken harness) and AWS (real instance, no app on it). Both are named honestly above with a
concrete fix, rather than glossed over.
