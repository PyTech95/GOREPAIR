# GO Repair CRM — Product Requirements Document (Living)

## Original problem statement
Build a scalable SaaS CRM platform for a home appliance repair service company in India (inspired by Go Repairs / Urban Company). Hierarchical multi-role system: Super Admin, Managers, Technicians. Lead distribution engine with prepaid points-based wallet. Includes lead management, assignment workflow, wallet/points economy, cost-per-lead config, technician job tracking, analytics dashboard, AI smart-assign, brand-kit purchase for new managers, recharge (mocked + Razorpay later), JWT auth.

## User personas
- **Super Admin** — runs the company. Onboards managers, sets cost per lead, tops up wallets, creates leads, monitors everything.
- **Manager** — runs a city/territory. Holds a points wallet, receives leads from admin (debited from wallet), dispatches them to technicians, buys brand-kit items, views ROI.
- **Technician** — field worker. Sees assigned jobs, updates status, logs notes, marks completion.

## Architecture
- **Backend** FastAPI + Motor (MongoDB). Single `server.py`. JWT (Bearer header) auth. emergentintegrations + Claude Sonnet 4.5 for AI dispatch.
- **Frontend** React 19 + React Router v7 + Tailwind. Swiss-brutalist aesthetic (Cabinet Grotesk + Chivo, Signal Orange #FF5F1F + Obsidian Black).
- **Collections** users, leads, transactions, brand_kit_orders, settings.

## Added (Feb 2026 — v1.2)
- **Razorpay wallet recharge** — `GET /api/wallet/razorpay/config`, `POST /api/wallet/razorpay/create-order`, `POST /api/wallet/razorpay/verify`. Operates in **MOCK mode** when `RAZORPAY_KEY_ID` is empty (credits wallet directly with order-amount cross-check), **LIVE mode** when keys are populated (uses razorpay-python SDK, opens checkout.razorpay.com modal, verifies HMAC signature).
- **WhatsApp/SMS notifications (MOCKED)** — new `notifications` collection + `send_notification()` helper triggered by assign-manager, assign-technician, and status-change events. Templates: lead_assigned_manager, lead_assigned_technician, lead_status_customer, lead_completed_customer. `/api/notifications` endpoint + `/notifications` UI page show history. Swap to Twilio/Gupshup by replacing the helper body.
- **Live GPS tracking** — `POST /api/technicians/me/location` (technician pushes coords every 60s via browser Geolocation); `GET /api/technicians/locations` (admin/manager see team with last-known position + freshness). `/map` page uses **Leaflet + OpenStreetMap** (no API key). Technician view shows a toggle-only screen; admin/manager view shows interactive map with orange CircleMarker pins + team side panel.
- **Bulk CSV lead import** — `POST /api/leads/bulk-import` (admin) multipart CSV upload, 5 MB cap, headered or headerless, defaults `priority=medium`/`source=manual` for missing values. UI: "Import CSV" button on Leads page → drop-zone dialog → shows created/skipped + errors inline.
- **Security hardening** — Razorpay mock-mode verify now cross-checks amount against the original order to prevent client tampering.

### Notes on environment
- Google Maps JS key provided by user but **not used** due to `InvalidKey` error (needs Maps JavaScript API enabled in Google Cloud). Leaflet+OSM is a zero-key permanent alternative; to switch back, enable the API in Cloud Console and we can flip with a ~30-line change.
- RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are empty strings in backend/.env. Populate them (test-mode starts `rzp_test_…`) to flip Razorpay to LIVE — no code change required.

## Implemented (Feb 2026 — MVP v1)
- JWT auth (login, /auth/me) with bcrypt; seeded super admin + 2 managers + 3 technicians + 5 demo leads
- Role-based middleware (`require_roles`); strict scoping (manager sees own leads/techs, technician sees own jobs)
- Leads CRUD with manual creation, source tagging (website/facebook/google/whatsapp/manual/referral/justdial), priority
- Two-step assignment workflow: Admin → Manager (debits cost-per-lead) → Technician
- Status machine: new → assigned_manager → assigned_technician → in_progress → completed; cancelled/invalid (invalid = 80% wallet refund)
- Lead notes timeline + customer rating (auto-recomputes technician avg)
- Points wallet with full ledger (credit/debit/refund/recharge/brand_kit), per-manager isolation
- Mocked recharge endpoint (₹1 = 1 point) + admin manual credit/debit
- Brand Kit store (5 SKUs: T-shirts, Bill Book, ID Cards, Tool Pouch, Flyers) — points-based checkout
- Settings: cost-per-lead, welcome-bonus
- Analytics: total/new/in-progress/completed/cancelled, conversion %, revenue, points spent, by-source breakdown, technician leaderboard
- AI Smart-Assign — Claude Sonnet 4.5 returns ranked technician suggestions with reasoning; heuristic fallback if LLM fails
- Frontend: 9 pages (Login, Dashboard, Leads list, Lead detail, Users, Wallet, Brand Kit, Analytics, Settings, My Jobs), responsive sidebar layout, sonner toasts, recharts bar chart
- 28/28 backend pytest tests passing; full E2E flows verified

## Added (Feb 2026 — v1.1)
- **GST invoice PDF** — GET `/api/leads/{id}/invoice` generates A4 PDF via reportlab with CGST/SGST split (9%+9%), customer + technician block, line items, GO Repair brand colours. Available only when lead is `completed` with `final_cost`.
- **Job photo uploads** — POST `/api/leads/{id}/attachments` multipart upload (jpg/png/webp/gif/heic, 8 MB cap). Served under `/api/uploads/{filename}` via FastAPI StaticFiles mount. Technicians & managers can attach; grid gallery shown on lead detail page.
- **Brand logo** — Integrated the 3D gear-and-wrench logo uploaded by the user into login page hero and sidebar.

## Backlog
### P0 (next iteration if requested)
- Swap Razorpay MOCK → LIVE once user provides `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`
- Swap notifications MOCK → Twilio or Gupshup for real SMS/WhatsApp delivery

### P1
- Live GPS tracking for technicians (background location push)
- AI auto-assign on lead capture (skip manager for select rules)
- Subscription plans for managers (monthly lead allowance)
- Bulk lead import (CSV upload)
- JustDial / IndiaMART webhook ingestion
- Call masking (Exotel / Knowlarity)

### P2
- Customer-facing booking widget
- Franchise hierarchy (Region → City → Manager)
- Lead marketplace mode (managers bid for unassigned leads)
- Voice-to-text job notes (Whisper)
- Mobile PWA with offline-sync for technicians

## Known limitations
- Wallet debit + lead update are not transactional — for MVP only
- No rate-limiting on /auth/login
- No upper-bound validation on recharge amount

## Test credentials
See `/app/memory/test_credentials.md`.
