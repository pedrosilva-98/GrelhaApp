"""Iteration 4 tests: new admin creds, turma dominios, instrumento edit, ponderacoes removed."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://assessment-grid-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "passilva2005@gmail.com"
ADMIN_PASSWORD = "!grelhaadmin2005!"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="session")
def teacher_creds(admin_token):
    email = f"TEST_it4_{uuid.uuid4().hex[:8]}@teste.pt"
    password = "prof12345"
    h = {"Authorization": f"Bearer {admin_token}"}
    r = requests.post(f"{API}/admin/teachers", headers=h,
                      json={"email": email, "password": password, "nome": "TEST Prof It4"})
    assert r.status_code == 200, r.text
    teacher = r.json()
    yield {"email": email, "password": password, "id": teacher["id"]}
    # cleanup
    requests.delete(f"{API}/admin/teachers/{teacher['id']}", headers=h)


@pytest.fixture(scope="session")
def teacher_token(teacher_creds):
    r = requests.post(f"{API}/auth/login", json={"email": teacher_creds["email"], "password": teacher_creds["password"]})
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture()
def th(teacher_token):
    return {"Authorization": f"Bearer {teacher_token}"}


# ─── AUTH ────────────────────────────────────────────────────────────────────

def test_new_admin_login_ok():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    d = r.json()
    assert d["user"]["role"] == "admin"
    assert d["user"]["email"] == ADMIN_EMAIL
    assert "access_token" in d and len(d["access_token"]) > 20


def test_new_admin_wrong_password():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongpass"})
    assert r.status_code == 401


def test_old_admin_removed():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@escola.pt", "password": "admin123"})
    assert r.status_code == 401


# ─── PONDERACOES REMOVED ─────────────────────────────────────────────────────

def test_ponderacoes_endpoint_gone(teacher_token):
    h = {"Authorization": f"Bearer {teacher_token}"}
    r = requests.get(f"{API}/ponderacoes", headers=h, params={"turma_id": "any"})
    assert r.status_code == 404, f"expected 404 got {r.status_code}: {r.text}"
    r2 = requests.put(f"{API}/ponderacoes", headers=h, json={"CP": 50, "RRP": 25, "CM": 10, "ER": 15})
    assert r2.status_code == 404


# ─── TURMAS ──────────────────────────────────────────────────────────────────

def test_create_turma_no_nome_and_dominios_default(th):
    r = requests.post(f"{API}/turmas", headers=th,
                      json={"disciplina": "Matemática", "ano": "6º", "turma": "A"})
    assert r.status_code == 200, r.text
    t = r.json()
    assert t["disciplina"] == "Matemática"
    assert t["ano"] == "6º"
    assert t["turma"] == "A"
    assert "nome" not in t  # nome field should not exist
    assert "dominios" in t
    doms = t["dominios"]
    assert len(doms) == 4
    codes = {d["code"] for d in doms}
    assert codes == {"CP", "RRP", "CM", "ER"}
    pesos = {d["code"]: d["peso"] for d in doms}
    assert pesos == {"CP": 50, "RRP": 25, "CM": 10, "ER": 15}
    # GET list also returns dominios
    lst = requests.get(f"{API}/turmas", headers=th).json()
    assert any("dominios" in x and len(x["dominios"]) == 4 for x in lst)
    # cleanup
    requests.delete(f"{API}/turmas/{t['id']}", headers=th)


def test_create_turma_extra_nome_field_ignored(th):
    r = requests.post(f"{API}/turmas", headers=th,
                      json={"disciplina": "X", "ano": "5º", "turma": "B", "nome": "shouldbeignored"})
    # Pydantic default is to ignore extra fields (no Config extra=forbid), so 200 and no nome field
    assert r.status_code == 200
    body = r.json()
    assert body.get("nome") is None or "nome" not in body
    requests.delete(f"{API}/turmas/{body['id']}", headers=th)


# ─── DOMINIOS PUT ────────────────────────────────────────────────────────────

@pytest.fixture()
def turma_id(th):
    r = requests.post(f"{API}/turmas", headers=th,
                      json={"disciplina": "TEST_Mat", "ano": "6º", "turma": "Z"})
    tid = r.json()["id"]
    yield tid
    requests.delete(f"{API}/turmas/{tid}", headers=th)


def test_dominios_sum_not_100(th, turma_id):
    r = requests.put(f"{API}/turmas/{turma_id}/dominios", headers=th,
                     json={"dominios": [{"code": "CP", "nome": "x", "peso": 50}, {"code": "R", "nome": "y", "peso": 40}]})
    assert r.status_code == 400
    assert "100" in r.json()["detail"]


def test_dominios_duplicate_codes(th, turma_id):
    r = requests.put(f"{API}/turmas/{turma_id}/dominios", headers=th,
                     json={"dominios": [{"code": "CP", "nome": "a", "peso": 60}, {"code": "CP", "nome": "b", "peso": 40}]})
    assert r.status_code == 400
    assert "duplic" in r.json()["detail"].lower()


def test_dominios_empty_code(th, turma_id):
    r = requests.put(f"{API}/turmas/{turma_id}/dominios", headers=th,
                     json={"dominios": [{"code": "", "nome": "a", "peso": 50}, {"code": "R", "nome": "b", "peso": 50}]})
    assert r.status_code == 400


def test_dominios_rename_and_reweight_ok(th, turma_id):
    new = [
        {"code": "CP", "nome": "Concepts", "peso": 40},
        {"code": "RRP", "nome": "Raciocínio", "peso": 30},
        {"code": "CM", "nome": "Comunicação", "peso": 10},
        {"code": "ER", "nome": "Atitudes", "peso": 20},
    ]
    r = requests.put(f"{API}/turmas/{turma_id}/dominios", headers=th, json={"dominios": new})
    assert r.status_code == 200, r.text
    assert r.json()["dominios"] == new
    # Verify persisted
    lst = requests.get(f"{API}/turmas", headers=th).json()
    t = next(x for x in lst if x["id"] == turma_id)
    assert {d["nome"] for d in t["dominios"]} >= {"Atitudes", "Concepts"}


def test_dominios_add_new_and_remove_unreferenced(th, turma_id):
    new = [
        {"code": "CP", "nome": "CP", "peso": 40},
        {"code": "RRP", "nome": "RRP", "peso": 25},
        {"code": "CM", "nome": "CM", "peso": 10},
        {"code": "ER", "nome": "ER", "peso": 15},
        {"code": "ORG", "nome": "Organização", "peso": 10},
    ]
    r = requests.put(f"{API}/turmas/{turma_id}/dominios", headers=th, json={"dominios": new})
    assert r.status_code == 200
    # Now remove ORG (not referenced anywhere) — should succeed
    r2 = requests.put(f"{API}/turmas/{turma_id}/dominios", headers=th, json={"dominios": [
        {"code": "CP", "nome": "CP", "peso": 50},
        {"code": "RRP", "nome": "RRP", "peso": 25},
        {"code": "CM", "nome": "CM", "peso": 10},
        {"code": "ER", "nome": "ER", "peso": 15},
    ]})
    assert r2.status_code == 200


def test_cannot_remove_referenced_dominio(th, turma_id):
    # Add ORG
    requests.put(f"{API}/turmas/{turma_id}/dominios", headers=th, json={"dominios": [
        {"code": "CP", "nome": "CP", "peso": 40},
        {"code": "RRP", "nome": "RRP", "peso": 25},
        {"code": "CM", "nome": "CM", "peso": 10},
        {"code": "ER", "nome": "ER", "peso": 15},
        {"code": "ORG", "nome": "Organização", "peso": 10},
    ]})
    # Create instrumento using ORG
    inst = requests.post(f"{API}/instrumentos", headers=th, params={"turma_id": turma_id}, json={
        "nome": "Ficha X", "tipo": "ficha", "data": "2026-01-15",
        "questoes": [{"id": "q1", "dom": "ORG", "cotacao": 20}],
    })
    assert inst.status_code == 200, inst.text
    # Try to remove ORG — should 400
    r = requests.put(f"{API}/turmas/{turma_id}/dominios", headers=th, json={"dominios": [
        {"code": "CP", "nome": "CP", "peso": 50},
        {"code": "RRP", "nome": "RRP", "peso": 25},
        {"code": "CM", "nome": "CM", "peso": 10},
        {"code": "ER", "nome": "ER", "peso": 15},
    ]})
    assert r.status_code == 400
    assert "não é possível remover" in r.json()["detail"].lower() or "remover" in r.json()["detail"].lower()


# ─── INSTRUMENTOS ────────────────────────────────────────────────────────────

def test_instrumento_unknown_dom_400(th, turma_id):
    r = requests.post(f"{API}/instrumentos", headers=th, params={"turma_id": turma_id}, json={
        "nome": "F", "tipo": "ficha", "data": "",
        "questoes": [{"id": "q1", "dom": "XYZ", "cotacao": 10}],
    })
    assert r.status_code == 400
    assert "XYZ" in r.json()["detail"]


def test_instrumento_put_edit_and_trim_notas(th, turma_id):
    # Create aluno
    al = requests.post(f"{API}/alunos", headers=th, params={"turma_id": turma_id}, json={"nome": "TEST_Aluno"}).json()
    # Create instrumento with 2 questoes
    inst = requests.post(f"{API}/instrumentos", headers=th, params={"turma_id": turma_id}, json={
        "nome": "T1", "tipo": "teste", "data": "2026-01-10",
        "questoes": [
            {"id": "q1", "dom": "CP", "cotacao": 10},
            {"id": "q2", "dom": "RRP", "cotacao": 20},
        ],
    }).json()
    iid = inst["id"]
    # Set notas
    requests.put(f"{API}/instrumentos/{iid}/notas", headers=th,
                 json={"notas": {al["id"]: {"q1": 8, "q2": 6}}})
    # PUT edit: rename + drop q2
    r = requests.put(f"{API}/instrumentos/{iid}", headers=th, json={
        "nome": "T1-renamed",
        "questoes": [{"id": "q1", "dom": "CP", "cotacao": 10}],
    })
    assert r.status_code == 200, r.text
    updated = r.json()
    assert updated["nome"] == "T1-renamed"
    assert len(updated["questoes"]) == 1
    # Notas trimmed: only q1 remains
    assert updated["notas"][al["id"]] == {"q1": 8}


def test_instrumento_put_cross_teacher_404(th, turma_id, admin_token):
    # create instrumento owned by teacher_creds
    inst = requests.post(f"{API}/instrumentos", headers=th, params={"turma_id": turma_id}, json={
        "nome": "T", "tipo": "ficha", "data": "", "questoes": [{"id": "q1", "dom": "CP", "cotacao": 10}],
    }).json()
    # Create another teacher
    other_email = f"TEST_other_{uuid.uuid4().hex[:6]}@t.pt"
    ah = {"Authorization": f"Bearer {admin_token}"}
    other = requests.post(f"{API}/admin/teachers", headers=ah, json={"email": other_email, "password": "p12345", "nome": "Other"}).json()
    tok = requests.post(f"{API}/auth/login", json={"email": other_email, "password": "p12345"}).json()["access_token"]
    r = requests.put(f"{API}/instrumentos/{inst['id']}", headers={"Authorization": f"Bearer {tok}"}, json={"nome": "hijack"})
    assert r.status_code == 404
    requests.delete(f"{API}/admin/teachers/{other['id']}", headers=ah)


# ─── NOTAS: no scale limit ───────────────────────────────────────────────────

def test_notas_backend_accepts_any_number(th, turma_id):
    al = requests.post(f"{API}/alunos", headers=th, params={"turma_id": turma_id}, json={"nome": "A"}).json()
    inst = requests.post(f"{API}/instrumentos", headers=th, params={"turma_id": turma_id}, json={
        "nome": "I", "tipo": "ficha", "data": "", "questoes": [{"id": "q1", "dom": "CP", "cotacao": 20}],
    }).json()
    r = requests.put(f"{API}/instrumentos/{inst['id']}/notas", headers=th,
                     json={"notas": {al["id"]: {"q1": 8.5}}})
    assert r.status_code == 200
    # verify persisted
    got = requests.get(f"{API}/instrumentos", headers=th, params={"turma_id": turma_id}).json()
    assert got[0]["notas"][al["id"]]["q1"] == 8.5
