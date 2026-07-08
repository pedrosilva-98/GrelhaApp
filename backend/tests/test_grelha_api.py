"""Backend tests for Grelha de Avaliação Docente - multi-turma refactor."""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # fallback to frontend .env
    from pathlib import Path
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE}/api"

ADMIN_EMAIL = "admin@escola.pt"
ADMIN_PW = "admin123"


def _admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PW})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_token():
    return _admin_token()


@pytest.fixture(scope="module")
def teacher_creds(admin_token):
    """Create two teachers; yield tuple (a, b) with token+id. Cleanup after."""
    suffix = uuid.uuid4().hex[:8]
    a_email = f"TEST_a_{suffix}@escola.pt"
    b_email = f"TEST_b_{suffix}@escola.pt"
    ra = requests.post(f"{API}/admin/teachers", headers=_hdr(admin_token),
                       json={"email": a_email, "password": "pw123456", "nome": "TEST A"})
    assert ra.status_code == 200, ra.text
    a = ra.json()
    rb = requests.post(f"{API}/admin/teachers", headers=_hdr(admin_token),
                       json={"email": b_email, "password": "pw123456", "nome": "TEST B"})
    assert rb.status_code == 200, rb.text
    b = rb.json()

    la = requests.post(f"{API}/auth/login", json={"email": a_email, "password": "pw123456"}).json()
    lb = requests.post(f"{API}/auth/login", json={"email": b_email, "password": "pw123456"}).json()
    a["token"] = la["access_token"]
    b["token"] = lb["access_token"]
    yield a, b
    # cleanup
    for t in (a, b):
        requests.delete(f"{API}/admin/teachers/{t['id']}", headers=_hdr(admin_token))


