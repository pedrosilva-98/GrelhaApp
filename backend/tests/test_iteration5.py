"""Iteration 5 backend tests: change-password, admin reset-password, duplicate turma, rename turma, bulk alunos."""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://assessment-grid-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "passilva2005@gmail.com"
ADMIN_PW = "!grelhaadmin2005!"


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    return r


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    r = _login(ADMIN_EMAIL, ADMIN_PW)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def teacher_a(admin_token):
    """Create a fresh teacher A, yield {id,email,password,token}, cleanup at end."""
    email = f"TEST_it5a_{uuid.uuid4().hex[:8]}@t.pt"
    pw = "orig1234"
    body = {"email": email, "password": pw, "nome": "TEST A"}
    r = requests.post(f"{API}/admin/teachers", json=body, headers=_auth(admin_token))
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    lr = _login(email, pw)
    assert lr.status_code == 200
    t = {"id": tid, "email": email, "password": pw, "token": lr.json()["access_token"]}
    yield t
    requests.delete(f"{API}/admin/teachers/{tid}", headers=_auth(admin_token))


@pytest.fixture(scope="module")
def teacher_b(admin_token):
    email = f"TEST_it5b_{uuid.uuid4().hex[:8]}@t.pt"
    pw = "orig1234"
    body = {"email": email, "password": pw, "nome": "TEST B"}
    r = requests.post(f"{API}/admin/teachers", json=body, headers=_auth(admin_token))
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    lr = _login(email, pw)
    t = {"id": tid, "email": email, "password": pw, "token": lr.json()["access_token"]}
    yield t
    requests.delete(f"{API}/admin/teachers/{tid}", headers=_auth(admin_token))


# ── change-password ──
class TestChangePassword:
    def test_wrong_current(self, teacher_a):
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": "wrong", "new_password": "newpass1"},
                          headers=_auth(teacher_a["token"]))
        assert r.status_code == 400
        assert "atual" in r.json()["detail"].lower()

    def test_short_new(self, teacher_a):
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": teacher_a["password"], "new_password": "abc"},
                          headers=_auth(teacher_a["token"]))
        assert r.status_code == 400

    def test_success_and_new_login(self, teacher_a):
        new_pw = "newpass1"
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": teacher_a["password"], "new_password": new_pw},
                          headers=_auth(teacher_a["token"]))
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # old fails
        assert _login(teacher_a["email"], teacher_a["password"]).status_code == 401
        # new works
        lr = _login(teacher_a["email"], new_pw)
        assert lr.status_code == 200
        # update fixture state so later tests still authenticate
        teacher_a["password"] = new_pw
        teacher_a["token"] = lr.json()["access_token"]


# ── admin reset ──
class TestAdminReset:
    def test_non_admin_forbidden(self, teacher_a):
        r = requests.post(f"{API}/admin/teachers/{teacher_a['id']}/reset-password",
                          json={"new_password": "hacker1"},
                          headers=_auth(teacher_a["token"]))
        assert r.status_code == 403

    def test_nonexistent_teacher(self, admin_token):
        r = requests.post(f"{API}/admin/teachers/{uuid.uuid4()}/reset-password",
                          json={"new_password": "whatever"},
                          headers=_auth(admin_token))
        assert r.status_code == 404

    def test_reset_success_and_login(self, admin_token, teacher_b):
        new_pw = "resetted9"
        r = requests.post(f"{API}/admin/teachers/{teacher_b['id']}/reset-password",
                          json={"new_password": new_pw},
                          headers=_auth(admin_token))
        assert r.status_code == 200
        assert _login(teacher_b["email"], teacher_b["password"]).status_code == 401
        lr = _login(teacher_b["email"], new_pw)
        assert lr.status_code == 200
        teacher_b["password"] = new_pw
        teacher_b["token"] = lr.json()["access_token"]


# ── duplicate turma ──
class TestDuplicateTurma:
    def test_duplicate_deep_copy(self, teacher_a):
        # create turma
        cr = requests.post(f"{API}/turmas",
                           json={"disciplina": "Mat", "ano": "6º", "turma": "A"},
                           headers=_auth(teacher_a["token"]))
        assert cr.status_code == 200
        turma = cr.json()
        # customize dominios
        new_doms = [
            {"code": "X", "nome": "X-nome", "peso": 60},
            {"code": "Y", "nome": "Y-nome", "peso": 40},
        ]
        dr = requests.put(f"{API}/turmas/{turma['id']}/dominios",
                          json={"dominios": new_doms}, headers=_auth(teacher_a["token"]))
        assert dr.status_code == 200
        # add aluno + instrumento (should NOT be copied)
        requests.post(f"{API}/alunos", json={"nome": "Al 1"},
                      params={"turma_id": turma["id"]}, headers=_auth(teacher_a["token"]))
        requests.post(f"{API}/instrumentos",
                      json={"nome": "T1", "tipo": "teste", "data": "",
                            "questoes": [{"id": "q1", "dom": "X", "cotacao": 10}]},
                      params={"turma_id": turma["id"]}, headers=_auth(teacher_a["token"]))

        # duplicate
        dr = requests.post(f"{API}/turmas/{turma['id']}/duplicate",
                           headers=_auth(teacher_a["token"]))
        assert dr.status_code == 200
        dup = dr.json()
        assert dup["id"] != turma["id"]
        assert dup["disciplina"] == "Mat"
        assert dup["ano"] == "6º"
        assert dup["turma"] == "A (cópia)"
        # deep copy dominios
        assert {d["code"] for d in dup["dominios"]} == {"X", "Y"}
        # mutating source shouldn't affect dup (we verify via separate list fetch)
        # alunos and instrumentos NOT copied
        a = requests.get(f"{API}/alunos", params={"turma_id": dup["id"]},
                        headers=_auth(teacher_a["token"]))
        assert a.status_code == 200 and a.json() == []
        i = requests.get(f"{API}/instrumentos", params={"turma_id": dup["id"]},
                        headers=_auth(teacher_a["token"]))
        assert i.status_code == 200 and i.json() == []
        teacher_a.setdefault("_turmas", []).extend([turma["id"], dup["id"]])

    def test_duplicate_cross_teacher_404(self, teacher_a, teacher_b):
        # A creates a turma
        cr = requests.post(f"{API}/turmas",
                           json={"disciplina": "P", "ano": "7º", "turma": "B"},
                           headers=_auth(teacher_a["token"]))
        assert cr.status_code == 200
        tid = cr.json()["id"]
        # B tries to duplicate A's turma
        r = requests.post(f"{API}/turmas/{tid}/duplicate",
                          headers=_auth(teacher_b["token"]))
        assert r.status_code == 404
        teacher_a.setdefault("_turmas", []).append(tid)


