"""Backend API tests for GO Repair CRM."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://points-repair-net.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@gorepair.in", "password": "admin123"}
MGR_DELHI = {"email": "rahul.manager@gorepair.in", "password": "manager123"}
MGR_MUMBAI = {"email": "priya.manager@gorepair.in", "password": "manager123"}
TECH_DELHI = {"email": "amit.tech@gorepair.in", "password": "tech123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def tokens():
    a_t, a_u = _login(ADMIN)
    m_t, m_u = _login(MGR_DELHI)
    m2_t, m2_u = _login(MGR_MUMBAI)
    t_t, t_u = _login(TECH_DELHI)
    return {
        "admin": (a_t, a_u),
        "mgr": (m_t, m_u),
        "mgr2": (m2_t, m2_u),
        "tech": (t_t, t_u),
    }


# ---------------- Auth ----------------
class TestAuth:
    def test_login_admin(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN)
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and "user" in d
        assert d["user"]["role"] == "super_admin"
        assert "password_hash" not in d["user"]
        assert "_id" not in d["user"]

    def test_login_manager(self):
        r = requests.post(f"{API}/auth/login", json=MGR_DELHI)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "manager"

    def test_login_tech(self):
        r = requests.post(f"{API}/auth/login", json=TECH_DELHI)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "technician"

    def test_login_bad(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@gorepair.in", "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, tokens):
        t, _ = tokens["admin"]
        r = requests.get(f"{API}/auth/me", headers=_auth(t))
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN["email"]
        assert "password_hash" not in u


# ---------------- RBAC ----------------
class TestRBAC:
    def test_manager_cannot_create_lead(self, tokens):
        t, _ = tokens["mgr"]
        r = requests.post(f"{API}/leads", headers=_auth(t), json={
            "customer_name": "X", "phone": "1", "city": "Delhi",
            "appliance_type": "AC", "issue": "x",
        })
        assert r.status_code == 403

    def test_tech_cannot_list_users(self, tokens):
        t, _ = tokens["tech"]
        r = requests.get(f"{API}/users", headers=_auth(t))
        assert r.status_code == 403

    def test_manager_cannot_update_settings(self, tokens):
        t, _ = tokens["mgr"]
        r = requests.put(f"{API}/settings", headers=_auth(t), json={"cost_per_lead": 200})
        assert r.status_code == 403


# ---------------- Lead full flow ----------------
class TestLeadFlow:
    created = {}

    def test_admin_create_lead(self, tokens):
        t, _ = tokens["admin"]
        payload = {
            "customer_name": "TEST_Customer", "phone": "9999999999",
            "address": "Test Addr", "city": "Delhi",
            "appliance_type": "AC", "issue": "Not cooling",
            "priority": "high", "source": "manual",
        }
        r = requests.post(f"{API}/leads", headers=_auth(t), json=payload)
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["status"] == "new"
        assert lead["customer_name"] == "TEST_Customer"
        assert "_id" not in lead
        TestLeadFlow.created["lead_id"] = lead["id"]

    def test_list_leads_admin(self, tokens):
        t, _ = tokens["admin"]
        r = requests.get(f"{API}/leads", headers=_auth(t))
        assert r.status_code == 200
        arr = r.json()
        assert any(l["id"] == TestLeadFlow.created["lead_id"] for l in arr)

    def test_filter_leads_by_status(self, tokens):
        t, _ = tokens["admin"]
        r = requests.get(f"{API}/leads?status=new", headers=_auth(t))
        assert r.status_code == 200
        for l in r.json():
            assert l["status"] == "new"

    def test_assign_manager_deducts_wallet(self, tokens):
        admin_t, _ = tokens["admin"]
        mgr_t, mgr_u = tokens["mgr"]
        # Get wallet before
        r0 = requests.get(f"{API}/wallet/me", headers=_auth(mgr_t))
        assert r0.status_code == 200
        before = r0.json()["balance"]

        # Get cost per lead
        rs = requests.get(f"{API}/settings", headers=_auth(admin_t))
        cost = rs.json().get("cost_per_lead", 200)

        lid = TestLeadFlow.created["lead_id"]
        r = requests.post(f"{API}/leads/{lid}/assign-manager", headers=_auth(admin_t),
                          json={"manager_id": mgr_u["id"]})
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["status"] == "assigned_manager"
        assert lead["manager_id"] == mgr_u["id"]
        assert lead["cost_points"] == cost

        # Wallet after
        r2 = requests.get(f"{API}/wallet/me", headers=_auth(mgr_t))
        after = r2.json()["balance"]
        assert after == before - cost

        # Debit transaction exists
        rt = requests.get(f"{API}/wallet/transactions", headers=_auth(mgr_t))
        assert rt.status_code == 200
        txns = rt.json()
        assert any(x["type"] == "debit" and x["lead_id"] == lid for x in txns)

    def test_assign_technician(self, tokens):
        mgr_t, _ = tokens["mgr"]
        # Find a delhi technician owned by this manager
        r = requests.get(f"{API}/users?role=technician", headers=_auth(mgr_t))
        assert r.status_code == 200
        techs = r.json()
        assert techs, "No technicians found for manager"
        tech_id = techs[0]["id"]

        lid = TestLeadFlow.created["lead_id"]
        r2 = requests.post(f"{API}/leads/{lid}/assign-technician", headers=_auth(mgr_t),
                           json={"technician_id": tech_id})
        assert r2.status_code == 200, r2.text
        lead = r2.json()
        assert lead["technician_id"] == tech_id
        assert lead["status"] == "assigned_technician"
        TestLeadFlow.created["tech_id"] = tech_id

    def test_tech_updates_status_completed(self, tokens):
        # login as the assigned technician (amit = Delhi manager's)
        tech_t, tech_u = tokens["tech"]
        lid = TestLeadFlow.created["lead_id"]
        # Get jobs before
        r0 = requests.get(f"{API}/auth/me", headers=_auth(tech_t))
        jobs_before = r0.json().get("jobs_completed", 0) or 0

        # only assigned technician can update; if not the one, assign to amit
        if TestLeadFlow.created.get("tech_id") != tech_u["id"]:
            mgr_t, _ = tokens["mgr"]
            requests.post(f"{API}/leads/{lid}/assign-technician", headers=_auth(mgr_t),
                          json={"technician_id": tech_u["id"]})

        r = requests.post(f"{API}/leads/{lid}/status", headers=_auth(tech_t),
                          json={"status": "completed", "final_cost": 1500, "note": "Fixed"})
        assert r.status_code == 200, r.text
        lead = r.json()
        assert lead["status"] == "completed"
        assert lead["final_cost"] == 1500

        r2 = requests.get(f"{API}/auth/me", headers=_auth(tech_t))
        jobs_after = r2.json().get("jobs_completed", 0) or 0
        assert jobs_after == jobs_before + 1

    def test_add_note(self, tokens):
        mgr_t, _ = tokens["mgr"]
        lid = TestLeadFlow.created["lead_id"]
        r = requests.post(f"{API}/leads/{lid}/notes", headers=_auth(mgr_t),
                          json={"text": "TEST_note"})
        assert r.status_code == 200
        rg = requests.get(f"{API}/leads/{lid}", headers=_auth(mgr_t))
        notes = rg.json().get("notes", [])
        assert any(n["text"] == "TEST_note" for n in notes)

    def test_rating_updates_tech_avg(self, tokens):
        mgr_t, _ = tokens["mgr"]
        lid = TestLeadFlow.created["lead_id"]
        r = requests.post(f"{API}/leads/{lid}/rating", headers=_auth(mgr_t),
                          json={"stars": 5, "comment": "great"})
        assert r.status_code == 200
        assert r.json()["rating"] == 5

    def test_ai_suggest(self, tokens):
        admin_t, _ = tokens["admin"]
        # create a fresh lead
        r = requests.post(f"{API}/leads", headers=_auth(admin_t), json={
            "customer_name": "TEST_AI", "phone": "1", "city": "Delhi",
            "appliance_type": "AC", "issue": "ac not cool",
        })
        lid = r.json()["id"]
        r2 = requests.post(f"{API}/leads/{lid}/ai-suggest", headers=_auth(admin_t), timeout=60)
        assert r2.status_code == 200, r2.text
        d = r2.json()
        assert "suggestions" in d
        assert isinstance(d["suggestions"], list)

    def test_invalid_refund(self, tokens):
        admin_t, _ = tokens["admin"]
        mgr_t, mgr_u = tokens["mgr"]
        # create and assign
        r = requests.post(f"{API}/leads", headers=_auth(admin_t), json={
            "customer_name": "TEST_Invalid", "phone": "1", "city": "Delhi",
            "appliance_type": "AC", "issue": "bogus",
        })
        lid = r.json()["id"]
        rs = requests.get(f"{API}/settings", headers=_auth(admin_t))
        cost = rs.json().get("cost_per_lead", 200)
        requests.post(f"{API}/leads/{lid}/assign-manager", headers=_auth(admin_t),
                      json={"manager_id": mgr_u["id"]})
        bal_before = requests.get(f"{API}/wallet/me", headers=_auth(mgr_t)).json()["balance"]
        # mark invalid
        r2 = requests.post(f"{API}/leads/{lid}/status", headers=_auth(mgr_t),
                           json={"status": "invalid", "note": "duplicate"})
        assert r2.status_code == 200
        bal_after = requests.get(f"{API}/wallet/me", headers=_auth(mgr_t)).json()["balance"]
        refund = int(cost * 0.8)
        assert bal_after == bal_before + refund


# ---------------- Wallet ----------------
class TestWallet:
    def test_wallet_me_manager(self, tokens):
        t, _ = tokens["mgr"]
        r = requests.get(f"{API}/wallet/me", headers=_auth(t))
        assert r.status_code == 200
        assert "balance" in r.json()

    def test_wallet_recharge(self, tokens):
        t, _ = tokens["mgr"]
        before = requests.get(f"{API}/wallet/me", headers=_auth(t)).json()["balance"]
        r = requests.post(f"{API}/wallet/recharge", headers=_auth(t), json={"amount_inr": 500})
        assert r.status_code == 200
        assert r.json()["mode"] == "mock"
        after = requests.get(f"{API}/wallet/me", headers=_auth(t)).json()["balance"]
        assert after == before + 500

    def test_wallet_credit_admin(self, tokens):
        admin_t, _ = tokens["admin"]
        mgr_t, mgr_u = tokens["mgr2"]
        before = requests.get(f"{API}/wallet/me", headers=_auth(mgr_t)).json()["balance"]
        r = requests.post(f"{API}/wallet/credit", headers=_auth(admin_t),
                          json={"manager_id": mgr_u["id"], "points": 100, "reason": "TEST"})
        assert r.status_code == 200
        after = requests.get(f"{API}/wallet/me", headers=_auth(mgr_t)).json()["balance"]
        assert after == before + 100

    def test_manager_only_sees_own_txns(self, tokens):
        m1_t, m1_u = tokens["mgr"]
        r = requests.get(f"{API}/wallet/transactions", headers=_auth(m1_t))
        assert r.status_code == 200
        for tx in r.json():
            assert tx["manager_id"] == m1_u["id"]


# ---------------- Brand Kit ----------------
class TestBrandKit:
    def test_list_items(self, tokens):
        t, _ = tokens["mgr"]
        r = requests.get(f"{API}/brand-kit/items", headers=_auth(t))
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 5
        assert all("sku" in i and "price_points" in i for i in items)

    def test_order(self, tokens):
        mgr_t, mgr_u = tokens["mgr"]
        # ensure wallet balance
        requests.post(f"{API}/wallet/recharge", headers=_auth(mgr_t), json={"amount_inr": 1000})
        before = requests.get(f"{API}/wallet/me", headers=_auth(mgr_t)).json()["balance"]
        r = requests.post(f"{API}/brand-kit/order", headers=_auth(mgr_t),
                          json={"items": [{"sku": "flyers", "qty": 1}]})
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["total_points"] == 250
        after = requests.get(f"{API}/wallet/me", headers=_auth(mgr_t)).json()["balance"]
        assert after == before - 250
        rl = requests.get(f"{API}/brand-kit/orders", headers=_auth(mgr_t))
        assert any(o["id"] == order["id"] for o in rl.json())


# ---------------- Analytics & Settings ----------------
class TestAnalytics:
    def test_overview_admin(self, tokens):
        t, _ = tokens["admin"]
        r = requests.get(f"{API}/analytics/overview", headers=_auth(t))
        assert r.status_code == 200
        d = r.json()
        for k in ("total_leads", "completed", "conversion_rate", "sources"):
            assert k in d

    def test_technicians_leaderboard(self, tokens):
        t, _ = tokens["admin"]
        r = requests.get(f"{API}/analytics/technicians", headers=_auth(t))
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)

    def test_settings_get_put(self, tokens):
        t, _ = tokens["admin"]
        r = requests.get(f"{API}/settings", headers=_auth(t))
        assert r.status_code == 200
        original = r.json().get("cost_per_lead", 200)
        r2 = requests.put(f"{API}/settings", headers=_auth(t), json={"cost_per_lead": 250})
        assert r2.status_code == 200
        assert r2.json()["cost_per_lead"] == 250
        # restore
        requests.put(f"{API}/settings", headers=_auth(t), json={"cost_per_lead": original})