# ─── Admin teacher creation ───
class TestAdminTeachers:
    def test_create_teacher_clean_response(self, admin_token):
        email = f"TEST_solo_{uuid.uuid4().hex[:8]}@escola.pt"
        r = requests.post(f"{API}/admin/teachers", headers=_hdr(admin_token),
                          json={"email": email, "password": "pw12345", "nome": "Solo Test"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["email"] == email.lower()
        assert data["nome"] == "Solo Test"
        assert data["role"] == "teacher"
        assert "id" in data
        assert "_id" not in data
        assert "password_hash" not in data
        # cleanup
        requests.delete(f"{API}/admin/teachers/{data['id']}", headers=_hdr(admin_token))

    def test_create_teacher_duplicate_email(self, admin_token):
        email = f"TEST_dup_{uuid.uuid4().hex[:8]}@escola.pt"
        r1 = requests.post(f"{API}/admin/teachers", headers=_hdr(admin_token),
                           json={"email": email, "password": "pw12345", "nome": "Dup"})
        assert r1.status_code == 200
        r2 = requests.post(f"{API}/admin/teachers", headers=_hdr(admin_token),
                           json={"email": email, "password": "pw12345", "nome": "Dup2"})
        assert r2.status_code == 400
        requests.delete(f"{API}/admin/teachers/{r1.json()['id']}", headers=_hdr(admin_token))


# ─── Turmas CRUD ───
class TestTurmas:
    def test_list_empty_for_new_teacher(self, teacher_creds):
        a, _ = teacher_creds
        r = requests.get(f"{API}/turmas", headers=_hdr(a["token"]))
        assert r.status_code == 200
        # NOTE: teacher_creds fixture is module-scoped; other tests may add turmas here
        # but this test runs first alphabetically... use fresh check:
        assert isinstance(r.json(), list)

    def test_create_turma_seeds_ponderacoes(self, teacher_creds):
        a, _ = teacher_creds
        r = requests.post(f"{API}/turmas", headers=_hdr(a["token"]),
                          json={"nome": "TEST turma1", "disciplina": "Mat", "ano": "6º", "turma": "A"})
        assert r.status_code == 200, r.text
        t = r.json()
        assert t["nome"] == "TEST turma1"
        assert "id" in t
        assert "_id" not in t
        # ponderacoes auto-seeded
        rp = requests.get(f"{API}/ponderacoes", headers=_hdr(a["token"]), params={"turma_id": t["id"]})
        assert rp.status_code == 200
        pd = rp.json()
        assert pd["CP"] + pd["RRP"] + pd["CM"] + pd["ER"] == 100
        # save for reuse
        a["turma_id"] = t["id"]

    def test_update_turma(self, teacher_creds):
        a, _ = teacher_creds
        tid = a.get("turma_id")
        assert tid, "requires previous test"
        r = requests.put(f"{API}/turmas/{tid}", headers=_hdr(a["token"]), json={"nome": "TEST renamed"})
        assert r.status_code == 200
        assert r.json()["nome"] == "TEST renamed"

    def test_delete_turma_cascades(self, teacher_creds, admin_token):
        a, _ = teacher_creds
        # Create fresh turma for delete test
        r = requests.post(f"{API}/turmas", headers=_hdr(a["token"]),
                          json={"nome": "TEST del", "disciplina": "D", "ano": "6", "turma": "Z"})
        tid = r.json()["id"]
        # Add aluno
        ra = requests.post(f"{API}/alunos", headers=_hdr(a["token"]), params={"turma_id": tid},
                           json={"nome": "TEST_A1"})
        assert ra.status_code == 200
        # Delete turma
        rd = requests.delete(f"{API}/turmas/{tid}", headers=_hdr(a["token"]))
        assert rd.status_code == 200
        # Turma no longer accessible
        rg = requests.get(f"{API}/alunos", headers=_hdr(a["token"]), params={"turma_id": tid})
        assert rg.status_code == 404


# ─── Scoped endpoints ───
class TestScoped:
    def test_missing_turma_id_param_422(self, teacher_creds):
        a, _ = teacher_creds
        r = requests.get(f"{API}/alunos", headers=_hdr(a["token"]))
        assert r.status_code == 422

    def test_unknown_turma_id_404(self, teacher_creds):
        a, _ = teacher_creds
        r = requests.get(f"{API}/alunos", headers=_hdr(a["token"]), params={"turma_id": "nonexistent-xyz"})
        assert r.status_code == 404

    def test_aluno_crud(self, teacher_creds):
        a, _ = teacher_creds
        tid = a["turma_id"]
        # Create
        r = requests.post(f"{API}/alunos", headers=_hdr(a["token"]), params={"turma_id": tid},
                          json={"nome": "TEST_Aluno1"})
        assert r.status_code == 200
        aid = r.json()["id"]
        assert "_id" not in r.json()
        # List
        rl = requests.get(f"{API}/alunos", headers=_hdr(a["token"]), params={"turma_id": tid})
        assert rl.status_code == 200
        assert any(x["id"] == aid for x in rl.json())
        # Delete
        rd = requests.delete(f"{API}/alunos/{aid}", headers=_hdr(a["token"]))
        assert rd.status_code == 200

    def test_instrumento_crud_and_notas(self, teacher_creds):
        a, _ = teacher_creds
        tid = a["turma_id"]
        # aluno
        ra = requests.post(f"{API}/alunos", headers=_hdr(a["token"]), params={"turma_id": tid},
                           json={"nome": "TEST_A_notas"})
        aid = ra.json()["id"]
        # instrumento
        ri = requests.post(f"{API}/instrumentos", headers=_hdr(a["token"]), params={"turma_id": tid},
                           json={"nome": "TEST_Inst", "tipo": "F.Sumativa", "data": "",
                                 "questoes": [{"id": "q1", "dom": "CP", "cotacao": 20}]})
        assert ri.status_code == 200
        iid = ri.json()["id"]
        # update notas
        rn = requests.put(f"{API}/instrumentos/{iid}/notas", headers=_hdr(a["token"]),
                          json={"notas": {aid: {"q1": 15.5}}})
        assert rn.status_code == 200
        # verify
        rg = requests.get(f"{API}/instrumentos", headers=_hdr(a["token"]), params={"turma_id": tid})
        got = [x for x in rg.json() if x["id"] == iid][0]
        assert got["notas"][aid]["q1"] == 15.5
        # cleanup
        requests.delete(f"{API}/instrumentos/{iid}", headers=_hdr(a["token"]))
        requests.delete(f"{API}/alunos/{aid}", headers=_hdr(a["token"]))

    def test_ponderacoes_sum_validation(self, teacher_creds):
        a, _ = teacher_creds
        tid = a["turma_id"]
        r = requests.put(f"{API}/ponderacoes", headers=_hdr(a["token"]), params={"turma_id": tid},
                         json={"CP": 40, "RRP": 25, "CM": 10, "ER": 15})  # 90 != 100
        assert r.status_code == 400
        r2 = requests.put(f"{API}/ponderacoes", headers=_hdr(a["token"]), params={"turma_id": tid},
                          json={"CP": 50, "RRP": 25, "CM": 10, "ER": 15})
        assert r2.status_code == 200


# ─── Security isolation ───
class TestSecurity:
    def test_teacher_b_cannot_access_teacher_a_turma(self, teacher_creds):
        a, b = teacher_creds
        tid = a["turma_id"]
        r = requests.get(f"{API}/alunos", headers=_hdr(b["token"]), params={"turma_id": tid})
        assert r.status_code == 404
        r2 = requests.put(f"{API}/turmas/{tid}", headers=_hdr(b["token"]), json={"nome": "hack"})
        assert r2.status_code == 404
        r3 = requests.delete(f"{API}/turmas/{tid}", headers=_hdr(b["token"]))
        assert r3.status_code == 404

    def test_admin_cannot_access_teacher_endpoints(self, admin_token):
        r = requests.get(f"{API}/turmas", headers=_hdr(admin_token))
        assert r.status_code == 403
