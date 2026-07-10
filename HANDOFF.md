# Handoff — School Portal Frontend Shell

## ✅ Completed

### Frontend Shell (This Sprint)
- **Next.js 15 app router** with TailwindCSS, fully typed TypeScript
- **Custom Web Crypto JWT auth** (HMAC-SHA256, no external deps, Edge-compatible)
  - `src/lib/auth/jwt.ts`: sign/verify functions
  - `src/middleware.ts`: role-based route protection (/admin, /teacher, /student)
- **Dev-only login page** (`src/app/login/page.tsx`) with role selector, clearly labeled as temporary
  - `src/app/api/dev-login/route.ts`: signs session cookie (no Kysely access, minimal)
  - `src/app/api/logout/route.ts`: clears session cookie

### UI Component Library (shadcn-style)
Built on already-installed Radix primitives + TailwindCSS:
- `button`, `card`, `input`, `label`, `badge`, `table`, `tabs`, `dialog`, `dropdown-menu`, `avatar`, `select`, `textarea`, `collapsible`, `toast`/`toaster`
- `cn()` utility for class merging
- All under `src/components/ui/`

### Domain Components
- `role-nav.tsx`: reusable header bar (role label + logout)
- Expandable rows via Radix Collapsible for detailed views

### Role Pages (Fully Functional, Mock-Backed)
1. **Admin** (`src/app/admin/page.tsx`):
   - Teacher groups list with edit actions
   - People table with tabs (Teachers | Students)
   - Search/filter by name or email
   - Suspend/activate user status toggle (local state, demo)

2. **Teacher** (`src/app/teacher/page.tsx`):
   - Student roster with expandable rows
   - Each expanded row shows submission list + feedback & grade input
   - Save feedback & grade button (wired to local state, demo)

3. **Student** (`src/app/student/page.tsx`):
   - Enrolled classes (cards)
   - Assignments per class with publish status badge

### Data Layer
- `src/lib/mock-data/`: user, class, enrollment, teacher-group, assignment, submission, grade fixtures
  - All typed to `src/server/db/types` for schema consistency
  - Helper functions mimic eventual service signatures (getStudentsForTeacher, getAssignmentsForClass, etc.)
  - Designed for 1:1 swap to real Fastify API calls without component rewrites

### Schema
- **Migration 005** (`src/server/db/migrations/005_add_submission_files_and_grading_scale.ts`):
  - `submission_versions`: added `file_url`, `file_name`, `mime_type`, `file_size` (nullable)
  - `assignments`: added `max_points` (numeric, default 100)
  - `src/server/db/types.ts` updated accordingly

### Build & Deploy
- ✅ **TypeScript**: `npx tsc --noEmit` passes
- ✅ **Next.js build**: `npm run build` succeeds
- ✅ **Dev server**: `npm run dev` runs at `http://localhost:3000`
- ✅ **Auth flow verified**:
  - Unauthenticated requests → redirect `/login`
  - Dev login signs session cookie
  - Authenticated requests access role pages
  - Wrong-role requests → redirect to user's own role page

---

## ⚠️ Out of Scope (Deferred)

### Backend (Fastify)
- **Auth**: real JWT+cookies, OAuth (Google/GitHub/Microsoft), middleware guards — not implemented
- **API routes**: `/api/users`, `/api/classes`, `/api/enrollments`, `/api/assignments`, `/api/submissions`, `/api/grades`, `/api/stats/*` — stubbed in `src/server/` but incomplete
- **Services**: full CRUD + validation for all entities — partially stubbed (tests exist but routes not wired)
- **Stats API**: aggregation & Redis caching — not implemented

### Frontend Features
- **Assignment creation/publication** UI (teacher can toggle "publish" on cards, but no full form)
- **Enrollment add/remove** UI (student roster is view-only)
- **Class CRUD** UI for teachers (only view enrolled classes)
- **File upload** for student submissions (UI skeleton exists, no backend storage)
- **Grade numeric scale** display in student feedback (input field exists, no validation/persistence)

### Testing
- No unit tests for React components
- No E2E tests (Playwright installed, not written)
- No integration tests for API routes (tests exist server-side but routes incomplete)

---

## 🔄 Next Steps (Priority Order)

### 1. **Fastify Backend** (Medium/High Effort)
   - Wire up existing service layer to Fastify routes (`src/server/*/routes.ts`)
   - Implement missing services (teacher-groups CRUD, class add/remove students, assignment publish)
   - Full auth: JWT, OAuth provider integration, middleware guards
   - Stats API with Redis caching
   - Run `npm run migrate` to seed new schema columns

### 2. **Replace Mock Data** (Low/Medium Effort)
   - Swap `src/lib/mock-data/*` calls for real API fetch calls
   - Add loading states and error handling
   - No component tree changes needed (API contract matches mock signatures)

### 3. **Complete UI Features** (Low/Medium Effort)
   - Assignment creation dialog (teacher)
   - Enrollment manage dialog (teacher: add/remove students)
   - File upload form (student) + backend storage integration
   - Numeric grade scale display (student) once backend persists them

