"""
Iteration 6 – Phase 2 backend tests.

Covers:
- PUT /api/turmas/{id}/config (semestres, parametros_od, meta_sucesso) + validations
- POST/PUT /api/instrumentos with semestre + observacao_direta + validations
- Regression: login (admin/teacher), turma create/duplicate/delete, aluno add/delete,
  instrumento notas.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "passilva2005@gmail.com"
ADMIN_PWD = "!grelhaadmin2005!"


# ─── Fixtures ────────────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def teacher_ctx(admin_token):
    """Create ephemeral teacher, login, yield (email, pwd, token, teacher_id).
    Delete teacher on teardown."""
    email = f"phase2_it6_{uuid.uuid4().hex[:8]}@teste.pt"
    pwd = "teste123"
    r = requests.post(
        f"{BASE_URL}/api/admin/teachers",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"email": email, "password": pwd, "nome": "Phase2 Iter6", "agrupamento": "AE Test"},
    )
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    login = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    yield {"email": email, "pwd": pwd, "token": token, "id": tid}
    # cleanup
    requests.delete(
        f"{BASE_URL}/api/admin/teachers/{tid}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )


@pytest.fixture()
def th(teacher_ctx):
    return {"Authorization": f"Bearer {teacher_ctx['token']}"}


@pytest.fixture()
def turma(th):
    r = requests.post(f"{BASE_URL}/api/turmas", headers=th,
                      json={"disciplina": "Matemática", "ano": "7", "turma": "A"})
    assert r.status_code == 200, r.text
    t = r.json()
    yield t
    requests.delete(f"{BASE_URL}/api/turmas/{t['id']}", headers=th)


# ─── Login sanity ────────────────────────────────────────────────────────────
class TestAuth:
    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_teacher_login(self, teacher_ctx):
        assert teacher_ctx["token"]


# ─── Turma config (Phase 2) ──────────────────────────────────────────────────
class TestTurmaConfig:
    URL = staticmethod(lambda tid: f"{BASE_URL}/api/turmas/{tid}/config")

    def test_set_semestres_valid(self, turma, th):
        payload = {"semestres": {
            "1": {"inicio": "2025-09-15", "fim": "2026-01-30", "peso": 50},
            "2": {"inicio": "2026-02-01", "fim": "2026-06-30", "peso": 50},
        }}
        r = requests.put(self.URL(turma["id"]), headers=th, json=payload)
        assert r.status_code == 200, r.text
        got = r.json()
        assert got["semestres"]["1"]["peso"] == 50
        assert got["semestres"]["2"]["fim"] == "2026-06-30"

    def test_semestres_weights_not_100(self, turma, th):
        r = requests.put(self.URL(turma["id"]), headers=th, json={"semestres": {
            "1": {"inicio": "", "fim": "", "peso": 40},
            "2": {"inicio": "", "fim": "", "peso": 40},
        }})
        assert r.status_code == 400
        assert "100" in r.json()["detail"]

    def test_semestres_invalid_key(self, turma, th):
        r = requests.put(self.URL(turma["id"]), headers=th, json={"semestres": {
            "3": {"inicio": "", "fim": "", "peso": 100},
        }})
        assert r.status_code == 400

    def test_parametros_od_valid(self, turma, th):
        r = requests.put(self.URL(turma["id"]), headers=th, json={"parametros_od": [
            {"id": "P1", "nome": "Participação", "dom": "ER"},
            {"id": "P2", "nome": "Autonomia", "dom": "ER"},
        ]})
        assert r.status_code == 200, r.text
        assert len(r.json()["parametros_od"]) == 2

    def test_parametros_od_duplicate(self, turma, th):
        r = requests.put(self.URL(turma["id"]), headers=th, json={"parametros_od": [
            {"id": "P1", "nome": "A", "dom": "ER"},
            {"id": "P1", "nome": "B", "dom": "ER"},
        ]})
        assert r.status_code == 400
        assert "duplicad" in r.json()["detail"].lower()

    def test_meta_sucesso_valid(self, turma, th):
        r = requests.put(self.URL(turma["id"]), headers=th, json={"meta_sucesso": 65})
        assert r.status_code == 200
        assert r.json()["meta_sucesso"] == 65.0

    def test_meta_sucesso_out_of_range(self, turma, th):
        r = requests.put(self.URL(turma["id"]), headers=th, json={"meta_sucesso": 150})
        assert r.status_code == 400  # server-side range check


# ─── Instrumentos with semestre + OD ─────────────────────────────────────────
class TestInstrumentoPhase2:
    def _configure(self, turma, th):
        # Set semestres and parametros_od
        requests.put(
            f"{BASE_URL}/api/turmas/{turma['id']}/config", headers=th,
            json={
                "semestres": {
                    "1": {"inicio": "2025-09-15", "fim": "2026-01-30", "peso": 50},
                    "2": {"inicio": "2026-02-01", "fim": "2026-06-30", "peso": 50},
                },
                "parametros_od": [
                    {"id": "P1", "nome": "Participação", "dom": "ER"},
                    {"id": "P2", "nome": "Autonomia", "dom": "ER"},
                ],
                "meta_sucesso": 60,
            },
        )

    def test_create_instrumento_with_semestre_and_od(self, turma, th):
        self._configure(turma, th)
        payload = {
            "nome": "Ficha 1", "tipo": "Ficha", "data": "2025-10-01", "semestre": 1,
            "questoes": [{"id": "1", "dom": "CP", "cotacao": 5, "comp": None}],
            "observacao_direta": [
                {"parametro_id": "P1", "dom": "ER", "nota": 8.5},
                {"parametro_id": "P2", "dom": "ER", "nota": 7},
            ],
        }
        r = requests.post(f"{BASE_URL}/api/instrumentos?turma_id={turma['id']}", headers=th, json=payload)
        assert r.status_code == 200, r.text
        inst = r.json()
        assert inst["semestre"] == 1
        assert len(inst["observacao_direta"]) == 2

        # GET verifies persistence
        g = requests.get(f"{BASE_URL}/api/instrumentos?turma_id={turma['id']}", headers=th)
        assert g.status_code == 200
        saved = next(i for i in g.json() if i["id"] == inst["id"])
        assert saved["observacao_direta"][0]["nota"] == 8.5

    def test_invalid_semestre_value(self, turma, th):
        self._configure(turma, th)
        r = requests.post(f"{BASE_URL}/api/instrumentos?turma_id={turma['id']}", headers=th, json={
            "nome": "X", "tipo": "Ficha", "data": "2025-10-01", "semestre": 3,
            "questoes": [{"id": "1", "dom": "CP", "cotacao": 5}],
        })
        assert r.status_code == 400

    def test_date_outside_semestre_range(self, turma, th):
        self._configure(turma, th)
        r = requests.post(f"{BASE_URL}/api/instrumentos?turma_id={turma['id']}", headers=th, json={
            "nome": "X", "tipo": "Ficha", "data": "2025-08-01", "semestre": 1,
            "questoes": [{"id": "1", "dom": "CP", "cotacao": 5}],
        })
        assert r.status_code == 400
        assert "anterior" in r.json()["detail"].lower() or "posterior" in r.json()["detail"].lower()

    def test_unknown_parametro_od(self, turma, th):
        self._configure(turma, th)
        r = requests.post(f"{BASE_URL}/api/instrumentos?turma_id={turma['id']}", headers=th, json={
            "nome": "X", "tipo": "Ficha", "data": "2025-10-01", "semestre": 1,
            "questoes": [{"id": "1", "dom": "CP", "cotacao": 5}],
            "observacao_direta": [{"parametro_id": "PZ", "dom": "ER", "nota": 5}],
        })
        assert r.status_code == 400
        assert "parâmetro" in r.json()["detail"].lower() or "parametro" in r.json()["detail"].lower()

    def test_nota_out_of_range(self, turma, th):
        self._configure(turma, th)
        r = requests.post(f"{BASE_URL}/api/instrumentos?turma_id={turma['id']}", headers=th, json={
            "nome": "X", "tipo": "Ficha", "data": "2025-10-01", "semestre": 1,
            "questoes": [{"id": "1", "dom": "CP", "cotacao": 5}],
            "observacao_direta": [{"parametro_id": "P1", "dom": "ER", "nota": 11}],
        })
        assert r.status_code == 400

    def test_od_unknown_dom(self, turma, th):
        self._configure(turma, th)
        r = requests.post(f"{BASE_URL}/api/instrumentos?turma_id={turma['id']}", headers=th, json={
            "nome": "X", "tipo": "Ficha", "data": "2025-10-01", "semestre": 1,
            "questoes": [{"id": "1", "dom": "CP", "cotacao": 5}],
            "observacao_direta": [{"parametro_id": "P1", "dom": "ZZZ", "nota": 5}],
        })
        assert r.status_code == 400

    def test_update_instrumento_semestre_and_od(self, turma, th):
        self._configure(turma, th)
        c = requests.post(f"{BASE_URL}/api/instrumentos?turma_id={turma['id']}", headers=th, json={
            "nome": "F1", "tipo": "Ficha", "data": "2025-10-01", "semestre": 1,
            "questoes": [{"id": "1", "dom": "CP", "cotacao": 5}],
        })
        assert c.status_code == 200
        inst_id = c.json()["id"]

        # update with valid semestre 2 + valid date
        u = requests.put(f"{BASE_URL}/api/instrumentos/{inst_id}", headers=th, json={
            "semestre": 2, "data": "2026-03-01",
            "observacao_direta": [{"parametro_id": "P1", "dom": "ER", "nota": 9}],
        })
        assert u.status_code == 200, u.text
        assert u.json()["semestre"] == 2

        # update with data outside sem 2 → should fail
        u2 = requests.put(f"{BASE_URL}/api/instrumentos/{inst_id}", headers=th, json={
            "data": "2026-07-15",
        })
        assert u2.status_code == 400


# ─── Regressions ─────────────────────────────────────────────────────────────
class TestRegression:
    def test_turma_duplicate_delete(self, turma, th):
        d = requests.post(f"{BASE_URL}/api/turmas/{turma['id']}/duplicate", headers=th)
        assert d.status_code == 200
        dup = d.json()
        assert "(cópia)" in dup["turma"]
        # cleanup
        assert requests.delete(f"{BASE_URL}/api/turmas/{dup['id']}", headers=th).status_code == 200

    def test_aluno_add_delete(self, turma, th):
        r = requests.post(f"{BASE_URL}/api/alunos?turma_id={turma['id']}", headers=th,
                          json={"nome": "TEST_Aluno"})
        assert r.status_code == 200
        aid = r.json()["id"]
        g = requests.get(f"{BASE_URL}/api/alunos?turma_id={turma['id']}", headers=th)
        assert any(a["id"] == aid for a in g.json())
        assert requests.delete(f"{BASE_URL}/api/alunos/{aid}", headers=th).status_code == 200

    def test_lancar_notas(self, turma, th):
        # create aluno
        a = requests.post(f"{BASE_URL}/api/alunos?turma_id={turma['id']}", headers=th,
                          json={"nome": "TEST_A"}).json()
        # create instrumento
        c = requests.post(f"{BASE_URL}/api/instrumentos?turma_id={turma['id']}", headers=th, json={
            "nome": "F2", "tipo": "Ficha", "data": "",
            "questoes": [{"id": "1", "dom": "CP", "cotacao": 5}],
        }).json()
        r = requests.put(f"{BASE_URL}/api/instrumentos/{c['id']}/notas", headers=th, json={
            "notas": {a["id"]: {"1": 4}},
        })
        assert r.status_code == 200
        g = requests.get(f"{BASE_URL}/api/instrumentos?turma_id={turma['id']}", headers=th)
        saved = next(i for i in g.json() if i["id"] == c["id"])
        assert saved["notas"][a["id"]]["1"] == 4
