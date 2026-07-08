from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# ─── DB ───────────────────────────────────────────────────────────────────────
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
ACCESS_MIN = 60 * 24 * 7  # 7 days

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="Grelhas de Avaliação API")
api = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("app")

# ─── Utils ────────────────────────────────────────────────────────────────────

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MIN),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(request: Request) -> dict:
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Utilizador não encontrado")
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Apenas administrador")
    return user

async def require_teacher(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Apenas professor")
    return user

# ─── Models ───────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TeacherCreate(BaseModel):
    email: EmailStr
    password: str
    nome: str
    disciplina: str
    ano: str
    turma: str

class TeacherOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    nome: str
    disciplina: str
    ano: str
    turma: str
    role: str = "teacher"
    created_at: Optional[str] = None

class AlunoIn(BaseModel):
    nome: str

class Questao(BaseModel):
    id: str
    dom: str  # CP | RRP | CM | ER
    cotacao: float

class InstrumentoIn(BaseModel):
    nome: str
    tipo: str
    data: str = ""
    questoes: List[Questao]

class NotasUpdate(BaseModel):
    # { alunoId: { qId: value } }
    notas: Dict[str, Dict[str, float]]

class Ponderacoes(BaseModel):
    CP: int
    RRP: int
    CM: int
    ER: int

# ─── Auth Endpoints ───────────────────────────────────────────────────────────

@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    token = create_token(user["id"], user["email"], user["role"])
    safe_user = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    return {"access_token": token, "token_type": "bearer", "user": safe_user}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}

# ─── Admin: Teachers ──────────────────────────────────────────────────────────

@api.get("/admin/teachers")
async def list_teachers(_: dict = Depends(require_admin)):
    teachers = await db.users.find({"role": "teacher"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return teachers

@api.post("/admin/teachers")
async def create_teacher(body: TeacherCreate, _: dict = Depends(require_admin)):
    email = body.email.lower().strip()
    exists = await db.users.find_one({"email": email})
    if exists:
        raise HTTPException(status_code=400, detail="Email já registado")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(body.password),
        "nome": body.nome,
        "disciplina": body.disciplina,
        "ano": body.ano,
        "turma": body.turma,
        "role": "teacher",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    # Seed default ponderacoes
    await db.ponderacoes.update_one(
        {"prof_id": doc["id"]},
        {"$set": {"prof_id": doc["id"], "CP": 50, "RRP": 25, "CM": 10, "ER": 15}},
        upsert=True,
    )
    safe = {k: v for k, v in doc.items() if k != "password_hash"}
    return safe

@api.delete("/admin/teachers/{teacher_id}")
async def delete_teacher(teacher_id: str, _: dict = Depends(require_admin)):
    res = await db.users.delete_one({"id": teacher_id, "role": "teacher"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    await db.alunos.delete_many({"prof_id": teacher_id})
    await db.instrumentos.delete_many({"prof_id": teacher_id})
    await db.ponderacoes.delete_many({"prof_id": teacher_id})
    return {"ok": True}

# ─── Teacher: Alunos ──────────────────────────────────────────────────────────

@api.get("/alunos")
async def get_alunos(user: dict = Depends(require_teacher)):
    docs = await db.alunos.find({"prof_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return docs

@api.post("/alunos")
async def add_aluno(body: AlunoIn, user: dict = Depends(require_teacher)):
    doc = {
        "id": str(uuid.uuid4()),
        "prof_id": user["id"],
        "nome": body.nome.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.alunos.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.delete("/alunos/{aluno_id}")
async def delete_aluno(aluno_id: str, user: dict = Depends(require_teacher)):
    res = await db.alunos.delete_one({"id": aluno_id, "prof_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    # Also remove notas for this aluno from all instrumentos
    await db.instrumentos.update_many(
        {"prof_id": user["id"]},
        {"$unset": {f"notas.{aluno_id}": ""}},
    )
    return {"ok": True}

# ─── Teacher: Instrumentos ────────────────────────────────────────────────────

@api.get("/instrumentos")
async def get_instrumentos(user: dict = Depends(require_teacher)):
    docs = await db.instrumentos.find({"prof_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return docs

@api.post("/instrumentos")
async def add_instrumento(body: InstrumentoIn, user: dict = Depends(require_teacher)):
    doc = {
        "id": str(uuid.uuid4()),
        "prof_id": user["id"],
        "nome": body.nome.strip(),
        "tipo": body.tipo,
        "data": body.data,
        "questoes": [q.model_dump() for q in body.questoes],
        "notas": {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.instrumentos.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/instrumentos/{inst_id}/notas")
async def update_notas(inst_id: str, body: NotasUpdate, user: dict = Depends(require_teacher)):
    res = await db.instrumentos.update_one(
        {"id": inst_id, "prof_id": user["id"]},
        {"$set": {"notas": body.notas}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Instrumento não encontrado")
    return {"ok": True}

@api.delete("/instrumentos/{inst_id}")
async def delete_instrumento(inst_id: str, user: dict = Depends(require_teacher)):
    res = await db.instrumentos.delete_one({"id": inst_id, "prof_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Instrumento não encontrado")
    return {"ok": True}

# ─── Teacher: Ponderacoes ─────────────────────────────────────────────────────

@api.get("/ponderacoes")
async def get_pond(user: dict = Depends(require_teacher)):
    doc = await db.ponderacoes.find_one({"prof_id": user["id"]}, {"_id": 0})
    if not doc:
        doc = {"prof_id": user["id"], "CP": 50, "RRP": 25, "CM": 10, "ER": 15}
        await db.ponderacoes.insert_one(doc.copy())
    return {"CP": doc["CP"], "RRP": doc["RRP"], "CM": doc["CM"], "ER": doc["ER"]}

@api.put("/ponderacoes")
async def set_pond(body: Ponderacoes, user: dict = Depends(require_teacher)):
    total = body.CP + body.RRP + body.CM + body.ER
    if total != 100:
        raise HTTPException(status_code=400, detail="A soma das ponderações deve ser 100%")
    await db.ponderacoes.update_one(
        {"prof_id": user["id"]},
        {"$set": {**body.model_dump(), "prof_id": user["id"]}},
        upsert=True,
    )
    return body.model_dump()

# ─── Health ───────────────────────────────────────────────────────────────────

@api.get("/")
async def root():
    return {"message": "Grelhas API"}

app.include_router(api)

# ─── Startup: seed admin & indexes ────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.alunos.create_index("prof_id")
    await db.instrumentos.create_index("prof_id")
    await db.ponderacoes.create_index("prof_id", unique=True)

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@escola.pt").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "nome": "Administrador",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        log.info(f"Seeded admin: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )
        log.info("Admin password updated from env")

@app.on_event("shutdown")
async def shutdown():
    client.close()