# ── rename turma ──
class TestRenameTurma:
    def test_rename_preserves_dominios(self, teacher_a):
        cr = requests.post(f"{API}/turmas",
                           json={"disciplina": "His", "ano": "5º", "turma": "C"},
                           headers=_auth(teacher_a["token"]))
        tid = cr.json()["id"]
        # customize dominios
        doms = [{"code": "AA", "nome": "N1", "peso": 100}]
        requests.put(f"{API}/turmas/{tid}/dominios", json={"dominios": doms},
                     headers=_auth(teacher_a["token"]))
        # rename
        ur = requests.put(f"{API}/turmas/{tid}",
                          json={"disciplina": "História", "ano": "5º", "turma": "Z"},
                          headers=_auth(teacher_a["token"]))
        assert ur.status_code == 200
        data = ur.json()
        assert data["disciplina"] == "História"
        assert data["turma"] == "Z"
        # dominios preserved
        assert data["dominios"][0]["code"] == "AA"
        teacher_a.setdefault("_turmas", []).append(tid)

    def test_rename_cross_teacher_404(self, teacher_a, teacher_b):
        cr = requests.post(f"{API}/turmas",
                           json={"disciplina": "X", "ano": "8º", "turma": "D"},
                           headers=_auth(teacher_a["token"]))
        tid = cr.json()["id"]
        r = requests.put(f"{API}/turmas/{tid}", json={"turma": "E"},
                         headers=_auth(teacher_b["token"]))
        assert r.status_code == 404
        teacher_a.setdefault("_turmas", []).append(tid)


# ── bulk alunos ──
class TestBulkAlunos:
    @pytest.fixture(scope="class")
    def turma(self, teacher_a):
        cr = requests.post(f"{API}/turmas",
                           json={"disciplina": "Bulk", "ano": "9º", "turma": "K"},
                           headers=_auth(teacher_a["token"]))
        assert cr.status_code == 200
        tid = cr.json()["id"]
        teacher_a.setdefault("_turmas", []).append(tid)
        return tid

    def test_bulk_inserts(self, teacher_a, turma):
        r = requests.post(f"{API}/alunos/bulk",
                          json={"nomes": ["Ana", "Bruno", "Carla"]},
                          params={"turma_id": turma},
                          headers=_auth(teacher_a["token"]))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["inserted"] == 3
        assert len(data["alunos"]) == 3
        names = {a["nome"] for a in data["alunos"]}
        assert names == {"Ana", "Bruno", "Carla"}
        # verify persisted
        g = requests.get(f"{API}/alunos", params={"turma_id": turma},
                         headers=_auth(teacher_a["token"]))
        assert {a["nome"] for a in g.json()} >= {"Ana", "Bruno", "Carla"}

    def test_bulk_empty(self, teacher_a, turma):
        r = requests.post(f"{API}/alunos/bulk", json={"nomes": []},
                          params={"turma_id": turma},
                          headers=_auth(teacher_a["token"]))
        assert r.status_code == 200
        assert r.json()["inserted"] == 0

    def test_bulk_strips_whitespace_and_empty(self, teacher_a, turma):
        r = requests.post(f"{API}/alunos/bulk",
                          json={"nomes": ["  ", "", "Diogo"]},
                          params={"turma_id": turma},
                          headers=_auth(teacher_a["token"]))
        assert r.status_code == 200
        assert r.json()["inserted"] == 1

    def test_bulk_cross_teacher_404(self, teacher_b, turma):
        r = requests.post(f"{API}/alunos/bulk", json={"nomes": ["X"]},
                          params={"turma_id": turma},
                          headers=_auth(teacher_b["token"]))
        assert r.status_code == 404


# Cleanup: delete any turmas we created (fixtures collected them into teacher_a._turmas)
@pytest.fixture(scope="module", autouse=True)
def _cleanup_turmas(teacher_a, request):
    yield
    for tid in teacher_a.get("_turmas", []):
        requests.delete(f"{API}/turmas/{tid}", headers=_auth(teacher_a["token"]))
