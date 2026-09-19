"""
Iteration 11: POST /api/ia/proposta-recuperacao — autenticação e validação do corpo.
(Não chama o Gemini: as validações e a autenticação acontecem antes.)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "passilva2005@gmail.com"
ADMIN_PWD = "!grelhaadmin2005!"
URL = f"{BASE_URL}/api/ia/proposta-recuperacao"

VALIDO = {
    "disciplina": "Matemática", "ano": "7º",
    "dominio_fraco": {"code": "RRP", "nome": "Raciocínio", "pct": 41},
    "aes": [{"code": "AE1", "nome": "Proporcionalidade direta", "pct": 35}],
    "num_questoes": 3,
}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def teacher_headers(admin_token):
    email = f"it11_{uuid.uuid4().hex[:8]}@teste.pt"
    r = requests.post(f"{BASE_URL}/api/admin/teachers", headers={"Authorization": f"Bearer {admin_token}"},
                      json={"email": email, "password": "teste123", "nome": "It11", "agrupamento": "AE"})
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    tok = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "teste123"}).json()["access_token"]
    yield {"Authorization": f"Bearer {tok}"}
    requests.delete(f"{BASE_URL}/api/admin/teachers/{tid}", headers={"Authorization": f"Bearer {admin_token}"})


class TestPropostaRecuperacao:
    def test_requires_auth(self):
        assert requests.post(URL, json=VALIDO).status_code == 401

    def test_admin_cannot_use(self, admin_token):
        r = requests.post(URL, headers={"Authorization": f"Bearer {admin_token}"}, json=VALIDO)
        assert r.status_code == 403

    @pytest.mark.parametrize("campo,valor", [
        ("num_questoes", 0),
        ("num_questoes", 11),
        ("aes", []),
    ])
    def test_invalid_body_422(self, teacher_headers, campo, valor):
        r = requests.post(URL, headers=teacher_headers, json={**VALIDO, campo: valor})
        assert r.status_code == 422

    def test_pct_out_of_range_422(self, teacher_headers):
        body = {**VALIDO, "aes": [{"code": "AE1", "nome": "x", "pct": 150}]}
        assert requests.post(URL, headers=teacher_headers, json=body).status_code == 422
