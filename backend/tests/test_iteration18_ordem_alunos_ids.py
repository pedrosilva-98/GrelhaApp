"""
Iteration 18:
- PUT /api/alunos/ordem — mudar a posição (nº) dos alunos na turma.
- alunos_ids nos instrumentos — instrumento aplicado só a alguns alunos.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "passilva2005@gmail.com"
ADMIN_PWD = "!grelhaadmin2005!"


@pytest.fixture(scope="module")
def th():
    adm = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}).json()["access_token"]
    ah = {"Authorization": f"Bearer {adm}"}
    email = f"it18_{uuid.uuid4().hex[:8]}@teste.pt"
    t = requests.post(f"{API}/admin/teachers", headers=ah,
                      json={"email": email, "password": "teste123", "nome": "It18", "agrupamento": "AE"}).json()
    tok = requests.post(f"{API}/auth/login", json={"email": email, "password": "teste123"}).json()["access_token"]
    yield {"Authorization": f"Bearer {tok}"}
    requests.delete(f"{API}/admin/teachers/{t['id']}", headers=ah)


@pytest.fixture(scope="module")
def turma(th):
    tid = requests.post(f"{API}/turmas", headers=th, json={"disciplina": "Mat", "ano": "7º", "turma": "A"}).json()["id"]
    r = requests.post(f"{API}/alunos/bulk", params={"turma_id": tid}, headers=th,
                      json={"alunos": [{"nome": n} for n in ["Ana", "Bruno", "Carla"]]})
    assert r.status_code == 200, r.text
    requests.post(f"{API}/alunos", params={"turma_id": tid}, headers=th, json={"nome": "Duarte"})
    return tid


def _nomes(th, tid):
    return [a["nome"] for a in requests.get(f"{API}/alunos", params={"turma_id": tid}, headers=th).json()]


class TestOrdemAlunos:
    def test_ordem_de_insercao(self, th, turma):
        assert _nomes(th, turma) == ["Ana", "Bruno", "Carla", "Duarte"]

    def test_reordenar(self, th, turma):
        alunos = requests.get(f"{API}/alunos", params={"turma_id": turma}, headers=th).json()
        ids = [a["id"] for a in alunos]
        nova = [ids[0], ids[3], ids[1], ids[2]]  # Duarte passa a nº 2
        r = requests.put(f"{API}/alunos/ordem", params={"turma_id": turma}, headers=th, json={"ids": nova})
        assert r.status_code == 200, r.text
        assert [a["nome"] for a in r.json()] == ["Ana", "Duarte", "Bruno", "Carla"]
        assert _nomes(th, turma) == ["Ana", "Duarte", "Bruno", "Carla"]

    def test_novo_aluno_vai_para_o_fim(self, th, turma):
        requests.post(f"{API}/alunos", params={"turma_id": turma}, headers=th, json={"nome": "Eva"})
        assert _nomes(th, turma)[-1] == "Eva"

    def test_lista_incompleta_400(self, th, turma):
        ids = [a["id"] for a in requests.get(f"{API}/alunos", params={"turma_id": turma}, headers=th).json()]
        r = requests.put(f"{API}/alunos/ordem", params={"turma_id": turma}, headers=th, json={"ids": ids[:-1]})
        assert r.status_code == 400


class TestAlunosIds:
    def test_instrumento_para_alunos_especificos(self, th, turma):
        alunos = requests.get(f"{API}/alunos", params={"turma_id": turma}, headers=th).json()
        um = alunos[1]["id"]
        body = {"nome": "Adaptado", "tipo": "Avaliação Sumativa", "data": "",
                "questoes": [{"id": "1", "dom": "CP", "cotacao": 100}], "alunos_ids": [um]}
        r = requests.post(f"{API}/instrumentos", params={"turma_id": turma}, headers=th, json=body)
        assert r.status_code == 200, r.text
        inst = r.json()
        assert inst["alunos_ids"] == [um]
        # Editar sem mexer em alunos_ids mantém a seleção; enviar null volta a "todos".
        r = requests.put(f"{API}/instrumentos/{inst['id']}", headers=th, json={"nome": "Adaptado 2"})
        assert r.json()["alunos_ids"] == [um]
        r = requests.put(f"{API}/instrumentos/{inst['id']}", headers=th, json={"alunos_ids": None})
        assert r.json()["alunos_ids"] is None

    def test_lista_vazia_ou_aluno_de_fora_400(self, th, turma):
        base = {"nome": "X", "tipo": "Avaliação Sumativa", "data": "", "questoes": [{"id": "1", "dom": "CP", "cotacao": 100}]}
        assert requests.post(f"{API}/instrumentos", params={"turma_id": turma}, headers=th, json={**base, "alunos_ids": []}).status_code == 400
        assert requests.post(f"{API}/instrumentos", params={"turma_id": turma}, headers=th, json={**base, "alunos_ids": ["nao-existe"]}).status_code == 400
