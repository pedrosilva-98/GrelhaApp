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
from typing import List, Optional, Dict

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# ─── DB ───────────────────────────────────────────────────────────────────────
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
ACCESS_MIN = 60 * 24 * 7

DEFAULT_DOMINIOS = [
    {"code": "CP", "nome": "Conceitos e Procedimentos", "peso": 50},
    {"code": "RRP", "nome": "Raciocínio e Resolução de Problemas", "peso": 25},
    {"code": "CM", "nome": "Comunicação Matemática", "peso": 10},
    {"code": "ER", "nome": "Ético-Relacional", "peso": 15},
]

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
        "sub": user_id, "email": email, "role": role,
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

async def get_turma_or_404(turma_id: str, user: dict) -> dict:
    t = await db.turmas.find_one({"id": turma_id, "prof_id": user["id"]}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Turma não encontrada")
    if "dominios" not in t or not t["dominios"]:
        t["dominios"] = [dict(d) for d in DEFAULT_DOMINIOS]
    return t

# ─── Models ───────────────────────────────────────────────────────────────────

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TeacherCreate(BaseModel):
    email: EmailStr
    password: str
    nome: str
    agrupamento: str = ""

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class PasswordReset(BaseModel):
    new_password: str

class TurmaCreate(BaseModel):
    disciplina: str
    ano: str
    turma: str

class TurmaUpdate(BaseModel):
    disciplina: Optional[str] = None
    ano: Optional[str] = None
    turma: Optional[str] = None

class DominioItem(BaseModel):
    code: str
    nome: str
    peso: int = Field(ge=0, le=100)

class DominiosUpdate(BaseModel):
    dominios: List[DominioItem]

class CompetenciaItem(BaseModel):
    code: str
    nome: str

class CompetenciasUpdate(BaseModel):
    competencias: List[CompetenciaItem]

class SemestreConfig(BaseModel):
    inicio: str = ""    # ISO date "YYYY-MM-DD" or ""
    fim: str = ""       # ISO date "YYYY-MM-DD" or ""
    peso: int = Field(default=50, ge=0, le=100)

class ParametroOD(BaseModel):
    id: str
    nome: str
    dom: Optional[str] = None  # default domain (optional; may be per-instrument)

class TurmaConfigUpdate(BaseModel):
    semestres: Optional[Dict[str, SemestreConfig]] = None       # keys "1" and "2"
    parametros_od: Optional[List[ParametroOD]] = None
    meta_sucesso: Optional[float] = None

class AlunoIn(BaseModel):
    nome: str
    data_nascimento: Optional[str] = None
    n_processo: Optional[str] = None

class MedidasEducacaoEspecial(BaseModel):
    universais: List[str] = []
    adicionais: List[str] = []
    seletivas: List[str] = []

class AlunoUpdate(BaseModel):
    nome: Optional[str] = None
    data_nascimento: Optional[str] = None
    n_processo: Optional[str] = None
    medidas: Optional[MedidasEducacaoEspecial] = None

class AlunosBulkIn(BaseModel):
    # Backwards-compat: `nomes` (strings). New: `alunos` (objects with nome + optional data_nascimento + n_processo)
    nomes: Optional[List[str]] = None
    alunos: Optional[List[AlunoIn]] = None

class Questao(BaseModel):
    id: str
    dom: str
    cotacao: float
    comp: Optional[str] = None  # competência code (optional)

class ObservacaoNota(BaseModel):
    parametro_id: str
    dom: str
    nota: Optional[float] = None  # 0-10

class InstrumentoIn(BaseModel):
    nome: str
    tipo: str
    data: str = ""
    semestre: Optional[int] = None  # 1 or 2
    questoes: List[Questao]
    observacao_direta: Optional[List[ObservacaoNota]] = None

class InstrumentoUpdate(BaseModel):
    nome: Optional[str] = None
    tipo: Optional[str] = None
    data: Optional[str] = None
    semestre: Optional[int] = None
    questoes: Optional[List[Questao]] = None
    observacao_direta: Optional[List[ObservacaoNota]] = None

class NotasUpdate(BaseModel):
    notas: Dict[str, Dict[str, float]]

class ODAvaliacaoUpdate(BaseModel):
    dom: Optional[str] = None
    notas: Optional[Dict[str, Optional[float]]] = None  # aluno_id -> nota (0-10) or None to clear
    semestre: Optional[int] = None  # 1 or 2 or null

# ─── Auth ─────────────────────────────────────────────────────────────────────

@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    token = create_token(user["id"], user["email"], user["role"])
    safe = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    return {"access_token": token, "token_type": "bearer", "user": safe}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}

