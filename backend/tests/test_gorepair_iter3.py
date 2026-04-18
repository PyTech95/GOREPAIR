"""Iteration 3 tests: Razorpay mock, GPS, bulk import, notifications."""
import io
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@gorepair.in", "password": "admin123"}
MGR_DELHI = {"email": "rahul.manager@gorepair.in", "password": "manager123"}
MGR_MUMBAI = {"email": "priya.manager@gorepair.in", "password": "manager123"}
TECH_DELHI = {"email": "amit.tech@gorepair.in", "password": "tech123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    d = r.json()
    return d["token"], d["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def tokens():
    a_t, a_u = _login(ADMIN)
    m_t, m_u = _login(MGR_DELHI)
    m2_t, m2_u = _login(MGR_MUMBAI)
    t_t, t_u = _login(TECH_DELHI)
    return {"admin": (a_t, a_u), "mgr": (m_t, m_u), "mgr2": (m2_t, m2_u), "tech": (t_t, t_u)}


# ---------------- Razorpay (mock mode) ----------------
class TestRazorpay:
    def test_config_manager_mock(self, tokens):
        tok, _ = tokens["mgr"]
        r = requests.get(f"{API}/wallet/razorpay/config", headers=_h(tok))
        assert r.status_code == 200
        d = r.json()
        assert d["mode"] == "mock"
        assert d["key_id"] == ""

    def test_config_admin_blocked(self, tokens):
        tok, _ = tokens["admin"]
        r = requests.get(f"{API}/wallet/razorpay/config", headers=_h(tok))
        assert r.status_code == 403

    def test_config_technician_blocked(self, tokens):
        tok, _ = tokens["tech"]
        r = requests.get(f"{API}/wallet/razorpay/config", headers=_h(tok))
        assert r.status_code == 403

    def test_create_order_manager_mock(self, tokens):
        tok, _ = tokens["mgr"]
        r = requests.post(f"{API}/wallet/razorpay/create-order",
                          headers=_h(tok), json={"amount_inr": 2500})
        assert r.status_code == 200
        d = r.json()
        assert d["mode"] == "mock"
        assert d["order"]["id"].startswith("order_MOCK_")
        assert d["order"]["amount"] == 250000
        assert d["order"]["currency"] == "INR"

    def test_create_order_admin_blocked(self, tokens):
        tok, _ = tokens["admin"]
        r = requests.post(f"{API}/wallet/razorpay/create-order",
                          headers=_h(tok), json={"amount_inr": 1000})
        assert r.status_code == 403

    def test_create_order_tech_blocked(self, tokens):
        tok, _ = tokens["tech"]
        r = requests.post(f"{API}/wallet/razorpay/create-order",
                          headers=_h(tok), json={"amount_inr": 1000})
        assert r.status_code == 403

    def test_verify_credits_wallet(self, tokens):
        tok, _ = tokens["mgr"]
        # Get starting balance
        w = requests.get(f"{API}/wallet/me", headers=_h(tok)).json()
        before = float(w.get("balance", 0))

        amt = 1500
        payload = {
            "razorpay_order_id": f"order_MOCK_{uuid.uuid4().hex[:12]}",
            "razorpay_payment_id": f"pay_MOCK_{uuid.uuid4().hex[:12]}",
            "amount_inr": amt,
        }
        r = requests.post(f"{API}/wallet/razorpay/verify", headers=_h(tok), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["mode"] == "mock"
        assert d["txn"]["type"] == "recharge"
        assert float(d["txn"]["points"]) == float(amt)

        # Verify wallet increment
        w2 = requests.get(f"{API}/wallet/me", headers=_h(tok)).json()
        after = float(w2.get("balance", 0))
        assert round(after - before, 2) == float(amt), f"Expected +{amt}, got {after - before}"

        # Transaction exists in ledger
        txns = requests.get(f"{API}/wallet/transactions", headers=_h(tok)).json()
        assert any(t.get("type") == "recharge" and
                   payload["razorpay_order_id"] in (t.get("reason") or "")
                   for t in txns)

    def test_verify_tech_blocked(self, tokens):
        tok, _ = tokens["tech"]
        r = requests.post(f"{API}/wallet/razorpay/verify", headers=_h(tok),
                          json={"razorpay_order_id": "x", "razorpay_payment_id": "y", "amount_inr": 100})
        assert r.status_code == 403


# ---------------- GPS / Live tracking ----------------
class TestGPS:
    def test_tech_push_location(self, tokens):
        tok, _ = tokens["tech"]
        r = requests.post(f"{API}/technicians/me/location", headers=_h(tok),
                          json={"lat": 28.6139, "lng": 77.2090, "accuracy": 15.0})
        assert r.status_code == 200
        d = r.json()
        assert d["lat"] == 28.6139 and d["lng"] == 77.2090
        assert "updated_at" in d

    def test_manager_cannot_push_location(self, tokens):
        tok, _ = tokens["mgr"]
        r = requests.post(f"{API}/technicians/me/location", headers=_h(tok),
                          json={"lat": 1.0, "lng": 2.0})
        assert r.status_code == 403

    def test_admin_cannot_push_location(self, tokens):
        tok, _ = tokens["admin"]
        r = requests.post(f"{API}/technicians/me/location", headers=_h(tok),
                          json={"lat": 1.0, "lng": 2.0})
        assert r.status_code == 403

    def test_admin_list_locations(self, tokens):
        tok, _ = tokens["admin"]
        r = requests.get(f"{API}/technicians/locations", headers=_h(tok))
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) >= 1
        # Tech who pushed should have location
        amit = next((t for t in arr if t.get("name", "").startswith("Amit")), None)
        assert amit is not None
        assert amit["location"]["lat"] == 28.6139

    def test_manager_list_locations_scoped(self, tokens):
        tok, u = tokens["mgr"]
        r = requests.get(f"{API}/technicians/locations", headers=_h(tok))
        assert r.status_code == 200
        arr = r.json()
        # Manager sees only their own technicians - all should be scoped
        assert isinstance(arr, list)

    def test_technician_list_locations_blocked(self, tokens):
        tok, _ = tokens["tech"]
        r = requests.get(f"{API}/technicians/locations", headers=_h(tok))
        assert r.status_code == 403


# ---------------- Bulk CSV import ----------------
class TestBulkImport:
    def _upload(self, tok, csv_text, filename="leads.csv"):
        files = {"file": (filename, io.BytesIO(csv_text.encode("utf-8")), "text/csv")}
        return requests.post(f"{API}/leads/bulk-import", headers=_h(tok), files=files)

    def test_headered_csv_success(self, tokens):
        tok, _ = tokens["admin"]
        uniq = uuid.uuid4().hex[:6]
        csv_text = (
            "customer_name,phone,city,address,appliance_type,issue,priority,source\n"
            f"TEST_{uniq}_A,+91-9000000001,Delhi,Addr1,AC,Not cooling,high,website\n"
            f"TEST_{uniq}_B,+91-9000000002,Mumbai,Addr2,Fridge,Leaking,medium,google\n"
        )
        r = self._upload(tok, csv_text)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created"] == 2
        assert d["skipped"] == 0

    def test_headerless_csv_success(self, tokens):
        tok, _ = tokens["admin"]
        uniq = uuid.uuid4().hex[:6]
        csv_text = (
            f"TEST_{uniq}_C,+91-9000000003,Delhi,Addr3,TV,No power,low,manual\n"
        )
        r = self._upload(tok, csv_text)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["created"] == 1

    def test_malformed_rows_skipped(self, tokens):
        tok, _ = tokens["admin"]
        uniq = uuid.uuid4().hex[:6]
        csv_text = (
            "customer_name,phone,city,address,appliance_type,issue,priority,source\n"
            f"TEST_{uniq}_D,+91-9000000004,Delhi,Addr,AC,Issue,high,website\n"
            ",,,,,,,\n"  # all empty - continues (not counted)
            "OnlyName,,,,,,,\n"  # missing phone/city - skipped
        )
        r = self._upload(tok, csv_text)
        assert r.status_code == 200
        d = r.json()
        assert d["created"] == 1
        assert d["skipped"] >= 1

    def test_non_admin_blocked(self, tokens):
        tok, _ = tokens["mgr"]
        r = self._upload(tok, "x,y,z\n")
        assert r.status_code == 403

    def test_tech_blocked(self, tokens):
        tok, _ = tokens["tech"]
        r = self._upload(tok, "x,y,z\n")
        assert r.status_code == 403


# ---------------- Notifications ----------------
class TestNotifications:
    def test_list_manager_notifications(self, tokens):
        tok, _ = tokens["mgr"]
        r = requests.get(f"{API}/notifications", headers=_h(tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_assignment_notifications_triggered(self, tokens):
        admin_tok, _ = tokens["admin"]
        mgr_tok, mgr_u = tokens["mgr"]

        # Top up manager wallet so debit doesn't fail
        requests.post(f"{API}/wallet/razorpay/verify", headers=_h(mgr_tok), json={
            "razorpay_order_id": f"order_MOCK_{uuid.uuid4().hex[:8]}",
            "razorpay_payment_id": f"pay_MOCK_{uuid.uuid4().hex[:8]}",
            "amount_inr": 2000,
        })

        # Create lead via admin
        lead_payload = {
            "customer_name": f"TEST_N_{uuid.uuid4().hex[:6]}",
            "phone": "+91-9000099999",
            "city": "Delhi",
            "address": "Test Address",
            "appliance_type": "AC",
            "issue": "Notification test",
            "priority": "medium",
            "source": "manual",
        }
        r = requests.post(f"{API}/leads", headers=_h(admin_tok), json=lead_payload)
        assert r.status_code in (200, 201), r.text
        lead = r.json()
        lead_id = lead["id"]

        # Assign manager - should trigger lead_assigned_manager
        r = requests.post(f"{API}/leads/{lead_id}/assign-manager",
                          headers=_h(admin_tok), json={"manager_id": mgr_u["id"]})
        assert r.status_code in (200, 201), r.text

        # Manager-scoped notifications should include lead_assigned_manager for this lead
        notifs = requests.get(f"{API}/notifications", headers=_h(mgr_tok)).json()
        tpls = [n.get("template") for n in notifs if n.get("lead_id") == lead_id]
        assert "lead_assigned_manager" in tpls, f"Expected lead_assigned_manager, got {tpls}"

        # Assign technician (as manager)
        techs = requests.get(f"{API}/users?role=technician",
                             headers=_h(mgr_tok)).json()
        # Filter to manager's techs (Delhi)
        amit = next((t for t in techs if t.get("email") == TECH_DELHI["email"]), None)
        assert amit is not None, "Amit technician not found"

        r = requests.post(f"{API}/leads/{lead_id}/assign-technician",
                          headers=_h(mgr_tok), json={"technician_id": amit["id"]})
        assert r.status_code in (200, 201), r.text

        # Verify technician gets a notification
        tech_tok, _ = tokens["tech"]
        tnotifs = requests.get(f"{API}/notifications", headers=_h(tech_tok)).json()
        ttpls = [n.get("template") for n in tnotifs if n.get("lead_id") == lead_id]
        assert "lead_assigned_technician" in ttpls, f"Expected lead_assigned_technician, got {ttpls}"

        # Status change to completed (as technician)
        r = requests.post(f"{API}/leads/{lead_id}/status",
                          headers=_h(tech_tok),
                          json={"status": "completed", "final_cost": 1500})
        assert r.status_code in (200, 201), r.text

        # lead_completed_customer notification should exist (customer phone = to)
        # Fetch using admin (super_admin sees all)
        admin_notifs = requests.get(f"{API}/notifications", headers=_h(admin_tok)).json()
        comp = [n for n in admin_notifs
                if n.get("lead_id") == lead_id and n.get("template") == "lead_completed_customer"]
        assert len(comp) >= 1, f"Expected lead_completed_customer for lead {lead_id}"
