"""Protótipo (Fase A) da proposta de recuperação com o Gemini.

Não faz parte da app: serve para afinar o prompt e ver a qualidade das questões
com perfis de aluno de exemplo (anónimos) antes de integrar no backend.

Uso (PowerShell):
    $env:GEMINI_API_KEY = "a-tua-chave"          # gerada em aistudio.google.com
    python backend/scripts/proposta_ia_prototipo.py --list-models
    python backend/scripts/proposta_ia_prototipo.py --dry-run          # só mostra o prompt
    python backend/scripts/proposta_ia_prototipo.py --caso 0 --n 5     # 1 caso
    python backend/scripts/proposta_ia_prototipo.py --n 5              # os 3 casos

Se os acentos aparecerem trocados no PowerShell, corre primeiro:  chcp 65001

Variáveis: GEMINI_API_KEY (obrigatória, exceto em --dry-run), GEMINI_MODEL (por omissão gemini-3.6-flash).
"""
import argparse
import json
import os
import re
import sys
import time

import requests

BASE = "https://generativelanguage.googleapis.com/v1beta"

# Perfis anónimos de exemplo. As AE aqui são só ilustrativas: na app vêm da turma (Configurar).
CASOS = [
    {
        "disciplina": "Matemática", "ano": "7º",
        "dominio_fraco": {"code": "RRP", "nome": "Raciocínio e Resolução de Problemas", "pct": 41},
        "aes": [
            {"code": "AE3", "nome": "Resolver problemas envolvendo proporcionalidade direta.", "pct": 35},
            {"code": "AE5", "nome": "Resolver equações do 1.º grau com uma incógnita.", "pct": 52},
        ],
    },
    {
        "disciplina": "Matemática A", "ano": "10º",
        "dominio_fraco": {"code": "CP", "nome": "Conceitos e Procedimentos", "pct": 48},
        "aes": [
            {"code": "AE2", "nome": "Determinar o domínio e o contradomínio de funções reais de variável real.", "pct": 40},
            {"code": "AE4", "nome": "Resolver inequações do 2.º grau.", "pct": 55},
        ],
    },
    {
        "disciplina": "Português", "ano": "9º",
        "dominio_fraco": {"code": "ESC", "nome": "Escrita", "pct": 45},
        "aes": [
            {"code": "AE1", "nome": "Redigir textos de opinião com introdução, desenvolvimento e conclusão.", "pct": 50},
            {"code": "AE6", "nome": "Utilizar corretamente os sinais de pontuação.", "pct": 38},
        ],
    },
]

SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "questoes": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "ae_code": {"type": "STRING"},
                    "tipo": {"type": "STRING"},
                    "enunciado": {"type": "STRING"},
                    "solucao": {"type": "STRING"},
                },
                "required": ["ae_code", "tipo", "enunciado", "solucao"],
            },
        }
    },
    "required": ["questoes"],
}


def ciclo_ensino(ano: str) -> str:
    m = re.search(r"\d+", ano or "")
    n = int(m.group()) if m else None
    if n is None:
        return ""
    if n <= 4:
        return "1.º ciclo do ensino básico"
    if n <= 6:
        return "2.º ciclo do ensino básico"
    if n <= 9:
        return "3.º ciclo do ensino básico"
    if n <= 12:
        return "ensino secundário"
    return ""


# Mesmo prompt que backend/server.py (prompt_proposta) — manter os dois iguais.
def build_prompt(caso: dict, n: int) -> str:
    aes = "\n".join(f"- {a['code']}: {a['nome']} (última avaliação: {a['pct']}%)" for a in caso["aes"])
    d = caso["dominio_fraco"]
    dom = f"- Domínio com mais dificuldade: {d['code']} - {d['nome']} ({d['pct']}%)\n" if d else ""
    ciclo = ciclo_ensino(caso["ano"])
    ano_limpo = re.sub(r"\s*ano\s*$", "", caso["ano"].strip(), flags=re.IGNORECASE)
    ano_txt = f"{ano_limpo} ano" + (f" ({ciclo})" if ciclo else "")
    return f"""És um professor experiente em Portugal a preparar uma atividade de recuperação.

Contexto do aluno (anónimo):
- Disciplina: {caso['disciplina']}
- Ano de escolaridade: {ano_txt}
{dom}- Aprendizagens essenciais com avaliação recente inferior a 60%:
{aes}

Tarefa: cria exatamente {n} questões de recuperação.

NÍVEL (o mais importante):
- Todas as questões têm de ter o nível de exigência que se espera de um aluno do {ano_txt}, de acordo com as Aprendizagens Essenciais e os programas em vigor em Portugal para esse ano e disciplina.
- "Recuperação" significa consolidar estas aprendizagens AO NÍVEL do {ano_limpo} ano. Não baixes o nível para anos anteriores nem transformes as questões em exercícios elementares ou de aplicação direta de uma fórmula.
- Usa o vocabulário, os conteúdos e o grau de formalização próprios do {ano_limpo} ano. No ensino secundário, as questões devem aproximar-se do nível de um teste ou exame nacional dessa disciplina, com raciocínio em vários passos.
- Antes de responder, revê cada questão: se parecer adequada a um ano inferior ao {ano_limpo} ano, torna-a mais exigente.

Regras:
- Usa APENAS as aprendizagens essenciais listadas acima; em cada questão indica o ae_code correspondente.
- Distribui as questões pelas aprendizagens, dando mais peso às que têm pior avaliação.
- Escreve em português de Portugal, com linguagem clara para o aluno.
- tipo: "resposta curta", "escolha múltipla" ou "problema". Numa escolha múltipla, inclui as opções A) B) C) D) no enunciado.
- Não dependas de imagens, gráficos nem tabelas.
- Escreve a matemática só com caracteres simples (ex.: x^2, >=, <=, raiz(9), pi, 3/4). Não uses símbolos Unicode especiais.
- "solucao": resolução resumida e CORRETA, destinada ao professor. Confirma os cálculos antes de responder.
"""


