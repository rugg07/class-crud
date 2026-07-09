# Plan — School Portal Platform

## Deliverables (derived from SPECS.md + TASK.md)

### 1. Monorepo scaffold
- Next.js 15 app (frontend) + Fastify (backend API), sharing a `packages/` (or `src/`) layout for types/schemas.
- Kysely + PostgreSQL 17 schema/migrations.
- Redis client wiring (caching layer for stats endpoints, session/rate-limit use if needed).

### 2. Auth
- Roll-your-own JWT, issued on login, stored as secure HTTP-only cookie.
- 1 OAuth provider integrated (Google most likely — fastest to set up).
- Role-based middleware/guards (admin / teacher / student) protecting every route.

### 3. Domain features
- **Admin**: CRUD teacher groups, CRUD users, suspend/unsuspend students & teachers.
- **Teacher**: CRUD classes, add/remove students (enrollment), publish assignments, grade submissions + feedback.
- **Student**: view enrolled classes/assignments, submit assignments, view grades/feedback.

### 4. Public Stats API (`/api/v0/stats/*`)
- average-grades (global + per class), teacher-names, student-names, classes, classes/:id students.
- Needs to be N+1-safe (aggregate SQL, not per-row loops) and cacheable via Redis.

### 5. Testing
- Vitest unit tests per service method.
- Supertest integration tests per API route.
- @testing-library/react component tests for key UI.
- Playwright E2E for core flows (login, class creation, assignment submission, grading).
- 100% coverage gate in CI.

### 6. CI/CD
- GitHub Actions: install → lint → typecheck → test+coverage → build → (on main) push image to Docker Hub.

### 7. Containerization
- Single root-level Dockerfile (multi-stage: deps → build → runtime) that can run both Next.js and Fastify (or two targets from one Dockerfile), plus the existing docker-compose for Postgres/Redis.

### 8. Deployment (stretch)
- Docker Compose on an EC2 instance (t3/t4g), Nginx reverse proxy, Certbot SSL. AWS sandbox available if time permits — lowest priority given trial time constraints.

### 9. Handoff
- `HANDOFF.md`: what's done, what's not, trade-offs, next steps.
- 5–10 min walkthrough video/call.

## Sequencing (priority order, given limited budget/time)
1. Schema + migrations (get this right first — everything depends on it).
2. Fastify API skeleton + auth (JWT + cookie + 1 OAuth) + role guards.
3. Core CRUD services (classes, enrollment, assignments, submissions, grading) with unit + integration tests as we go — not batched at the end.
4. Stats API endpoints (aggregate queries, indexed, Redis-cached).
5. Next.js UI for the three roles (thin, functional, not pixel-polished) — component tests alongside.
6. Playwright E2E for the golden paths.
7. Dockerfile + CI pipeline.
8. Chatbot (extra credit) if time remains.
9. AWS deploy (stretch) if time remains.

## Explicitly out of scope unless time allows
- Chatbot, AWS deployment, pixel-perfect UI polish.

---

## Schema

Normalized around a single source of truth per entity, not per-role. Role-specific "views" (what
a teacher/student sees) are queries over these tables, not duplicated columns.

### Tables

- **users**(id, email, password_hash NULL, oauth_provider NULL, oauth_id NULL, name, role enum[admin|teacher|student], status enum[active|suspended], created_at, updated_at)
  - single identity table for all 3 roles — avoids duplicating "name" across 3 person-tables.
- **teacher_groups**(id, name, created_at)
- **teacher_group_members**(teacher_group_id → teacher_groups CASCADE, teacher_id → users CASCADE, PK both)
  - many-to-many: a teacher can belong to multiple groups.
- **classes**(id, teacher_id → users RESTRICT, name, created_at)
- **enrollments**(class_id → classes CASCADE, student_id → users CASCADE, enrolled_at, PK both)
  - many-to-many join for student↔class.
- **assignments**(id, class_id → classes CASCADE, title, description, due_at, published_at)
- **submissions**(id, assignment_id → assignments CASCADE, student_id → users RESTRICT, created_at, UNIQUE(assignment_id, student_id))
  - one "slot" per student per assignment; the resubmittable content lives in submission_versions.
- **submission_versions**(id, submission_id → submissions CASCADE, version_number, content, submitted_at)
  - append-only history; "current" = max(version_number) per submission. Full resubmission history preserved.
- **grades**(id, submission_id → submissions CASCADE, graded_version_id → submission_versions RESTRICT, grade, feedback, graded_by → users RESTRICT, graded_at)
  - separate from versions: grading applies to the submission slot; ties to the exact version graded.

### Cascade rules (single point of truth)
- Pure join/membership rows (`teacher_group_members`, `enrollments`) → CASCADE both sides.
- `assignments.class_id`, `submissions.assignment_id`, `submission_versions.submission_id`, `grades.submission_id` → CASCADE (child has no meaning without parent).
- `classes.teacher_id`, `submissions.student_id`, `grades.graded_by` → RESTRICT (suspend the user instead of deleting — preserves grade/class history; admin "delete" on a teacher/student should map to suspend, not a hard DB delete).

### N+1 avoidance
- Index: `enrollments(student_id)`, `enrollments(class_id)`, `teacher_group_members(teacher_id)`, `assignments(class_id)`, `submissions(assignment_id)`, `submissions(student_id)`, `submission_versions(submission_id, version_number)`, `grades(submission_id)`.
- Stats endpoints (`average-grades`, `classes/:id`) implemented as single aggregate SQL queries (Kysely `groupBy`/`avg`) — never fetch-then-loop.
- Any "list classes with student counts" or "list students with latest grade" UI query uses one joined/aggregated query, not per-row fetches.
- Redis caches the stats endpoints (read-heavy, tolerant of slight staleness); invalidate on grade/enrollment writes or use a short TTL.
