"""
Iteration 8 backend tests:
- POST /api/alunos/bulk with new `alunos:[{nome,data_nascimento,n_processo}]` shape
  + backwards-compat with `nomes:[...]` + empty-name skipping.
- PUT /api/turmas/{tid}/od/{param_id} (ODAvaliacaoUpdate): dom / notas por semestre (semestre obrigatório: 1 ou 2),
  validations (unknown param → 400, unknown dom → 400, nota OOR → 400, invalid semestre → 400),
  null nota clears entry, persists to turma.od_avaliacoes.
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


@pytest.fixture(scope="module")
def teacher(admin_token):
    email = f"phase4_it8_{uuid.uuid4().hex[:8]}@teste.pt"
    pwd = "teste123"
    r = requests.post(f"{BASE_URL}/api/admin/teachers",
                      headers={"Authorization": f"Bearer {admin_token}"},
                      json={"email": email, "password": pwd, "nome": "Iter8", "agrupamento": "AE"})
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    login = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pwd})
    tok = login.json()["access_token"]
    yield {"id": tid, "token": tok, "email": email}
    requests.delete(f"{BASE_URL}/api/admin/teachers/{tid}",
                    headers={"Authorization": f"Bearer {admin_token}"})


@pytest.fixture()
def th(teacher):
    return {"Authorization": f"Bearer {teacher['token']}"}


@pytest.fixture()
def turma(th):
    r = requests.post(f"{BASE_URL}/api/turmas", headers=th,
                      json={"disciplina": "Mat", "ano": "7", "turma": "A"})
    t = r.json()
    yield t
    requests.delete(f"{BASE_URL}/api/turmas/{t['id']}", headers=th)


# ─── Bulk alunos ─────────────────────────────────────────────────────────────
class TestAlunosBulk:
    def test_new_shape_full_payload(self, turma, th):
        payload = {"alunos": [
            {"nome": "TEST_Ana Silva", "data_nascimento": "2012-05-10", "n_processo": "10001"},
            {"nome": "TEST_Bruno Costa", "data_nascimento": "2012-08-22", "n_processo": "10002"},
            {"nome": "", "data_nascimento": "2000-01-01", "n_processo": "X"},  # skipped
            {"nome": "TEST_Só Nome"},  # optional fields
        ]}
        r = requests.post(f"{BASE_URL}/api/alunos/bulk?turma_id={turma['id']}",
                          headers=th, json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["inserted"] == 3
        names = {a["nome"] for a in data["alunos"]}
        assert "TEST_Ana Silva" in names and "TEST_Só Nome" in names
        # GET persistence
        g = requests.get(f"{BASE_URL}/api/alunos?turma_id={turma['id']}", headers=th).json()
        by_name = {a["nome"]: a for a in g}
        assert by_name["TEST_Ana Silva"]["data_nascimento"] == "2012-05-10"
        assert by_name["TEST_Ana Silva"]["n_processo"] == "10001"
        assert by_name["TEST_Só Nome"].get("data_nascimento", "") == ""

    def test_legacy_nomes_still_works(self, turma, th):
        r = requests.post(f"{BASE_URL}/api/alunos/bulk?turma_id={turma['id']}",
                          headers=th, json={"nomes": ["TEST_Legacy A", "", "  ", "TEST_Legacy B"]})
        assert r.status_code == 200, r.text
        assert r.json()["inserted"] == 2

    def test_empty_body_returns_zero(self, turma, th):
        r = requests.post(f"{BASE_URL}/api/alunos/bulk?turma_id={turma['id']}",
                          headers=th, json={})
        assert r.status_code == 200
        assert r.json()["inserted"] == 0

    def test_empty_alunos_list(self, turma, th):
        r = requests.post(f"{BASE_URL}/api/alunos/bulk?turma_id={turma['id']}",
                          headers=th, json={"alunos": []})
        assert r.status_code == 200
        assert r.json()["inserted"] == 0


# ─── OD Avaliação endpoint ───────────────────────────────────────────────────
class TestODAvaliacao:
    def _prep(self, turma, th):
        # Configure parametros_od
        r = requests.put(f"{BASE_URL}/api/turmas/{turma['id']}/config", headers=th, json={
            "parametros_od": [
                {"id": "P1", "nome": "Participação", "dom": None},
                {"id": "P2", "nome": "Autonomia", "dom": None},
            ],
        })
        assert r.status_code == 200, r.text
        # Create alunos
        ab = requests.post(f"{BASE_URL}/api/alunos/bulk?turma_id={turma['id']}", headers=th,
                           json={"alunos": [{"nome": "TEST_Ana"}, {"nome": "TEST_Bru"}]}).json()
        return [a["id"] for a in ab["alunos"]]

    def test_save_dom_semestre_and_notas(self, turma, th):
        alunos = self._prep(turma, th)
        a1, a2 = alunos
        payload = {"dom": "CP", "semestre": 1, "notas": {a1: 8.5, a2: 7.0}}
        r = requests.put(f"{BASE_URL}/api/turmas/{turma['id']}/od/P1",
                         headers=th, json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["dom"] == "CP"
        assert body["semestre"] == 1
        assert body["notas"][a1] == 8.5
        # GET turma verifies persistence
        turmas = requests.get(f"{BASE_URL}/api/turmas", headers=th).json()
        t = next(x for x in turmas if x["id"] == turma["id"])
        assert t["od_avaliacoes"]["P1"]["1"]["dom"] == "CP"
        assert t["od_avaliacoes"]["P1"]["1"]["notas"][a1] == 8.5
        assert "2" not in t["od_avaliacoes"]["P1"]

    def test_semestres_are_independent(self, turma, th):
        a1, a2 = self._prep(turma, th)
        requests.put(f"{BASE_URL}/api/turmas/{turma['id']}/od/P1", headers=th,
                     json={"dom": "CP", "semestre": 1, "notas": {a1: 8, a2: 7}})
        r = requests.put(f"{BASE_URL}/api/turmas/{turma['id']}/od/P1", headers=th,
                         json={"dom": "CP", "semestre": 2, "notas": {a1: 5}})
        assert r.status_code == 200, r.text
        assert r.json()["semestre"] == 2
        turmas = requests.get(f"{BASE_URL}/api/turmas", headers=th).json()
        t = next(x for x in turmas if x["id"] == turma["id"])
        assert t["od_avaliacoes"]["P1"]["1"]["notas"] == {a1: 8, a2: 7}
        assert t["od_avaliacoes"]["P1"]["2"]["notas"] == {a1: 5}

    def test_semestre_is_required(self, turma, th):
        self._prep(turma, th)
        r = requests.put(f"{BASE_URL}/api/turmas/{turma['id']}/od/P1", headers=th,
                         json={"dom": "CP"})
        assert r.status_code == 422

    def test_null_nota_clears(self, turma, th):
        alunos = self._prep(turma, th)
        a1, a2 = alunos
        requests.put(f"{BASE_URL}/api/turmas/{turma['id']}/od/P1", headers=th,
                     json={"dom": "CP", "semestre": 1, "notas": {a1: 8, a2: 6}})
        # Clear a1 via null
        r = requests.put(f"{BASE_URL}/api/turmas/{turma['id']}/od/P1", headers=th,
                         json={"semestre": 1, "notas": {a1: None}})
        assert r.status_code == 200, r.text
        notas = r.json()["notas"]
        assert a1 not in notas
        assert notas[a2] == 6

    def test_unknown_parametro_returns_400(self, turma, th):
        self._prep(turma, th)
        r = requests.put(f"{BASE_URL}/api/turmas/{turma['id']}/od/PZ",
                         headers=th, json={"dom": "CP", "semestre": 1})
        assert r.status_code == 400
        assert "parâmetro" in r.json()["detail"].lower() or "parametro" in r.json()["detail"].lower()

    def test_unknown_dom_returns_400(self, turma, th):
        self._prep(turma, th)
        r = requests.put(f"{BASE_URL}/api/turmas/{turma['id']}/od/P1",
                         headers=th, json={"dom": "ZZZ", "semestre": 1})
        assert r.status_code == 400
        assert "domínio" in r.json()["detail"].lower() or "dominio" in r.json()["detail"].lower()

    def test_nota_out_of_range_returns_400(self, turma, th):
        alunos = self._prep(turma, th)
        r = requests.put(f"{BASE_URL}/api/turmas/{turma['id']}/od/P1", headers=th,
                         json={"dom": "CP", "semestre": 1, "notas": {alunos[0]: 11}})
        assert r.status_code == 400

    def test_invalid_semestre_returns_400(self, turma, th):
        self._prep(turma, th)
        r = requests.put(f"{BASE_URL}/api/turmas/{turma['id']}/od/P1", headers=th,
                         json={"semestre": 5})
        assert r.status_code == 400

    def test_semestre_zero_is_rejected(self, turma, th):
        """\"Ambos\" (0/null) já não é uma opção: cada semestre é classificado individualmente."""
        self._prep(turma, th)
        r = requests.put(f"{BASE_URL}/api/turmas/{turma['id']}/od/P1", headers=th,
                         json={"semestre": 0})
        assert r.status_code == 400
