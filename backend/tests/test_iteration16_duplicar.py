"""
Iteration 16: POST /api/instrumentos/{id}/duplicar — copiar um instrumento para outra turma.
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
    email = f"it16_{uuid.uuid4().hex[:8]}@teste.pt"
    t = requests.post(f"{API}/admin/teachers", headers=ah,
                      json={"email": email, "password": "teste123", "nome": "It16", "agrupamento": "AE"}).json()
    tok = requests.post(f"{API}/auth/login", json={"email": email, "password": "teste123"}).json()["access_token"]
    yield {"Authorization": f"Bearer {tok}"}
    requests.delete(f"{API}/admin/teachers/{t['id']}", headers=ah)


def _turma(th, ano):
    r = requests.post(f"{API}/turmas", headers=th, json={"disciplina": "Mat", "ano": ano, "turma": uuid.uuid4().hex[:4]})
    assert r.status_code == 200, r.text
    return r.json()["id"]


class TestDuplicarInstrumento:
    def test_duplica_para_outra_turma_sem_notas(self, th):
        a, b = _turma(th, "7º"), _turma(th, "7º")
        inst = requests.post(f"{API}/instrumentos", params={"turma_id": a}, headers=th, json={
            "nome": "Ficha 1", "tipo": "Avaliação Sumativa", "data": "",
            "questoes": [{"id": "1", "dom": "CP", "cotacao": 40}, {"id": "2", "dom": "CP", "cotacao": 60}],
        }).json()
        requests.put(f"{API}/instrumentos/{inst['id']}/notas", headers=th, json={"notas": {"x": {"1": 5}}})
        r = requests.post(f"{API}/instrumentos/{inst['id']}/duplicar", headers=th, json={"turma_id": b})
        assert r.status_code == 200, r.text
        novo = r.json()["instrumento"]
        assert novo["turma_id"] == b and novo["notas"] == {} and novo["nome"] == "Ficha 1"
        assert [q["cotacao"] for q in novo["questoes"]] == [40, 60]
        ids_b = [i["id"] for i in requests.get(f"{API}/instrumentos", params={"turma_id": b}, headers=th).json()]
        assert novo["id"] in ids_b

    def test_ajusta_cotacoes_para_secundario(self, th):
        a, b = _turma(th, "9º"), _turma(th, "10º")
        inst = requests.post(f"{API}/instrumentos", params={"turma_id": a}, headers=th, json={
            "nome": "F", "tipo": "Avaliação Sumativa", "data": "",
            "questoes": [{"id": "1", "dom": "CP", "cotacao": 40}, {"id": "2", "dom": "CP", "cotacao": 60}],
        }).json()
        r = requests.post(f"{API}/instrumentos/{inst['id']}/duplicar", headers=th, json={"turma_id": b})
        assert r.status_code == 200, r.text
        assert [q["cotacao"] for q in r.json()["instrumento"]["questoes"]] == [8, 12]
        assert r.json()["avisos"]

    def test_turma_de_outro_professor_404(self, th):
        a = _turma(th, "7º")
        inst = requests.post(f"{API}/instrumentos", params={"turma_id": a}, headers=th, json={
            "nome": "F", "tipo": "Avaliação Sumativa", "data": "", "questoes": [{"id": "1", "dom": "CP", "cotacao": 100}],
        }).json()
        r = requests.post(f"{API}/instrumentos/{inst['id']}/duplicar", headers=th, json={"turma_id": "nao-existe"})
        assert r.status_code == 404
