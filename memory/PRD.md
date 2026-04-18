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

## Backlog
### P0 (next iteration if requested)
- Razorpay live payment integration for /wallet/recharge (currently mocked)
- WhatsApp/SMS notification on lead assignment & status changes (Twilio or Gupshup)
- PDF invoice generation on completion (with GST)
- Image/video upload on technician notes (object storage)

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
