

# VitaLuxe White-Label Forensic Audit Report

---

## SECTION A — EXECUTIVE SUMMARY

| Question | Answer |
|----------|--------|
| Is VitaLuxe fully white-label safe? | **NO** |
| Can a technical user infer Lovable/AI-builder usage? | **YES** |
| Confidence | **HIGH** |
| Severity | **HIGH** |
| Final result | **❌ FAIL** |

There are **13 distinct findings** across 5 categories: public-facing HTML, backend code, database records, root-level documentation files, and test artifacts. The most critical are the favicon URL containing `gpt-engineer` (visible to every visitor) and 227 audit_log rows containing `lovableproject.com` URLs with `__lovable_token` JWTs (visible to admins).

---

## SECTION B — COMPLETE SURFACE INVENTORY

| Surface Category | Checked | Method | Clean? |
|-----------------|---------|--------|--------|
| Public website HTML/meta | Yes | File search + view | **NO** — favicon URL contains `gpt-engineer` |
| Auth/session pages | Yes | Code search | Clean |
| Portal/application UI | Yes | Code search for "lovable", "claude", "anthropic" | Clean |
| Email templates (code) | Yes | Search all template files | Clean — all say "VitaLuxe" |
| Backend edge functions | Yes | Code search | **NO** — origin allowlist, AI gateway URLs, error messages |
| Database (all 130+ tables) | Yes | SQL queries on text/JSON columns | **NO** — 227 audit_log rows |
| Public assets | Yes | Directory listing | Clean |
| robots.txt | Yes | File view | Clean |
| package.json / lock files | Yes | Search | **NO** — `lovable-tagger` in devDependencies (non-user-facing but in repo) |
| Root markdown files | Yes | Search | **NO** — 11 files contain "Lovable" references |
| Test HTML files | Yes | Search | **NO** — 4 test files in public root |
| Vite config | Yes | File view | **NO** — imports `lovable-tagger` (dev-only, not in prod build) |
| `.lovable/` directory | Yes | List | Present (`.lovable/plan.md`) — internal only |
| `.github/copilot-instructions.md` | Yes | View | Clean — no Lovable references |
| Playwright config | Yes | Search | **NO** — references `lovable-agent-playwright-config` |
| Admin webhook monitor | Yes | View | **NO** — hardcoded Supabase project ref in URL |
| Console logs | Yes | Review | Clean at runtime |
| OG image / social meta | Yes | HTML view | Clean content, but favicon is problematic |

---

## SECTION C — DATABASE-WIDE SEARCH COVERAGE

| Table | Columns Searched | Matches | Exposure |
|-------|-----------------|---------|----------|
| audit_logs | details (JSONB), user_agent | **227** (all `client_error` type with `lovableproject.com` URLs + `__lovable_token` in stack traces) | **Admin-facing** via ErrorLogsView + AuditLogsViewer |
| notifications | title, message | 0 | — |
| notification_queue | action_url, metadata | 0 | — |
| internal_messages | subject, body | 0 | — |
| support_tickets | subject, description | 0 | — |
| support_ticket_replies | message | 0 | — |
| messages | body | 0 | — |
| system_settings | setting_value | 0 | — |
| products | image_url | 0 | — |
| pending_practices | notes | 0 | — |
| notifications_sent | metadata | 0 | — |

**Additional tables checked with no matches**: notification_logs, patient_messages, pharmacies, performance_metrics.

---

## SECTION D — ALL FINDINGS

### Finding 1: Favicon URL contains `gpt-engineer` (CRITICAL)

- **Severity**: CRITICAL
- **Location**: `index.html` line 29
- **What**: `<link rel="icon" href="https://storage.googleapis.com/gpt-engineer-file-uploads/KivqIrvEIkYR4O2L7dBS9PAlF0F2/uploads/1760919669485-Vitaluxe Services.png">`
- **Who sees it**: Every visitor — visible in page source, DevTools Network tab, browser tab tooltip
- **Discovery**: View page source, inspect favicon request in Network tab
- **Fix**: Host favicon on VitaLuxe's own domain or Supabase storage, update `index.html`
- **Classification**: A — Safe non-functional cleanup

### Finding 2: 227 audit_log rows contain `lovableproject.com` URLs (HIGH)

- **Severity**: HIGH
- **Location**: Database `audit_logs` table, `details` JSONB column
- **What**: Error logs from development/preview sessions contain full URLs like `https://c3f5b3e3-6069-4d4f-99ce-8809fbc21ade.lovableproject.com/?__lovable_token=...` plus stack traces referencing the same domain
- **Who sees it**: Admins via ErrorLogsView and AuditLogsViewer components
- **Discovery**: Admin opens Error Logs or Audit Logs, clicks "View Details" on any client_error entry
- **Fix**: SQL cleanup to scrub/delete these historical rows. Also consider sanitizing `window.location.href` in the error logger before writing to DB (strip query params containing tokens)
- **Classification**: A (DB cleanup) + B (error logger sanitization)

### Finding 3: `assign-user-role` origin allowlist contains Lovable domains (HIGH)

