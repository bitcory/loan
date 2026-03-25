---
phase: "01"
plan: "04"
subsystem: "auth-ui"
tags: ["login-page", "next-auth", "safe-action", "user-management", "sidebar", "session-provider"]
dependency_graph:
  requires: ["01-03"]
  provides: ["login page", "changePassword action", "user management CRUD", "adminAction-based user actions", "ADMIN-only sidebar menu"]
  affects:
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/layout.tsx
    - src/actions/auth-actions.ts
    - src/actions/user-actions.ts
    - src/app/(main)/settings/users/page.tsx
    - src/app/(main)/settings/users/users-client.tsx
    - src/app/(main)/settings/users/[id]/page.tsx
    - src/components/shared/sidebar.tsx
    - src/components/shared/session-provider.tsx
    - src/app/(main)/layout.tsx
tech_stack:
  added: []
  patterns:
    - "Client Component login form using next-auth/react signIn"
    - "authenticatedAction for changePassword server action"
    - "adminAction for all user management server actions"
    - "SessionProvider wrapper in (main) layout to enable useSession in Client Components"
    - "ADMIN-only conditional rendering in sidebar via useSession"
key_files:
  created:
    - src/app/(auth)/layout.tsx
    - src/app/(auth)/login/page.tsx
    - src/actions/auth-actions.ts
    - src/actions/user-actions.ts
    - src/app/(main)/settings/users/page.tsx
    - src/app/(main)/settings/users/users-client.tsx
    - src/app/(main)/settings/users/[id]/page.tsx
    - src/components/shared/session-provider.tsx
  modified:
    - src/components/shared/sidebar.tsx
    - src/app/(main)/layout.tsx
decisions:
  - "Sidebar is a Client Component — used useSession() instead of getServerSession() for role check"
  - "Added NextAuthSessionProvider in (main)/layout.tsx to enable useSession in sidebar; (auth)/layout bypasses this"
  - "Dialog component was already present in src/components/ui/dialog.tsx — no install needed"
  - "revalidatePath('/settings') added to changePassword action (plan omitted it)"
metrics:
  duration: "5 minutes"
  completed: "2026-03-26"
  tasks_completed: 2
  files_changed: 10
---

# Phase 1 Plan 4: Login Page + User Management Summary

Login UI wired to NextAuth credentials signIn, changePassword server action with bcrypt validation, and full ADMIN-only user management CRUD with Dialog-based forms and sidebar menu integration.

## What Was Done

### Task 1: Login Page + changePassword action

**`src/app/(auth)/layout.tsx` created:**
- Minimal passthrough layout — prevents the `(main)` layout (with Sidebar) from wrapping the login page

**`src/app/(auth)/login/page.tsx` created:**
- Client Component using `signIn("credentials", { redirect: false })`
- Korean error message: "아이디 또는 비밀번호가 올바르지 않습니다"
- Loading state disables the submit button during authentication
- Redirects to `/` on success via `router.push` + `router.refresh()`

**`src/actions/auth-actions.ts` created:**
- `changePassword` — `authenticatedAction`-based server action
- Validates current password with bcrypt.compare, hashes new password with bcrypt.hash(12)
- Retrieves user via `basePrisma` (imported dynamically, User model excluded from tenant extension)

### Task 2: User Management Page + user-actions + sidebar menu

**`src/actions/user-actions.ts` created:**
- `createUser` — creates user with `organizationId` from admin session context
- `updateUser` — updates name/role, scoped to organization
- `setUserActive` — toggle active state; prevents self-deactivation
- `resetUserPassword` — admin-initiated password reset with bcrypt
- `getUsers` — plain async function (not a safe-action) returning org-scoped user list

**`src/app/(main)/settings/users/page.tsx` created:**
- Server Component with `getServerSession` auth check
- Redirects non-ADMIN users to `/settings`
- Fetches users and renders `<UsersClient />`

**`src/app/(main)/settings/users/users-client.tsx` created:**
- Client Component with Dialog-based create user form and password reset form
- Toggle active/inactive buttons per user row
- Error display from `result?.serverError` on each action

**`src/app/(main)/settings/users/[id]/page.tsx` created:**
- Server Component detail view for a single user
- ADMIN-only, org-scoped lookup

**`src/components/shared/sidebar.tsx` modified:**
- Added `useSession` from `next-auth/react`
- Added `UserCog` icon from lucide-react
- Conditional "사용자 관리" link visible only when `session?.user?.role === "ADMIN"`

**`src/components/shared/session-provider.tsx` created (deviation):**
- Client Component wrapping `next-auth/react SessionProvider`

**`src/app/(main)/layout.tsx` modified (deviation):**
- Wrapped content with `<NextAuthSessionProvider>` to enable `useSession` in the Sidebar Client Component

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Added SessionProvider wrapper for useSession**
- **Found during:** Task 2, Step E (sidebar modification)
- **Issue:** The sidebar is a Client Component using `useSession()`, but neither the root layout nor the (main) layout had a `<SessionProvider>` from `next-auth/react`. Without it, `useSession()` throws an error at runtime ("No SessionProvider found").
- **Fix:** Created `src/components/shared/session-provider.tsx` as a thin Client Component wrapper, then wrapped the (main) layout content with it. The (auth) layout is separate and unaffected.
- **Files modified:** `src/components/shared/session-provider.tsx` (created), `src/app/(main)/layout.tsx` (modified)
- **Commit:** a598c85

**2. [Rule 2 - Missing Critical Functionality] Added revalidatePath to changePassword action**
- **Found during:** Task 1 review
- **Issue:** Plan template omitted `revalidatePath` call after password update; added `revalidatePath("/settings")` for consistency with all other actions.
- **Fix:** Added one-liner revalidatePath call before return statement.
- **Files modified:** `src/actions/auth-actions.ts`
- **Commit:** e119999

## Verification Results

```
아이디 또는 비밀번호가 올바르지 않습니다 in login/page.tsx    PASS
signIn.*credentials in login/page.tsx                        PASS
export const changePassword in auth-actions.ts               PASS
export const createUser in user-actions.ts                   PASS
export const setUserActive in user-actions.ts                PASS
export const resetUserPassword in user-actions.ts            PASS
adminAction in user-actions.ts (4 occurrences)               PASS
새 사용자 추가 in users-client.tsx                            PASS
비밀번호 리셋 in users-client.tsx                             PASS
사용자 관리 in sidebar.tsx                                    PASS
npx tsc --noEmit                                             PASS (no errors)
```

## Commits

| Hash | Description |
|------|-------------|
| e119999 | feat(01-04): add login page and changePassword action |
| a598c85 | feat(01-04): add user management page, user actions, and sidebar menu |

## Known Stubs

None — all data flows are wired. The user management page fetches real data from the database via `getUsers(session.user.organizationId)`. The login page calls the real NextAuth `signIn` endpoint.

## Self-Check: PASSED
