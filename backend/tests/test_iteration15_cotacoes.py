"""
Iteration 15: cada domínio avaliado num instrumento tem de somar 100 pontos (20 no 10º-12º ano).
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
    email = f"it15_{uuid.uuid4().hex[:8]}@teste.pt"
    t = requests.post(f"{API}/admin/teachers", headers=ah,
                      json={"email": email, "password": "teste123", "nome": "It15", "agrupamento": "AE"}).json()
    tok = requests.post(f"{API}/auth/login", json={"email": email, "password": "teste123"}).json()["access_token"]
    yield {"Authorization": f"Bearer {tok}"}
    requests.delete(f"{API}/admin/teachers/{t['id']}", headers=ah)


def _turma(th, ano):
    r = requests.post(f"{API}/turmas", headers=th, json={"disciplina": "Mat", "ano": ano, "turma": uuid.uuid4().hex[:4]})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _inst(th, tid, questoes):
    return requests.post(f"{API}/instrumentos", params={"turma_id": tid}, headers=th,
                         json={"nome": "T", "tipo": "Avaliação Sumativa", "data": "", "questoes": questoes})


class TestCotacoesPorDominio:
    def test_basico_cada_dominio_100(self, th):
        tid = _turma(th, "7º")
        r = _inst(th, tid, [
            {"id": "1", "dom": "CP", "cotacao": 40}, {"id": "2", "dom": "CP", "cotacao": 60},
            {"id": "3", "dom": "RRP", "cotacao": 100},
        ])
        assert r.status_code == 200, r.text

    def test_basico_dominio_incompleto_400(self, th):
        tid = _turma(th, "7º")
        r = _inst(th, tid, [{"id": "1", "dom": "CP", "cotacao": 40}, {"id": "2", "dom": "RRP", "cotacao": 100}])
        assert r.status_code == 400
        assert "CP" in r.json()["detail"] and "100" in r.json()["detail"]

    def test_secundario_cada_dominio_20(self, th):
        tid = _turma(th, "11º")
        assert _inst(th, tid, [{"id": "1", "dom": "CP", "cotacao": 8}, {"id": "2", "dom": "CP", "cotacao": 12}]).status_code == 200
        assert _inst(th, tid, [{"id": "1", "dom": "CP", "cotacao": 100}]).status_code == 400

    def test_editar_valida_cotacoes(self, th):
        tid = _turma(th, "7º")
        iid = _inst(th, tid, [{"id": "1", "dom": "CP", "cotacao": 100}]).json()["id"]
        r = requests.put(f"{API}/instrumentos/{iid}", headers=th, json={"questoes": [{"id": "1", "dom": "CP", "cotacao": 90}]})
        assert r.status_code == 400
        r = requests.put(f"{API}/instrumentos/{iid}", headers=th, json={"nome": "Só o nome"})
        assert r.status_code == 200