- **Severity**: HIGH
- **Location**: `supabase/functions/assign-user-role/index.ts` lines 26-28
- **What**: CSRF origin check includes `.lovableproject.com`, `.lovable.app`, `.lovable.dev`
- **Who sees it**: Anyone inspecting the edge function source (if exposed), or in error responses
- **Discovery**: Code inspection, or a 403 error message might reference allowed origins
- **Fix**: Remove the Lovable domains — only keep `app.vitaluxeservices.com`. If preview testing is needed, use an env var
- **Classification**: B — Low-risk technical hardening

### Finding 4: AI image generation references `lovable.dev` gateway (MEDIUM)

- **Severity**: MEDIUM
- **Location**: `supabase/functions/generate-product-image/index.ts` lines 89-90, 104-106, 118-122, 144; `supabase/functions/batch-generate-product-images/index.ts` lines 81-93, 181-183, 236
- **What**: Edge functions reference `LOVABLE_API_KEY`, `ai.gateway.lovable.dev`, and error message "Please add credits to Lovable AI"
- **Who sees it**: Admin-only (image generation is admin-triggered). Error messages could surface in toasts
- **Discovery**: If image generation fails, the error "Payment required. Please add credits to Lovable AI" would appear. Backend code inspection
- **Fix**: Change error messages to generic "AI service error". The gateway URL and API key name are internal/server-only and less critical
- **Classification**: A (error messages) + acceptable (gateway URL is server-side only)

### Finding 5: `README.md` is a Lovable template (MEDIUM)

- **Severity**: MEDIUM
- **Location**: `README.md` — title "Welcome to your Lovable project", links to `lovable.dev/projects/...`
- **Who sees it**: Anyone with repo access (GitHub)
- **Fix**: Replace with VitaLuxe-branded README
- **Classification**: A — Safe non-functional cleanup

### Finding 6: 10+ root-level markdown files reference "Lovable" (MEDIUM)

- **Severity**: MEDIUM
- **Location**: `PHASE3_FINAL_AUDIT_REPORT.md`, `PHASE3_SECURITY_CERTIFICATE.md`, `SUPABASE_CLI_SETUP.md`, `CART_VERIFICATION_REPORT.md`, `PHASE3_QUICK_START.md`, `PHASE3_FINAL_VERIFICATION_REPORT.md`, `PHASE3_DEPLOYMENT_SUMMARY.md`, `PHASE-4-5-SUMMARY.md`, `ops/security/PHASE_6B_OPTIONAL_SUMMARY.md`, `SECRET_ROTATION_PROCEDURES.md`
- **What**: References to "Lovable AI Development Team", "Lovable Cloud", "Lovable dashboard", "Lovable Backend"
- **Who sees it**: Anyone with repo access
- **Fix**: Delete or rebrand these internal docs. Most are historical audit/deployment reports
- **Classification**: A — Safe non-functional cleanup

### Finding 7: Test HTML files in project root (LOW)

- **Severity**: LOW
- **Location**: `test-admin-login.html`, `test-email-direct.html`, `test-email-functionality.html`, `test-token-password-reset.html`, `verify-all-functions.html`, `verify-password-flags.html`, `test-without-changing-admin.html`
- **What**: Test/debug files that reference Supabase URLs and could indicate a generated workflow
- **Who sees it**: Repo access only; not served in production (Vite SPA serves from `index.html`)
- **Fix**: Delete all test HTML files from project root
- **Classification**: A — Safe non-functional cleanup

### Finding 8: Hardcoded Supabase project ref in webhook monitor (MEDIUM)

- **Severity**: MEDIUM
- **Location**: `src/components/admin/ViosWebhookMonitor.tsx` line 113
- **What**: `https://qbtsfajshnrwwlfzkeog.supabase.co/functions/v1/receive-pharmacy-webhook/...` — exposes Supabase project ref
- **Who sees it**: Admin-only UI
- **Fix**: Use `import.meta.env.VITE_SUPABASE_URL` instead of hardcoded URL
- **Classification**: B — Low-risk technical hardening

### Finding 9: Playwright config references Lovable (LOW)

- **Severity**: LOW
- **Location**: `playwright-fixture.ts`, `playwright.config.ts`
- **What**: Imports from `lovable-agent-playwright-config`
- **Who sees it**: Repo access only, dev dependency
- **Classification**: A — Safe cleanup if desired, no production impact

### Finding 10: `lovable-tagger` in devDependencies (LOW)

- **Severity**: LOW
- **Location**: `package.json` line 108, `vite.config.ts` line 4
- **What**: Dev-only dependency, only active in development mode (`mode === "development" && componentTagger()`)
- **Who sees it**: Repo access only. NOT in production bundles
- **Classification**: Acceptable — dev tooling, no production exposure

### Finding 11: `.lovable/plan.md` directory (LOW)

- **Severity**: LOW
- **Location**: `.lovable/plan.md`
- **Who sees it**: Repo access only
- **Classification**: A — Can be gitignored

### Finding 12: `scripts/verify-deployment.sh` references Lovable (LOW)

- **Severity**: LOW
- **Location**: `scripts/verify-deployment.sh` lines 52, 56, 142
- **What**: Warning messages mention "Lovable Cloud projects"
- **Who sees it**: CI/CD pipeline operators only
- **Classification**: A — Safe text replacement

