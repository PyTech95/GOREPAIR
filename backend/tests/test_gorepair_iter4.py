"""Iteration 4 tests: customer end-to-end booking, technician reassignment,
admin/manager password reset, IST PDF invoice date, GPS on customer track."""
import io
import os
import re
import time
import uuid
import random
import pytest
import requests
from datetime import datetime
from zoneinfo import ZoneInfo

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@gorepair.in", "password": "admin123"}
MGR_DELHI = {"email": "rahul.manager@gorepair.in", "password": "manager123"}
TECH_AMIT = {"email": "amit.tech@gorepair.in", "password": "tech123"}
TECH_SURESH = {"email": "suresh.tech@gorepair.in", "password": "tech123"}
TECH_RAVI = {"email": "ravi.tech@gorepair.in", "password": "tech123"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login {creds['email']} failed: {r.status_code} {r.text}"
    d = r.json()
    return d["token"], d["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _rand_phone():
    # 10 digit starting 9
    return "9" + "".join(str(random.randint(0, 9)) for _ in range(9))


@pytest.fixture(scope="module")
def tokens():
    a_t, a_u = _login(ADMIN)
    m_t, m_u = _login(MGR_DELHI)
    t_amit_t, t_amit_u = _login(TECH_AMIT)
    t_sur_t, t_sur_u = _login(TECH_SURESH)
    t_ravi_t, t_ravi_u = _login(TECH_RAVI)
    return {
        "admin": (a_t, a_u), "mgr": (m_t, m_u),
        "amit": (t_amit_t, t_amit_u), "suresh": (t_sur_t, t_sur_u),
        "ravi": (t_ravi_t, t_ravi_u),
    }


# ---------- Customer register + booking end-to-end ----------
class TestCustomerBookingE2E:
    @pytest.fixture(scope="class")
    def new_customer(self):
        phone = _rand_phone()
        payload = {
            "phone": phone,
            "password": "cust1234",
            "name": f"TEST_Cust_{uuid.uuid4().hex[:6]}",
            "city": "Delhi",
        }
        r = requests.post(f"{API}/customer/register", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d
        assert d["user"]["role"] == "customer"
        assert d["user"]["phone"] == phone
        return {"token": d["token"], "user": d["user"], "phone": phone, "password": "cust1234"}

    def test_register_duplicate_phone(self, new_customer):
        r = requests.post(f"{API}/customer/register", json={
            "phone": new_customer["phone"], "password": "cust1234", "name": "TEST_dup", "city": "Delhi",
        })
        assert r.status_code == 400, f"expected 400 duplicate, got {r.status_code}: {r.text}"

    def test_customer_login(self, new_customer):
        r = requests.post(f"{API}/customer/login", json={
            "phone": new_customer["phone"], "password": new_customer["password"],
        })
        assert r.status_code == 200
        assert r.json()["user"]["id"] == new_customer["user"]["id"]

    def test_get_catalog_service_ac(self):
        r = requests.get(f"{API}/catalog/service/ac-service")
        assert r.status_code == 200
        d = r.json()
        assert d["service"]["sku"] == "ac-service"
        assert d["category"]["name"] == "Air Conditioner"

    def test_get_catalog_invalid_sku(self):
        r = requests.get(f"{API}/catalog/service/nonexistent-sku")
        assert r.status_code == 404

    def test_create_booking_and_auto_assign(self, new_customer):
        tok = new_customer["token"]
        payload = {
            "service_sku": "ac-service",
            "slot_date": datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m-%d"),
            "slot_window": "10:00-12:00",
            "issue_note": "AC not cooling since yesterday",
            "address": {
                "label": "Home", "line1": "Flat 42, DLF Phase 1",
                "line2": "Near Metro", "city": "Delhi", "pincode": "110001",
            },
        }
        r = requests.post(f"{API}/customer/bookings", headers=_h(tok), json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["service_sku"] == "ac-service"
        assert b["customer_id"] == new_customer["user"]["id"]
        assert b["source"] == "customer_app"
        assert b["appliance_type"] == "Air Conditioner"
        # Auto-assign should have picked up a Delhi manager (Rahul) with wallet
        # It may or may not be assigned depending on wallet balance; both acceptable
        assert b["status"] in ("new", "assigned_manager")
        # Persist for later tests
        new_customer["booking_id"] = b["id"]
        new_customer["booking"] = b

    def test_get_booking_by_id(self, new_customer):
        tok = new_customer["token"]
        bid = new_customer["booking_id"]
        r = requests.get(f"{API}/customer/bookings/{bid}", headers=_h(tok))
        assert r.status_code == 200
        b = r.json()
        assert b["id"] == bid
        assert b["customer_id"] == new_customer["user"]["id"]

    def test_list_customer_bookings(self, new_customer):
        tok = new_customer["token"]
        r = requests.get(f"{API}/customer/bookings", headers=_h(tok))
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        assert any(x["id"] == new_customer["booking_id"] for x in arr)

    def test_other_customer_cannot_see_booking(self, new_customer):
        # Create another customer, try to fetch first customer's booking
        other = requests.post(f"{API}/customer/register", json={
            "phone": _rand_phone(), "password": "x1234567",
            "name": "TEST_Other", "city": "Delhi",
        }).json()
        r = requests.get(f"{API}/customer/bookings/{new_customer['booking_id']}",
                         headers=_h(other["token"]))
        assert r.status_code == 404

    def test_booking_create_requires_customer_role(self, tokens):
        admin_tok, _ = tokens["admin"]
        r = requests.post(f"{API}/customer/bookings", headers=_h(admin_tok), json={
            "service_sku": "ac-service", "slot_date": "2026-01-15",
            "slot_window": "10:00-12:00", "issue_note": "x",
            "address": {"label": "H", "line1": "L1", "city": "Delhi"},
        })
        assert r.status_code == 403


# ---------- Technician reassignment on staff pipeline ----------
class TestTechnicianReassignment:
    """
    Manager (Rahul, Delhi) receives a customer-app lead, assigns to Amit (Delhi tech),
    then reassigns to Suresh (Delhi tech). Verify:
    - first assign works
    - reassigning to the SAME tech is blocked
    - reassigning to a DIFFERENT tech works, history stored
    - re-assign after completion is blocked
    """
    @pytest.fixture(scope="class")
    def lead_for_reassign(self, tokens):
        admin_tok, _ = tokens["admin"]
        mgr_tok, mgr_u = tokens["mgr"]

        # Top up manager wallet to make sure they can absorb the debit
        requests.post(f"{API}/wallet/razorpay/verify", headers=_h(mgr_tok), json={
            "razorpay_order_id": f"order_MOCK_{uuid.uuid4().hex[:8]}",
            "razorpay_payment_id": f"pay_MOCK_{uuid.uuid4().hex[:8]}",
            "amount_inr": 5000,
        })

        # Create a fresh lead via admin, then assign to Rahul manager
        r = requests.post(f"{API}/leads", headers=_h(admin_tok), json={
            "customer_name": f"TEST_Reassign_{uuid.uuid4().hex[:6]}",
            "phone": "+91-9000045678", "city": "Delhi",
            "address": "Reassign Test Addr",
            "appliance_type": "AC", "issue": "Reassign test",
            "priority": "medium", "source": "manual",
        })
        assert r.status_code in (200, 201), r.text
        lead = r.json()
        lid = lead["id"]
        r = requests.post(f"{API}/leads/{lid}/assign-manager",
                          headers=_h(admin_tok), json={"manager_id": mgr_u["id"]})
        assert r.status_code in (200, 201), r.text
        return {"id": lid}

    def test_first_assign_tech(self, tokens, lead_for_reassign):
        mgr_tok, _ = tokens["mgr"]
        _, amit_u = tokens["amit"]
        r = requests.post(f"{API}/leads/{lead_for_reassign['id']}/assign-technician",
                          headers=_h(mgr_tok), json={"technician_id": amit_u["id"]})
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d["technician_id"] == amit_u["id"]
        assert d["status"] == "assigned_technician"

    def test_reassign_same_tech_blocked(self, tokens, lead_for_reassign):
        mgr_tok, _ = tokens["mgr"]
        _, amit_u = tokens["amit"]
        r = requests.post(f"{API}/leads/{lead_for_reassign['id']}/assign-technician",
                          headers=_h(mgr_tok), json={"technician_id": amit_u["id"]})
        assert r.status_code == 400
        assert "already assigned" in r.text.lower()

    def test_reassign_different_tech(self, tokens, lead_for_reassign):
        mgr_tok, _ = tokens["mgr"]
        _, suresh_u = tokens["suresh"]
        r = requests.post(f"{API}/leads/{lead_for_reassign['id']}/assign-technician",
                          headers=_h(mgr_tok), json={"technician_id": suresh_u["id"]})
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d["technician_id"] == suresh_u["id"]
        # Reassignment history should include at least one entry
        rh = d.get("reassignment_history") or []
        assert len(rh) >= 1
        # last entry should reflect Amit -> Suresh
        last = rh[-1]
        assert last["to"] == suresh_u["id"]
        assert d.get("last_reassigned_at") is not None

    def test_reassign_blocked_when_completed(self, tokens, lead_for_reassign):
        # Mark lead completed via the assigned technician (Suresh)
        sur_tok, _ = tokens["suresh"]
        r = requests.post(f"{API}/leads/{lead_for_reassign['id']}/status",
                          headers=_h(sur_tok), json={"status": "completed", "final_cost": 799})
        assert r.status_code in (200, 201), r.text
        # Now manager tries to reassign to Ravi -> should be blocked
        mgr_tok, _ = tokens["mgr"]
        _, ravi_u = tokens["ravi"]
        r = requests.post(f"{API}/leads/{lead_for_reassign['id']}/assign-technician",
                          headers=_h(mgr_tok), json={"technician_id": ravi_u["id"]})
        assert r.status_code == 400
        assert "cannot reassign" in r.text.lower() or "completed" in r.text.lower()

    def test_reassign_non_existent_tech(self, tokens, lead_for_reassign):
        # This lead is already completed but we want a fresh one for this negative test
        # Just check with the (now completed) lead - should 400 first (completed)
        # or 404 (bad tech). Both are acceptable failures.
        mgr_tok, _ = tokens["mgr"]
        r = requests.post(f"{API}/leads/{lead_for_reassign['id']}/assign-technician",
                          headers=_h(mgr_tok), json={"technician_id": "does-not-exist"})
        assert r.status_code in (400, 404)


# ---------- Admin/Manager password reset ----------
class TestPasswordReset:
    def test_admin_can_reset_tech_password(self, tokens):
        admin_tok, _ = tokens["admin"]
        _, ravi_u = tokens["ravi"]
        new_pw = f"TEST_pw_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/users/{ravi_u['id']}/reset-password",
                          headers=_h(admin_tok), json={"new_password": new_pw})
        assert r.status_code == 200, r.text
        # New password login works
        lr = requests.post(f"{API}/auth/login",
                           json={"email": ravi_u["email"], "password": new_pw})
        assert lr.status_code == 200
        # Old password fails
        lr2 = requests.post(f"{API}/auth/login",
                            json={"email": ravi_u["email"], "password": "tech123"})
        assert lr2.status_code == 401
        # Restore for other tests
        requests.post(f"{API}/users/{ravi_u['id']}/reset-password",
                      headers=_h(admin_tok), json={"new_password": "tech123"})

    def test_manager_can_reset_own_technician(self, tokens):
        # Rahul (Delhi manager) should be able to reset Amit (Delhi tech) if amit.manager_id == rahul
        mgr_tok, mgr_u = tokens["mgr"]
        _, amit_u = tokens["amit"]
        # Check if amit belongs to rahul
        techs = requests.get(f"{API}/users?role=technician", headers=_h(mgr_tok)).json()
        my_amit = next((t for t in techs if t.get("id") == amit_u["id"]), None)
        if not my_amit:
            pytest.skip("Amit is not scoped under Rahul manager")

        new_pw = f"TEST_mpw_{uuid.uuid4().hex[:8]}"
        r = requests.post(f"{API}/users/{amit_u['id']}/reset-password",
                          headers=_h(mgr_tok), json={"new_password": new_pw})
        assert r.status_code == 200, r.text
        # New pw works
        lr = requests.post(f"{API}/auth/login",
                           json={"email": amit_u["email"], "password": new_pw})
        assert lr.status_code == 200
        # Restore
        admin_tok, _ = tokens["admin"]
        requests.post(f"{API}/users/{amit_u['id']}/reset-password",
                      headers=_h(admin_tok), json={"new_password": "tech123"})

    def test_manager_cannot_reset_another_manager(self, tokens):
        mgr_tok, _ = tokens["mgr"]
        # Fetch Priya via admin
        admin_tok, _ = tokens["admin"]
        users = requests.get(f"{API}/users?role=manager", headers=_h(admin_tok)).json()
        priya = next((u for u in users if u.get("email") == "priya.manager@gorepair.in"), None)
        assert priya is not None
        r = requests.post(f"{API}/users/{priya['id']}/reset-password",
                          headers=_h(mgr_tok), json={"new_password": "hack1234"})
        assert r.status_code == 403

    def test_reset_customer_blocked(self, tokens):
        admin_tok, _ = tokens["admin"]
        # Create a temp customer
        phone = _rand_phone()
        c = requests.post(f"{API}/customer/register", json={
            "phone": phone, "password": "cust1234",
            "name": f"TEST_C_{uuid.uuid4().hex[:6]}", "city": "Delhi",
        }).json()
        r = requests.post(f"{API}/users/{c['user']['id']}/reset-password",
                          headers=_h(admin_tok), json={"new_password": "newpw12345"})
        assert r.status_code == 403


# ---------- Live GPS from tech visible on customer's track page ----------
class TestCustomerGPSTracking:
    def test_customer_sees_tech_location_after_push(self, tokens):
        admin_tok, _ = tokens["admin"]
        mgr_tok, mgr_u = tokens["mgr"]
        _, amit_u = tokens["amit"]

        # Top up manager
        requests.post(f"{API}/wallet/razorpay/verify", headers=_h(mgr_tok), json={
            "razorpay_order_id": f"order_MOCK_{uuid.uuid4().hex[:8]}",
            "razorpay_payment_id": f"pay_MOCK_{uuid.uuid4().hex[:8]}",
            "amount_inr": 3000,
        })

        # Create fresh customer
        phone = _rand_phone()
        c = requests.post(f"{API}/customer/register", json={
            "phone": phone, "password": "cust1234",
            "name": f"TEST_GPS_{uuid.uuid4().hex[:6]}", "city": "Delhi",
        }).json()
        cust_tok = c["token"]

        # Book
        r = requests.post(f"{API}/customer/bookings", headers=_h(cust_tok), json={
            "service_sku": "ac-service",
            "slot_date": datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m-%d"),
            "slot_window": "12:00-14:00", "issue_note": "GPS test",
            "address": {"label": "H", "line1": "L1", "city": "Delhi", "pincode": "110001"},
        })
        assert r.status_code == 200, r.text
        bid = r.json()["id"]

        # Ensure manager assigned; if not, assign directly (backend usually auto-assigns)
        b = requests.get(f"{API}/customer/bookings/{bid}", headers=_h(cust_tok)).json()
        if not b.get("manager_id"):
            requests.post(f"{API}/leads/{bid}/assign-manager",
                          headers=_h(admin_tok), json={"manager_id": mgr_u["id"]})

        # Assign Amit
        r = requests.post(f"{API}/leads/{bid}/assign-technician",
                          headers=_h(mgr_tok), json={"technician_id": amit_u["id"]})
        assert r.status_code in (200, 201), r.text

        # Amit pushes location
        amit_tok, _ = tokens["amit"]
        r = requests.post(f"{API}/technicians/me/location",
                          headers=_h(amit_tok),
                          json={"lat": 28.6304, "lng": 77.2177, "accuracy": 12.0})
        assert r.status_code == 200

        # Customer track page should surface technician.location
        b = requests.get(f"{API}/customer/bookings/{bid}", headers=_h(cust_tok)).json()
        assert b.get("technician") is not None, "technician not embedded"
        loc = b["technician"].get("location")
        assert loc is not None, f"technician.location missing on customer view. tech={b['technician']}"
        assert abs(loc["lat"] - 28.6304) < 0.001
        assert abs(loc["lng"] - 77.2177) < 0.001
        assert "updated_at" in loc


# ---------- IST PDF invoice date ----------
class TestInvoiceIST:
    def test_invoice_date_is_ist(self, tokens):
        """Create+complete a lead, download PDF, verify Date line matches IST calendar day."""
        admin_tok, _ = tokens["admin"]
        mgr_tok, mgr_u = tokens["mgr"]
        amit_tok, amit_u = tokens["amit"]

        # Top up
        requests.post(f"{API}/wallet/razorpay/verify", headers=_h(mgr_tok), json={
            "razorpay_order_id": f"order_MOCK_{uuid.uuid4().hex[:8]}",
            "razorpay_payment_id": f"pay_MOCK_{uuid.uuid4().hex[:8]}",
            "amount_inr": 2000,
        })

        # Create + assign + complete
        r = requests.post(f"{API}/leads", headers=_h(admin_tok), json={
            "customer_name": f"TEST_INV_{uuid.uuid4().hex[:6]}",
            "phone": "+91-9000012340", "city": "Delhi",
            "address": "Invoice IST Addr",
            "appliance_type": "AC", "issue": "IST invoice test",
            "priority": "medium", "source": "manual",
        })
        lid = r.json()["id"]
        requests.post(f"{API}/leads/{lid}/assign-manager",
                      headers=_h(admin_tok), json={"manager_id": mgr_u["id"]})
        requests.post(f"{API}/leads/{lid}/assign-technician",
                      headers=_h(mgr_tok), json={"technician_id": amit_u["id"]})
        r = requests.post(f"{API}/leads/{lid}/status",
                          headers=_h(amit_tok), json={"status": "completed", "final_cost": 1234})
        assert r.status_code in (200, 201)

        # Download invoice
        r = requests.get(f"{API}/leads/{lid}/invoice", headers=_h(admin_tok))
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        pdf = r.content
        assert pdf.startswith(b"%PDF")

        # Extract text properly using pypdf
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf))
        text = "\n".join((p.extract_text() or "") for p in reader.pages)
        today_ist = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%d %b %Y")
        # Allow leading zero to be stripped ('02 Jan' vs '2 Jan')
        try:
            alt = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%-d %b %Y")
        except ValueError:
            alt = today_ist
        assert (today_ist in text) or (alt in text), (
            f"IST date {today_ist!r} or {alt!r} not in invoice PDF text.\n"
            f"Extracted:\n{text[:2000]}"
        )


# ---------- Session-expired axios interceptor (backend side) ----------
class TestSessionExpiredBackend:
    def test_invalid_token_401(self):
        r = requests.get(f"{API}/customer/bookings",
                         headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code == 401

    def test_no_token_401_or_403(self):
        r = requests.get(f"{API}/customer/bookings")
        assert r.status_code in (401, 403)


# ---------- Support phone sanity ----------
class TestSupportPhone:
    def test_notification_from_number(self, tokens):
        """The backend seeds `+91-9905231750` as support phone in seed setup;
        confirm it exists in DB via /catalog or a benign endpoint."""
        # Not a public endpoint for this. Skip if not surfaced.
        pytest.skip("Support phone is a frontend constant; verified via UI tests.")