@api.post("/auth/change-password")
async def change_password(body: PasswordChange, user: dict = Depends(get_current_user)):
    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="A nova palavra-passe deve ter pelo menos 4 caracteres")
    full = await db.users.find_one({"id": user["id"]})
    if not full or not verify_password(body.current_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Palavra-passe atual incorreta")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}

# ─── Admin ────────────────────────────────────────────────────────────────────

@api.get("/admin/teachers")
async def list_teachers(_: dict = Depends(require_admin)):
    return await db.users.find({"role": "teacher"}, {"_id": 0, "password_hash": 0}).to_list(1000)

@api.post("/admin/teachers")
async def create_teacher(body: TeacherCreate, _: dict = Depends(require_admin)):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email já registado")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": hash_password(body.password),
        "nome": body.nome.strip(),
        "agrupamento": (body.agrupamento or "").strip(),
        "role": "teacher",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    return {k: v for k, v in doc.items() if k != "password_hash"}

@api.delete("/admin/teachers/{teacher_id}")
async def delete_teacher(teacher_id: str, _: dict = Depends(require_admin)):
    res = await db.users.delete_one({"id": teacher_id, "role": "teacher"})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    turma_ids = [t["id"] for t in await db.turmas.find({"prof_id": teacher_id}, {"id": 1}).to_list(1000)]
    if turma_ids:
        await db.alunos.delete_many({"turma_id": {"$in": turma_ids}})
        await db.instrumentos.delete_many({"turma_id": {"$in": turma_ids}})
    await db.turmas.delete_many({"prof_id": teacher_id})
    return {"ok": True}

@api.post("/admin/teachers/{teacher_id}/reset-password")
async def reset_teacher_password(teacher_id: str, body: PasswordReset, _: dict = Depends(require_admin)):
    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="A palavra-passe deve ter pelo menos 4 caracteres")
    res = await db.users.update_one(
        {"id": teacher_id, "role": "teacher"},
        {"$set": {"password_hash": hash_password(body.new_password)}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Professor não encontrado")
    return {"ok": True}

# ─── Turmas ───────────────────────────────────────────────────────────────────

@api.get("/turmas")
async def list_turmas(user: dict = Depends(require_teacher)):
    docs = await db.turmas.find({"prof_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    for d in docs:
        if "dominios" not in d or not d["dominios"]:
            d["dominios"] = [dict(x) for x in DEFAULT_DOMINIOS]
    return docs

@api.post("/turmas")
async def create_turma(body: TurmaCreate, user: dict = Depends(require_teacher)):
    doc = {
        "id": str(uuid.uuid4()),
        "prof_id": user["id"],
        "disciplina": body.disciplina.strip(),
        "ano": body.ano.strip(),
        "turma": body.turma.strip(),
        "dominios": [dict(d) for d in DEFAULT_DOMINIOS],
        "competencias": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.turmas.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.post("/turmas/{turma_id}/duplicate")
async def duplicate_turma(turma_id: str, user: dict = Depends(require_teacher)):
    src = await get_turma_or_404(turma_id, user)
    doc = {
        "id": str(uuid.uuid4()),
        "prof_id": user["id"],
        "disciplina": src.get("disciplina", ""),
        "ano": src.get("ano", ""),
        "turma": (src.get("turma", "") + " (cópia)").strip(),
        "dominios": [dict(d) for d in (src.get("dominios") or DEFAULT_DOMINIOS)],
        "competencias": [dict(c) for c in (src.get("competencias") or [])],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.turmas.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/turmas/{turma_id}")
async def update_turma(turma_id: str, body: TurmaUpdate, user: dict = Depends(require_teacher)):
    await get_turma_or_404(turma_id, user)
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if updates:
        await db.turmas.update_one({"id": turma_id, "prof_id": user["id"]}, {"$set": updates})
    return await db.turmas.find_one({"id": turma_id, "prof_id": user["id"]}, {"_id": 0})

@api.put("/turmas/{turma_id}/dominios")
async def update_dominios(turma_id: str, body: DominiosUpdate, user: dict = Depends(require_teacher)):
    turma = await get_turma_or_404(turma_id, user)
    if not body.dominios:
        raise HTTPException(status_code=400, detail="Deve existir pelo menos um domínio")
    total = sum(int(d.peso) for d in body.dominios)
    if total != 100:
        raise HTTPException(status_code=400, detail=f"A soma das ponderações deve ser 100% (atual: {total}%)")
    # Unique codes
    codes = [d.code.strip() for d in body.dominios]
    if any(not c for c in codes):
        raise HTTPException(status_code=400, detail="Cada domínio precisa de um código")
    if len(set(codes)) != len(codes):
        raise HTTPException(status_code=400, detail="Códigos de domínio duplicados")
    # Prevent removing a domain still referenced by any instrumento questão
    new_codes = set(codes)
    old_codes = {d["code"] for d in (turma.get("dominios") or [])}
    removed = old_codes - new_codes
    if removed:
        insts = await db.instrumentos.find(
            {"turma_id": turma_id, "questoes.dom": {"$in": list(removed)}},
            {"_id": 0, "nome": 1},
        ).to_list(1000)
        if insts:
            names = ", ".join(i.get("nome", "?") for i in insts[:3])
            raise HTTPException(
                status_code=400,
                detail=f"Não é possível remover domínios ainda usados em instrumentos ({names}). Edite ou elimine esses instrumentos primeiro.",
            )
    new_dominios = [{"code": d.code.strip(), "nome": d.nome.strip(), "peso": int(d.peso)} for d in body.dominios]
    await db.turmas.update_one(
        {"id": turma_id, "prof_id": user["id"]},
        {"$set": {"dominios": new_dominios}},
    )
    return {"dominios": new_dominios}

@api.put("/turmas/{turma_id}/competencias")
async def update_competencias(turma_id: str, body: CompetenciasUpdate, user: dict = Depends(require_teacher)):
    turma = await get_turma_or_404(turma_id, user)
    # Unique non-empty codes
    codes = [c.code.strip() for c in body.competencias]
    if any(not c for c in codes):
        raise HTTPException(status_code=400, detail="Cada competência precisa de um código")
    if len(set(codes)) != len(codes):
        raise HTTPException(status_code=400, detail="Códigos de competência duplicados")
    # Prevent removing a competencia still referenced by any instrumento questão
    new_codes = set(codes)
    old_codes = {c["code"] for c in (turma.get("competencias") or [])}
    removed = old_codes - new_codes
    if removed:
        insts = await db.instrumentos.find(
            {"turma_id": turma_id, "questoes.comp": {"$in": list(removed)}},
            {"_id": 0, "nome": 1},
        ).to_list(1000)
        if insts:
            names = ", ".join(i.get("nome", "?") for i in insts[:3])
            raise HTTPException(
                status_code=400,
                detail=f"Não é possível remover competências ainda usadas em instrumentos ({names}). Edite ou elimine esses instrumentos primeiro.",
            )
    new_comps = [{"code": c.code.strip(), "nome": c.nome.strip()} for c in body.competencias]
    await db.turmas.update_one(
        {"id": turma_id, "prof_id": user["id"]},
        {"$set": {"competencias": new_comps}},
    )
    return {"competencias": new_comps}

@api.put("/turmas/{turma_id}/config")
async def update_turma_config(turma_id: str, body: TurmaConfigUpdate, user: dict = Depends(require_teacher)):
    await get_turma_or_404(turma_id, user)
    updates = {}
    if body.semestres is not None:
        # Expect keys "1" and "2"; validate that if both weights set, sum == 100
        sem = {}
        for k, v in body.semestres.items():
            if k not in ("1", "2"):
                raise HTTPException(status_code=400, detail="Chave de semestre inválida (usar '1' ou '2')")
            if v.inicio and v.fim and v.inicio > v.fim:
                raise HTTPException(status_code=400, detail=f"{k}º Semestre: data de início posterior à data de fim")
            sem[k] = {"inicio": v.inicio, "fim": v.fim, "peso": int(v.peso)}
        if "1" in sem and "2" in sem:
            total = sem["1"]["peso"] + sem["2"]["peso"]
            if total != 100:
                raise HTTPException(status_code=400, detail=f"A soma dos pesos dos semestres deve ser 100% (atual: {total}%)")
        updates["semestres"] = sem
    if body.parametros_od is not None:
        ids = [p.id.strip() for p in body.parametros_od]
        if any(not i for i in ids):
            raise HTTPException(status_code=400, detail="Cada parâmetro precisa de um identificador")
        if len(set(ids)) != len(ids):
            raise HTTPException(status_code=400, detail="Identificadores de parâmetro duplicados")
        updates["parametros_od"] = [
            {"id": p.id.strip(), "nome": p.nome.strip(), "dom": (p.dom or "").strip() or None}
            for p in body.parametros_od
        ]
    if body.meta_sucesso is not None:
        if body.meta_sucesso < 0 or body.meta_sucesso > 100:
            raise HTTPException(status_code=400, detail="Meta de sucesso deve estar entre 0 e 100%")
        updates["meta_sucesso"] = float(body.meta_sucesso)
    if updates:
        await db.turmas.update_one({"id": turma_id, "prof_id": user["id"]}, {"$set": updates})
    return await db.turmas.find_one({"id": turma_id, "prof_id": user["id"]}, {"_id": 0})


@api.put("/turmas/{turma_id}/od/{parametro_id}")
async def update_od_avaliacao(turma_id: str, parametro_id: str, body: ODAvaliacaoUpdate, user: dict = Depends(require_teacher)):
    turma = await get_turma_or_404(turma_id, user)
    valid_ids = {p["id"] for p in (turma.get("parametros_od") or [])}
    if parametro_id not in valid_ids:
        raise HTTPException(status_code=400, detail="Parâmetro de observação desconhecido")
    valid_doms = {d["code"] for d in turma.get("dominios", DEFAULT_DOMINIOS)}
    od_all = dict(turma.get("od_avaliacoes") or {})
    current = dict(od_all.get(parametro_id) or {})
    if body.dom is not None:
        if body.dom and body.dom not in valid_doms:
            raise HTTPException(status_code=400, detail=f"Domínio desconhecido: {body.dom}")
        current["dom"] = body.dom or None
    if body.semestre is not None:
        if body.semestre not in (0, 1, 2):
            raise HTTPException(status_code=400, detail="Semestre inválido (usar 1, 2 ou nulo)")
        current["semestre"] = body.semestre or None
    if body.notas is not None:
        cleaned = dict(current.get("notas") or {})
        for aluno_id, nota in body.notas.items():
            if nota is None or nota == "":
                cleaned.pop(aluno_id, None)
                continue
            try:
                n = float(nota)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"Nota inválida para aluno {aluno_id}")
            if n < 0 or n > 10:
                raise HTTPException(status_code=400, detail=f"Nota fora de 0-10 para aluno {aluno_id}")
            cleaned[aluno_id] = n
        current["notas"] = cleaned
    od_all[parametro_id] = current
    await db.turmas.update_one({"id": turma_id, "prof_id": user["id"]}, {"$set": {"od_avaliacoes": od_all}})
    return {"parametro_id": parametro_id, **current}



@api.delete("/turmas/{turma_id}")
async def delete_turma(turma_id: str, user: dict = Depends(require_teacher)):
    await get_turma_or_404(turma_id, user)
    await db.alunos.delete_many({"turma_id": turma_id})
    await db.instrumentos.delete_many({"turma_id": turma_id})
    await db.turmas.delete_one({"id": turma_id, "prof_id": user["id"]})
    return {"ok": True}

# ─── Alunos ───────────────────────────────────────────────────────────────────

@api.get("/alunos")
async def get_alunos(turma_id: str = Query(...), user: dict = Depends(require_teacher)):
    await get_turma_or_404(turma_id, user)
    return await db.alunos.find({"turma_id": turma_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)

@api.post("/alunos")
async def add_aluno(body: AlunoIn, turma_id: str = Query(...), user: dict = Depends(require_teacher)):
    await get_turma_or_404(turma_id, user)
    doc = {
        "id": str(uuid.uuid4()),
        "turma_id": turma_id,
        "nome": body.nome.strip(),
        "data_nascimento": (body.data_nascimento or "").strip(),
        "n_processo": (body.n_processo or "").strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.alunos.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.post("/alunos/bulk")
async def add_alunos_bulk(body: AlunosBulkIn, turma_id: str = Query(...), user: dict = Depends(require_teacher)):
    await get_turma_or_404(turma_id, user)
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    if body.alunos:
        for a in body.alunos:
            nome = (a.nome or "").strip()
            if not nome:
                continue
            docs.append({
                "id": str(uuid.uuid4()),
                "turma_id": turma_id,
                "nome": nome,
                "data_nascimento": (a.data_nascimento or "").strip(),
                "n_processo": (a.n_processo or "").strip(),
                "created_at": now,
            })
    elif body.nomes:
        for n in body.nomes:
            n = (n or "").strip()
            if not n:
                continue
            docs.append({
                "id": str(uuid.uuid4()),
                "turma_id": turma_id,
                "nome": n,
                "created_at": now,
            })
    if not docs:
        return {"inserted": 0, "alunos": []}
    await db.alunos.insert_many([dict(d) for d in docs])
    return {"inserted": len(docs), "alunos": docs}


@api.put("/alunos/{aluno_id}")
async def update_aluno(aluno_id: str, body: AlunoUpdate, user: dict = Depends(require_teacher)):
    aluno = await db.alunos.find_one({"id": aluno_id}, {"_id": 0})
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    await get_turma_or_404(aluno["turma_id"], user)
    updates = {}
    if body.nome is not None:
        updates["nome"] = body.nome.strip()
    if body.data_nascimento is not None:
        updates["data_nascimento"] = (body.data_nascimento or "").strip()
    if body.n_processo is not None:
        updates["n_processo"] = (body.n_processo or "").strip()
    if body.medidas is not None:
        updates["medidas"] = {
            "universais": [m.strip() for m in body.medidas.universais if m and m.strip()],
            "adicionais": [m.strip() for m in body.medidas.adicionais if m and m.strip()],
            "seletivas": [m.strip() for m in body.medidas.seletivas if m and m.strip()],
        }
    if updates:
        await db.alunos.update_one({"id": aluno_id}, {"$set": updates})
    return await db.alunos.find_one({"id": aluno_id}, {"_id": 0})


@api.delete("/alunos/{aluno_id}")
async def delete_aluno(aluno_id: str, user: dict = Depends(require_teacher)):
    aluno = await db.alunos.find_one({"id": aluno_id}, {"_id": 0})
    if not aluno:
        raise HTTPException(status_code=404, detail="Aluno não encontrado")
    await get_turma_or_404(aluno["turma_id"], user)
    await db.alunos.delete_one({"id": aluno_id})
    await db.instrumentos.update_many(
        {"turma_id": aluno["turma_id"]},
        {"$unset": {f"notas.{aluno_id}": ""}},
    )
    return {"ok": True}

# ─── Instrumentos ─────────────────────────────────────────────────────────────

@api.get("/instrumentos")
async def get_instrumentos(turma_id: str = Query(...), user: dict = Depends(require_teacher)):
    await get_turma_or_404(turma_id, user)
    return await db.instrumentos.find({"turma_id": turma_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)

def _validate_semestre_date(turma: dict, semestre: Optional[int], data: str):
    """Ensure inst.data lies within the configured semestre range (if configured)."""
    if not semestre or not data:
        return
    sems = (turma.get("semestres") or {})
    key = str(semestre)
    if key not in sems:
        return
    inicio = sems[key].get("inicio") or ""
    fim = sems[key].get("fim") or ""
    if inicio and data < inicio:
        raise HTTPException(status_code=400, detail=f"A data do instrumento é anterior ao início do {key}º Semestre ({inicio}).")
    if fim and data > fim:
        raise HTTPException(status_code=400, detail=f"A data do instrumento é posterior ao fim do {key}º Semestre ({fim}).")


def _validate_observacao_direta(turma: dict, ods: Optional[List[ObservacaoNota]]):
    if not ods:
        return
    valid_ids = {p["id"] for p in (turma.get("parametros_od") or [])}
    valid_doms = {d["code"] for d in turma.get("dominios", DEFAULT_DOMINIOS)}
    for od in ods:
        if od.parametro_id not in valid_ids:
            raise HTTPException(status_code=400, detail=f"Parâmetro de observação desconhecido: {od.parametro_id}")
        if od.dom not in valid_doms:
            raise HTTPException(status_code=400, detail=f"Domínio desconhecido na observação direta: {od.dom}")
        if od.nota is not None and (od.nota < 0 or od.nota > 10):
            raise HTTPException(status_code=400, detail="Nota da observação direta deve estar entre 0 e 10")


@api.post("/instrumentos")
async def add_instrumento(body: InstrumentoIn, turma_id: str = Query(...), user: dict = Depends(require_teacher)):
    turma = await get_turma_or_404(turma_id, user)
    valid_doms = {d["code"] for d in turma.get("dominios", DEFAULT_DOMINIOS)}
    valid_comps = {c["code"] for c in (turma.get("competencias") or [])}
    for q in body.questoes:
        if q.dom not in valid_doms:
            raise HTTPException(status_code=400, detail=f"Domínio desconhecido: {q.dom}")
        if q.comp and q.comp not in valid_comps:
            raise HTTPException(status_code=400, detail=f"Competência desconhecida: {q.comp}")
    if body.semestre is not None and body.semestre not in (1, 2):
        raise HTTPException(status_code=400, detail="Semestre inválido (deve ser 1 ou 2)")
    _validate_semestre_date(turma, body.semestre, body.data)
    _validate_observacao_direta(turma, body.observacao_direta)
    doc = {
        "id": str(uuid.uuid4()),
        "turma_id": turma_id,
        "nome": body.nome.strip(),
        "tipo": body.tipo,
        "data": body.data,
        "semestre": body.semestre,
        "questoes": [q.model_dump() for q in body.questoes],
        "observacao_direta": [o.model_dump() for o in (body.observacao_direta or [])],
        "notas": {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.instrumentos.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/instrumentos/{inst_id}")
async def update_instrumento(inst_id: str, body: InstrumentoUpdate, user: dict = Depends(require_teacher)):
    inst = await db.instrumentos.find_one({"id": inst_id}, {"_id": 0})
    if not inst:
        raise HTTPException(status_code=404, detail="Instrumento não encontrado")
    turma = await get_turma_or_404(inst["turma_id"], user)
    updates = {}
    if body.nome is not None:
        updates["nome"] = body.nome.strip()
    if body.tipo is not None:
        updates["tipo"] = body.tipo
    if body.data is not None:
        updates["data"] = body.data
    if body.semestre is not None:
        if body.semestre not in (1, 2):
            raise HTTPException(status_code=400, detail="Semestre inválido (deve ser 1 ou 2)")
        updates["semestre"] = body.semestre
    # Validate final date against final semestre after applying updates
    final_data = updates.get("data", inst.get("data", ""))
    final_sem = updates.get("semestre", inst.get("semestre"))
    _validate_semestre_date(turma, final_sem, final_data)
    if body.questoes is not None:
        valid_doms = {d["code"] for d in turma.get("dominios", DEFAULT_DOMINIOS)}
        valid_comps = {c["code"] for c in (turma.get("competencias") or [])}
        for q in body.questoes:
            if q.dom not in valid_doms:
                raise HTTPException(status_code=400, detail=f"Domínio desconhecido: {q.dom}")
            if q.comp and q.comp not in valid_comps:
                raise HTTPException(status_code=400, detail=f"Competência desconhecida: {q.comp}")
        new_q_ids = {q.id for q in body.questoes}
        updates["questoes"] = [q.model_dump() for q in body.questoes]
        # Trim notas: keep only entries with q_id in new_q_ids
        existing_notas = inst.get("notas") or {}
        cleaned = {}
        for aid, m in existing_notas.items():
            filt = {k: v for k, v in m.items() if k in new_q_ids}
            if filt:
                cleaned[aid] = filt
        updates["notas"] = cleaned
    if body.observacao_direta is not None:
        _validate_observacao_direta(turma, body.observacao_direta)
        updates["observacao_direta"] = [o.model_dump() for o in body.observacao_direta]
    if updates:
        await db.instrumentos.update_one({"id": inst_id}, {"$set": updates})
    return await db.instrumentos.find_one({"id": inst_id}, {"_id": 0})

@api.put("/instrumentos/{inst_id}/notas")
async def update_notas(inst_id: str, body: NotasUpdate, user: dict = Depends(require_teacher)):
    inst = await db.instrumentos.find_one({"id": inst_id}, {"_id": 0})
    if not inst:
        raise HTTPException(status_code=404, detail="Instrumento não encontrado")
    await get_turma_or_404(inst["turma_id"], user)
    await db.instrumentos.update_one({"id": inst_id}, {"$set": {"notas": body.notas}})
    return {"ok": True}

@api.delete("/instrumentos/{inst_id}")
async def delete_instrumento(inst_id: str, user: dict = Depends(require_teacher)):
    inst = await db.instrumentos.find_one({"id": inst_id}, {"_id": 0})
    if not inst:
        raise HTTPException(status_code=404, detail="Instrumento não encontrado")
    await get_turma_or_404(inst["turma_id"], user)
    await db.instrumentos.delete_one({"id": inst_id})
    return {"ok": True}

# ─── Health ───────────────────────────────────────────────────────────────────

@api.get("/")
async def root():
    return {"message": "Grelhas API"}

app.include_router(api)

# ─── Startup ──────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.turmas.create_index("prof_id")
    await db.turmas.create_index("id", unique=True)
    await db.alunos.create_index("turma_id")
    await db.instrumentos.create_index("turma_id")

    admin_email = os.environ.get("ADMIN_EMAIL", "").lower().strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    if not admin_email or not admin_password:
        log.warning("ADMIN_EMAIL/ADMIN_PASSWORD not set — admin not seeded")
        return
    # Remove any other admins to keep exactly one
    await db.users.delete_many({"role": "admin", "email": {"$ne": admin_email}})
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
    else:
        if existing.get("role") != "admin" or not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"role": "admin", "password_hash": hash_password(admin_password)}},
            )
            log.info(f"Updated admin credentials for {admin_email}")

@app.on_event("shutdown")
async def shutdown():
    client.close()
