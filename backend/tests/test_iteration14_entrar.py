"""
Iteration 14: POST /api/admin/teachers/{id}/entrar — o admin entra na conta de um professor.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN_EMAIL = "passilva2005@gmail.com"
ADMIN_PWD = "!grelhaadmin2005!"


@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def teacher(admin_headers):
    email = f"it14_{uuid.uuid4().hex[:8]}@teste.pt"
    r = requests.post(f"{BASE_URL}/api/admin/teachers", headers=admin_headers,
                      json={"email": email, "password": "teste123", "nome": "It14", "agrupamento": "AE"})
    assert r.status_code == 200, r.text
    t = r.json()
    tok = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "teste123"}).json()["access_token"]
    yield {**t, "headers": {"Authorization": f"Bearer {tok}"}}
    requests.delete(f"{BASE_URL}/api/admin/teachers/{t['id']}", headers=admin_headers)


class TestEntrarComoProfessor:
    def test_requires_auth(self, teacher):
        assert requests.post(f"{BASE_URL}/api/admin/teachers/{teacher['id']}/entrar").status_code == 401

    def test_teacher_cannot_use(self, teacher):
        r = requests.post(f"{BASE_URL}/api/admin/teachers/{teacher['id']}/entrar", headers=teacher["headers"])
        assert r.status_code == 403

    def test_unknown_teacher_404(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/admin/teachers/nao-existe/entrar", headers=admin_headers)
        assert r.status_code == 404

    def test_admin_enters_teacher_account(self, admin_headers, teacher):
        r = requests.post(f"{BASE_URL}/api/admin/teachers/{teacher['id']}/entrar", headers=admin_headers)
        assert r.status_code == 200, r.text
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=h).json()
        assert me["id"] == teacher["id"] and me["role"] == "teacher"
        assert me["impersonated_by"]["nome"]
        # Acede às rotas do professor, mas não pode mudar a palavra-passe dele.
        assert requests.get(f"{BASE_URL}/api/turmas", headers=h).status_code == 200
        r = requests.post(f"{BASE_URL}/api/auth/change-password", headers=h,
                          json={"current_password": "x", "new_password": "outra123"})
        assert r.status_code == 403

    def test_normal_teacher_login_not_flagged(self, teacher):
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=teacher["headers"]).json()
        assert "impersonated_by" not in me