def call_gemini(prompt: str, model: str, key: str) -> dict:
    url = f"{BASE}/models/{model}:generateContent"
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": SCHEMA,
            "temperature": 0.7,
        },
    }
    # 429/503 são erros temporários (limite ou pico de procura): tenta de novo com espera crescente.
    for tentativa in range(1, 5):
        r = requests.post(url, headers={"x-goog-api-key": key, "Content-Type": "application/json"}, json=body, timeout=90)
        if r.status_code not in (429, 503) or tentativa == 4:
            break
        espera = 5 * tentativa
        print(f"  (erro {r.status_code} temporário, a tentar de novo em {espera}s...)")
        time.sleep(espera)
    if r.status_code != 200:
        raise SystemExit(f"Erro {r.status_code} do Gemini:\n{r.text[:800]}")
    data = r.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise SystemExit(f"Resposta inesperada:\n{json.dumps(data, ensure_ascii=False)[:800]}")
    return json.loads(text)


def caracteres_fora_do_pdf(texto: str) -> set:
    """Caracteres que a fonte padrão do jsPDF (WinAnsi/cp1252) não consegue desenhar."""
    fora = set()
    for ch in texto:
        try:
            ch.encode("cp1252")
        except UnicodeEncodeError:
            fora.add(ch)
    return fora


def mostrar(caso: dict, resultado: dict, n: int):
    qs = resultado.get("questoes", [])
    print(f"\n=== {caso['disciplina']} · {caso['ano']} ano · domínio fraco {caso['dominio_fraco']['code']} ===")
    if len(qs) != n:
        print(f"[!] Pedi {n} questões e vieram {len(qs)}.")
    codigos_validos = {a["code"] for a in caso["aes"]}
    for i, q in enumerate(qs, 1):
        aviso = "" if q["ae_code"] in codigos_validos else "  [!] AE fora da lista"
        print(f"\n{i}. [{q['ae_code']} · {q['tipo']}]{aviso}\n   {q['enunciado']}\n   Solução: {q['solucao']}")
    fora = caracteres_fora_do_pdf(" ".join(f"{q['enunciado']} {q['solucao']}" for q in qs))
    if fora:
        print(f"\n[!] Caracteres que o PDF atual não desenha: {' '.join(sorted(fora))}")
    else:
        print("\n[ok] Todos os caracteres são desenháveis no PDF atual.")


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=5, help="número de questões (1-10)")
    ap.add_argument("--caso", type=int, help="índice do caso (0-2); omitido = todos")
    ap.add_argument("--dry-run", action="store_true", help="mostra o prompt sem chamar a API")
    ap.add_argument("--list-models", action="store_true", help="lista os modelos disponíveis para a tua chave")
    args = ap.parse_args()
    if not 1 <= args.n <= 10:
        sys.exit("--n tem de estar entre 1 e 10")

    key = os.environ.get("GEMINI_API_KEY", "")
    model = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")

    if args.list_models:
        if not key:
            sys.exit("Define GEMINI_API_KEY.")
        r = requests.get(f"{BASE}/models", headers={"x-goog-api-key": key}, timeout=30)
        if r.status_code != 200:
            sys.exit(f"Erro {r.status_code}: {r.text[:500]}")
        for m in r.json().get("models", []):
            if "generateContent" in m.get("supportedGenerationMethods", []):
                print(m["name"].removeprefix("models/"))
        return

    casos = [CASOS[args.caso]] if args.caso is not None else CASOS
    for caso in casos:
        prompt = build_prompt(caso, args.n)
        if args.dry_run:
            print(f"\n----- PROMPT ({caso['disciplina']} {caso['ano']}) -----\n{prompt}")
            continue
        if not key:
            sys.exit("Define GEMINI_API_KEY (ou usa --dry-run).")
        inicio = time.time()
        resultado = call_gemini(prompt, model, key)
        mostrar(caso, resultado, args.n)
        print(f"({time.time() - inicio:.1f}s · modelo {model})")


if __name__ == "__main__":
    main()