### 4. **Testing** (Medium Effort)
   - Component tests for role pages (React Testing Library)
   - E2E tests for golden paths (login → create → submit → grade, Playwright)
   - API integration tests (Supertest)

### 5. **Deployment** (Low Effort)
   - Dockerfile (root-level, multi-stage for Next.js + Fastify if colocated, or separate images)
   - Docker Compose for local stack
   - Nginx reverse proxy config (optional, stretch)
   - AWS EC2 deployment (optional, stretch)

---

## 📋 Tech Decisions & Rationale

### Auth Approach (Web Crypto JWT)
- **Why**: Edge-compatible middleware needs Web Crypto, not Node's `crypto`; avoids experimental `nodeMiddleware` flag
- **Trade-off**: Custom implementation (no jsonwebtoken lib) means we own correctness; payload simple (no refresh tokens yet)
- **Future**: Fastify backend will issue real JWTs via jsonwebtoken; middleware just verifies the cookie exists

### Mock Data Instead of Route Handlers
- **Why**: Avoids establishing a bad pattern (Route Handlers wired to Kysely); keeps frontend/backend cleanly separated
- **Trade-off**: Mock data module lives in `src/lib/`, not `src/app/api/`; no real HTTP calls yet
- **Future**: Swap imports (`src/lib/mock-data/` → `fetch('https://api/...')`) when Fastify exists

### Collapsible Primitive (New Radix Dependency)
- **Why**: Natural fit for "expand row to see details"; Radix provides accessible semantics + animation hooks
- **Trade-off**: One new dependency; was approved in plan per SPECS.md ("may install extra Radix")
- **Future**: No future work needed; it's a leaf component

### Suspend/Unsuspend as Local State (Demo)
- **Why**: Simplest way to show the feature works; no backend persistence needed for demo
- **Trade-off**: State resets on page reload; not suitable for production
- **Future**: Wire to real PATCH `/api/users/:id` endpoint once backend exists

---

## 🧪 Testing the App (Manual)

1. **Start services**:
   ```bash
   docker compose up -d
   npm run migrate
   npm run dev
   ```

2. **Log in**:
   - Open http://localhost:3000/login
   - Pick role (Admin, Teacher, Student) and a name/email
   - Click "Sign In" → redirects to `/admin`, `/teacher`, or `/student`

3. **Admin page**:
   - View teacher groups and users (tabs: Teachers | Students)
   - Search by name/email
   - Click Suspend/Activate to toggle status (local demo)

4. **Teacher page**:
   - View student roster (expandable rows)
   - Expand a student → see mock submission data + add feedback & grade
   - Click "Save Feedback & Grade" (logs to console, local demo)

5. **Student page**:
   - See enrolled classes
   - View assignments per class with status badges

6. **Logout**:
   - Click "Logout" in header → clears cookie, redirects to `/login`

---

## 📁 File Structure

```
src/
  app/                          # Next.js app router
    admin/, teacher/, student/  # Role pages
    api/dev-login, logout       # Auth endpoints (temporary)
    login/                       # Dev login form
    globals.css                 # Base styles + CSS vars
    layout.tsx, page.tsx        # Root layout & home redirect
  components/
    ui/                         # 14 shadcn-style primitives on Radix
    domain/                     # role-nav.tsx (reusable header)
  lib/
    auth/jwt.ts                 # Web Crypto HMAC-SHA256 sign/verify
    mock-data/                  # 8 fixture files + index with helpers
    utils.ts                    # cn() utility
  middleware.ts                 # Role-based route protection
  server/                       # Fastify backend (stubbed, incomplete)
    db/
      migrations/005_*          # Schema: file metadata + max_points
      types.ts                  # Kysely DB interface (updated)
    */                          # services, routes (incomplete)

next.config.mjs, tailwind.config.ts, postcss.config.mjs
```

---

## 🎯 Success Criteria (This Sprint)

- ✅ Frontend builds and runs locally
- ✅ Auth middleware enforces role-based access
- ✅ Dev login sets session cookie (temporary)
- ✅ All three role pages render with mock data
- ✅ UI components are reusable and shadcn-style consistent
- ✅ Schema updated for file uploads & grade scale
- ✅ No Route Handlers wired to Kysely (kept frontend/backend clean)

---

## 🚀 Walkthrough Notes

The app is fully clickable end-to-end. When demoing, emphasize:
1. **Auth flow**: middleware redirects unauthenticated users, enforces role-based routes
2. **UI reuse**: PeopleTable used by both Admin (tabs) and Teacher (roster), FeedbackBox reused for teacher edits & student view
3. **Mock-to-real swap**: mock data shaped exactly like schema; Fastify API calls will be 1:1 replacements
4. **Minimalist UX**: Radix collapsible for inline expansion (not modal), tabs for space-efficient teacher/student toggle, simple forms (no fancy validation yet)
5. **Next.js patterns**: Server Components where possible (student page), Client Components for interactivity (admin filters, teacher feedback saves)

---

**Commit**: `ca8998a` — "feat: Frontend shell with Next.js, Radix UI, auth middleware, and role-based pages"
