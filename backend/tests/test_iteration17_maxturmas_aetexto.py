"""
Iteration 17:
- PUT /api/admin/teachers/{id}/max-turmas — o admin altera o número máximo de turmas.
- aes_texto: texto das aprendizagens editado só para um instrumento (a turma mantém o original).
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
def ah():
    tok = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}).json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def teacher(ah):
    email = f"it17_{uuid.uuid4().hex[:8]}@teste.pt"
    t = requests.post(f"{API}/admin/teachers", headers=ah,
                      json={"email": email, "password": "teste123", "nome": "It17", "agrupamento": "AE", "max_turmas": 1}).json()
    tok = requests.post(f"{API}/auth/login", json={"email": email, "password": "teste123"}).json()["access_token"]
    yield {**t, "headers": {"Authorization": f"Bearer {tok}"}}
    requests.delete(f"{API}/admin/teachers/{t['id']}", headers=ah)


class TestMaxTurmas:
    def test_admin_altera_max_turmas(self, ah, teacher):
        th = teacher["headers"]
        assert requests.post(f"{API}/turmas", headers=th, json={"disciplina": "A", "ano": "7º", "turma": "A"}).status_code == 200
        assert requests.post(f"{API}/turmas", headers=th, json={"disciplina": "B", "ano": "7º", "turma": "B"}).status_code == 400
        r = requests.put(f"{API}/admin/teachers/{teacher['id']}/max-turmas", headers=ah, json={"max_turmas": 2})
        assert r.status_code == 200 and r.json()["max_turmas"] == 2
        assert requests.post(f"{API}/turmas", headers=th, json={"disciplina": "B", "ano": "7º", "turma": "B"}).status_code == 200

    def test_valor_invalido_422(self, ah, teacher):
        r = requests.put(f"{API}/admin/teachers/{teacher['id']}/max-turmas", headers=ah, json={"max_turmas": 0})
        assert r.status_code == 422

    def test_professor_nao_pode(self, teacher):
        r = requests.put(f"{API}/admin/teachers/{teacher['id']}/max-turmas", headers=teacher["headers"], json={"max_turmas": 50})
        assert r.status_code == 403


class TestAesTexto:
    def test_texto_editado_fica_no_instrumento(self, ah, teacher):
        th = teacher["headers"]
        tid = requests.get(f"{API}/turmas", headers=th).json()[0]["id"]
        requests.put(f"{API}/admin/turmas/{tid}/competencias", headers=ah,
                     json={"competencias": [{"code": "AE1", "nome": "Texto oficial longo"}]})
        r = requests.post(f"{API}/instrumentos", params={"turma_id": tid}, headers=th, json={
            "nome": "F", "tipo": "Avaliação Sumativa", "data": "",
            "questoes": [{"id": "1", "dom": "CP", "cotacao": 100, "comp": "AE1"}],
            "aes_texto": {"AE1": "  Texto claro  ", "AE9": "não usada"},
        })
        assert r.status_code == 200, r.text
        assert r.json()["aes_texto"] == {"AE1": "Texto claro"}
        turma = [t for t in requests.get(f"{API}/turmas", headers=th).json() if t["id"] == tid][0]
        assert turma["competencias"][0]["nome"] == "Texto oficial longo"
