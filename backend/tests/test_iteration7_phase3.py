"""
Iteration 7 – Phase 3 backend tests for PUT /api/alunos/{aluno_id}.

Covers:
- Partial updates: nome, data_nascimento, n_processo
- medidas ({universais, adicionais, seletivas}) with empty-string trimming
- 404 on unknown aluno_id
- 403/404 when a foreign teacher tries to edit another teacher's aluno
- Regression sanity: notas endpoint still works after aluno update
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "passilva2005@gmail.com"
ADMIN_PWD = "!grelhaadmin2005!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _mk_teacher(admin_token, tag):
    email = f"phase3_it7_{tag}_{uuid.uuid4().hex[:6]}@teste.pt"
    pwd = "teste123"
    r = requests.post(
        f"{BASE_URL}/api/admin/teachers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"email": email, "password": pwd, "nome": f"P3 {tag}", "agrupamento": "AE"},
    )
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    login = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": email, "password": pwd})
    return {"id": tid, "email": email, "token": login.json()["access_token"]}


@pytest.fixture(scope="module")
def teacher_a(admin_token):
    t = _mk_teacher(admin_token, "A")
    yield t
    requests.delete(f"{BASE_URL}/api/admin/teachers/{t['id']}",
                    headers={"Authorization": f"Bearer {admin_token}"})


@pytest.fixture(scope="module")
def teacher_b(admin_token):
    t = _mk_teacher(admin_token, "B")
    yield t
    requests.delete(f"{BASE_URL}/api/admin/teachers/{t['id']}",
                    headers={"Authorization": f"Bearer {admin_token}"})


@pytest.fixture()
def ha(teacher_a):
    return {"Authorization": f"Bearer {teacher_a['token']}"}


@pytest.fixture()
def hb(teacher_b):
    return {"Authorization": f"Bearer {teacher_b['token']}"}


@pytest.fixture()
def turma_a(ha):
    r = requests.post(f"{BASE_URL}/api/turmas", headers=ha,
                      json={"disciplina": "Mat", "ano": "7", "turma": "A"})
    assert r.status_code == 200
    t = r.json()
    yield t
    requests.delete(f"{BASE_URL}/api/turmas/{t['id']}", headers=ha)


@pytest.fixture()
def aluno_a(ha, turma_a):
    r = requests.post(f"{BASE_URL}/api/alunos?turma_id={turma_a['id']}", headers=ha,
                      json={"nome": "TEST_Pedro Miguel Silva",
                            "data_nascimento": "2010-05-01", "n_processo": "12345"})
    assert r.status_code == 200
    return r.json()


# ─── Partial updates ────────────────────────────────────────────────────────
class TestAlunoUpdate:
    def test_update_nome_only(self, ha, aluno_a):
        r = requests.put(f"{BASE_URL}/api/alunos/{aluno_a['id']}", headers=ha,
                         json={"nome": "TEST_Pedro M. Silva"})
        assert r.status_code == 200, r.text
        assert r.json()["nome"] == "TEST_Pedro M. Silva"
        # unchanged fields preserved
        assert r.json()["data_nascimento"] == "2010-05-01"
        assert r.json()["n_processo"] == "12345"

    def test_update_all_basic_fields(self, ha, aluno_a):
        r = requests.put(f"{BASE_URL}/api/alunos/{aluno_a['id']}", headers=ha,
                         json={"nome": "TEST_X", "data_nascimento": "2011-01-15",
                               "n_processo": "9999"})
        assert r.status_code == 200
        d = r.json()
        assert d["nome"] == "TEST_X"
        assert d["data_nascimento"] == "2011-01-15"
        assert d["n_processo"] == "9999"

    def test_medidas_persist_and_trim_empty(self, ha, aluno_a):
        payload = {"medidas": {
            "universais": ["Reforço positivo", "  ", "", "Apoio direto"],
            "adicionais": ["", "PEI - Adaptações"],
            "seletivas": [],
        }}
        r = requests.put(f"{BASE_URL}/api/alunos/{aluno_a['id']}", headers=ha, json=payload)
        assert r.status_code == 200, r.text
        m = r.json()["medidas"]
        assert m["universais"] == ["Reforço positivo", "Apoio direto"]
        assert m["adicionais"] == ["PEI - Adaptações"]
        assert m["seletivas"] == []

        # Persistence check via GET
        g = requests.get(f"{BASE_URL}/api/alunos?turma_id={aluno_a['turma_id']}",
                         headers=ha)
        found = next(a for a in g.json() if a["id"] == aluno_a["id"])
        assert found["medidas"]["universais"] == ["Reforço positivo", "Apoio direto"]

    def test_unknown_aluno_returns_404(self, ha):
        r = requests.put(f"{BASE_URL}/api/alunos/{uuid.uuid4().hex}", headers=ha,
                         json={"nome": "X"})
        assert r.status_code == 404

    def test_foreign_teacher_cannot_update(self, hb, aluno_a):
        # Teacher B tries to update Teacher A's aluno – get_turma_or_404 raises 404
        r = requests.put(f"{BASE_URL}/api/alunos/{aluno_a['id']}", headers=hb,
                         json={"nome": "HACK"})
        # Backend uses get_turma_or_404 which returns 404 (not 403). Either is
        # acceptable – ensure at least it is denied.
        assert r.status_code in (403, 404), r.text

    def test_unauthenticated(self, aluno_a):
        r = requests.put(f"{BASE_URL}/api/alunos/{aluno_a['id']}", json={"nome": "X"})
        assert r.status_code == 401


# ─── Regressions on other endpoints (light) ─────────────────────────────────
class TestRegression:
    def test_login_admin(self, admin_token):
        assert admin_token

    def test_list_turmas_and_alunos(self, ha, turma_a, aluno_a):
        r = requests.get(f"{BASE_URL}/api/turmas", headers=ha)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/alunos?turma_id={turma_a['id']}", headers=ha)
        assert r2.status_code == 200
        assert any(a["id"] == aluno_a["id"] for a in r2.json())

    def test_add_instrumento_and_notas_still_works(self, ha, turma_a, aluno_a):
        c = requests.post(f"{BASE_URL}/api/instrumentos?turma_id={turma_a['id']}",
                          headers=ha, json={
                              "nome": "Ficha 1", "tipo": "Ficha", "data": "",
                              "questoes": [{"id": "1", "dom": "CP", "cotacao": 5}],
                          })
        assert c.status_code == 200
        inst = c.json()
        n = requests.put(f"{BASE_URL}/api/instrumentos/{inst['id']}/notas", headers=ha,
                         json={"notas": {aluno_a["id"]: {"1": 4}}})
        assert n.status_code == 200
