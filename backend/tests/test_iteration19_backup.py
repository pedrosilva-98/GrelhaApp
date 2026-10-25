"""
Iteration 19: cópia de segurança — GET /api/backup e POST /api/backup/restaurar.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "passilva2005@gmail.com"
ADMIN_PWD = "!grelhaadmin2005!"


def _criar_professor(ah, max_turmas=None):
    email = f"it19_{uuid.uuid4().hex[:8]}@teste.pt"
    body = {"email": email, "password": "teste123", "nome": "It19", "agrupamento": "AE"}
    if max_turmas:
        body["max_turmas"] = max_turmas
    t = requests.post(f"{API}/admin/teachers", headers=ah, json=body).json()
    tok = requests.post(f"{API}/auth/login", json={"email": email, "password": "teste123"}).json()["access_token"]
    return t["id"], {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def ah():
    tok = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def prof(ah):
    pid, th = _criar_professor(ah)
    yield th
    requests.delete(f"{API}/admin/teachers/{pid}", headers=ah)


class TestBackup:
    def test_backup_e_restauro(self, prof):
        th = prof
        tid = requests.post(f"{API}/turmas", headers=th, json={"disciplina": "Mat", "ano": "7º", "turma": "A"}).json()["id"]
        requests.post(f"{API}/alunos/bulk", params={"turma_id": tid}, headers=th, json={"alunos": [{"nome": "Ana"}, {"nome": "Bruno"}]})
        alunos = requests.get(f"{API}/alunos", params={"turma_id": tid}, headers=th).json()
        inst = requests.post(f"{API}/instrumentos", params={"turma_id": tid}, headers=th, json={
            "nome": "Ficha", "tipo": "Avaliação Sumativa", "data": "", "questoes": [{"id": "1", "dom": "CP", "cotacao": 100}],
        }).json()
        requests.put(f"{API}/instrumentos/{inst['id']}/notas", headers=th, json={"notas": {alunos[0]["id"]: {"1": 8}}})

        backup = requests.get(f"{API}/backup", headers=th).json()
        assert backup["versao"] == 1
        tb = [x for x in backup["turmas"] if x["turma"]["id"] == tid][0]
        assert [a["nome"] for a in tb["alunos"]] == ["Ana", "Bruno"]
        assert tb["instrumentos"][0]["notas"][alunos[0]["id"]] == {"1": 8}

        # Estraga os dados e repõe a partir da cópia.
        requests.delete(f"{API}/alunos/{alunos[1]['id']}", headers=th)
        requests.delete(f"{API}/instrumentos/{inst['id']}", headers=th)
        r = requests.post(f"{API}/backup/restaurar", headers=th, json=tb)
        assert r.status_code == 200, r.text
        assert r.json()["acao"] == "substituida"
        assert [a["nome"] for a in requests.get(f"{API}/alunos", params={"turma_id": tid}, headers=th).json()] == ["Ana", "Bruno"]
        insts = requests.get(f"{API}/instrumentos", params={"turma_id": tid}, headers=th).json()
        assert insts[0]["notas"][alunos[0]["id"]] == {"1": 8}

        # Turma eliminada volta a ser criada.
        requests.delete(f"{API}/turmas/{tid}", headers=th)
        r = requests.post(f"{API}/backup/restaurar", headers=th, json=tb)
        assert r.status_code == 200 and r.json()["acao"] == "criada"
        assert any(t["id"] == tid for t in requests.get(f"{API}/turmas", headers=th).json())

    def test_turma_de_outro_professor_403(self, ah, prof):
        tb = requests.get(f"{API}/backup", headers=prof).json()["turmas"][0]
        pid, outro = _criar_professor(ah)
        try:
            assert requests.post(f"{API}/backup/restaurar", headers=outro, json=tb).status_code == 403
        finally:
            requests.delete(f"{API}/admin/teachers/{pid}", headers=ah)

    def test_ficheiro_invalido_400(self, prof):
        assert requests.post(f"{API}/backup/restaurar", headers=prof, json={"turma": {}}).status_code == 400