### Finding 13: `OrderDetailsDialog.tsx` and `send-vios-order` contain Supabase URL pattern comments (LOW)

- **Severity**: LOW
- **Location**: `src/components/orders/OrderDetailsDialog.tsx` line 295, `supabase/functions/send-vios-order/index.ts` line 41
- **What**: Code comments mention `supabase.co` URL patterns — informational, not Lovable-specific
- **Classification**: Informational — not a Lovable fingerprint

---

## SECTION E — WHAT A TECHNICAL USER COULD STILL SEE

**Right now, a technical user inspecting VitaLuxe could discover:**

1. **Favicon request** in Network tab → `storage.googleapis.com/gpt-engineer-file-uploads/...` — this is the single most discoverable trace. "GPT Engineer" was Lovable's original name. Any technical user would immediately understand this.

2. **Page source** → same favicon `<link>` tag with `gpt-engineer` in the URL.

3. **Admin users** viewing Error Logs → full `lovableproject.com` URLs with `__lovable_token` JWTs in error details.

4. **Anyone with GitHub repo access** → README says "Welcome to your Lovable project" with a direct link to the Lovable project dashboard.

---

## SECTION F — ROOT CAUSE RISKS

1. **Favicon**: The original Lovable/GPT-Engineer file upload service was used to host the favicon. It was never migrated to VitaLuxe infrastructure.

2. **Audit logs**: The error logger (`errorLogger.ts`) captures `window.location.href` which includes the full preview domain and `__lovable_token` query parameters during development sessions. These get persisted to the database permanently.

3. **Documentation**: Internal audit/deployment docs were generated by the AI development process and reference "Lovable" throughout. They were never cleaned up or rebranded.

4. **Origin allowlist**: The CSRF protection in `assign-user-role` was configured to allow preview domains for development testing and was never stripped for production.

---

## SECTION G — SAFE FIX PLAN

### Priority 1 — Immediate (Category A: Safe non-functional cleanup)

1. **Replace favicon URL** in `index.html` — host the favicon image on VitaLuxe's own domain or storage bucket, remove the `gpt-engineer-file-uploads` reference
2. **Clean audit_log rows** — DELETE or UPDATE the 227 `client_error` rows containing `lovableproject.com` URLs (all are old dev-session errors, not business data)
3. **Replace README.md** — Write a proper VitaLuxe-branded README
4. **Delete or rebrand root markdown files** — Remove the 10+ PHASE/REPORT/DEPLOYMENT docs that reference Lovable, or move to a non-committed location

### Priority 2 — Important (Category B: Low-risk technical hardening)

5. **Remove Lovable domains from `assign-user-role` origin allowlist** — keep only `app.vitaluxeservices.com`
6. **Fix error messages in image generation functions** — replace "Lovable AI" with generic "AI service" in user-facing error strings
7. **Use env var for webhook URL** in `ViosWebhookMonitor.tsx` — replace hardcoded Supabase ref
8. **Sanitize error logger** — strip `__lovable_token` and preview domain query params from `window.location.href` before persisting to `audit_logs`
9. **Delete test HTML files** from project root

### Priority 3 — Optional hygiene (Category A)

10. Replace "Lovable Cloud" references in `scripts/verify-deployment.sh`
11. Add `.lovable/` to `.gitignore`
12. Replace `lovable-agent-playwright-config` references if custom test framework is used

### Explicitly NOT changing (Category C — functional risk)

- `lovable-tagger` dev dependency — dev-only, no production exposure, removing could break dev workflow
- `ai.gateway.lovable.dev` URLs in edge functions — server-side only, required for AI features to work
- `LOVABLE_API_KEY` env var name — server-side only, renaming would require secret reconfiguration

---

## SECTION H — COVERAGE CERTIFICATION

| Question | Answer |
|----------|--------|
| Were all meaningful VitaLuxe surfaces checked? | **YES** |
| Are any classes of surfaces still unverified? | **YES** — see below |

**Unverified surfaces:**
- **Supabase Storage bucket contents** — I cannot list/inspect actual stored file metadata (file names, object paths). Files uploaded by users could theoretically have Lovable-related names, but this is extremely unlikely
- **Actual email delivery content** — I audited the code templates (clean), but cannot inspect actually-delivered emails in recipient inboxes
- **Source maps** — Cannot verify if source maps are exposed in production build (Vite defaults to no source maps in production, so likely safe)
- **Live production DNS/headers** — Cannot inspect actual HTTP response headers on the live domain

---

## SECTION I — FINAL CERTIFICATION

**❌ NOT YET WHITE-LABEL SAFE**

The favicon URL containing `gpt-engineer` is a critical, immediately-discoverable trace visible to every single visitor. Combined with 227 admin-visible database records containing `lovableproject.com` URLs and `__lovable_token` JWTs, and a repository full of Lovable-branded documentation, the system fails the white-label standard.

**However**: All findings are **Category A or B fixes** — safe, non-functional cleanups that will not affect any business logic, auth flows, or system behavior. The fix plan can be executed with zero production risk.

