// Grelha calculation library — dynamic domains, notes on 0-10 scale.
// Colors are cycled deterministically for domain codes.

export const NIVEIS = [
    { min: 90, label: "Muito Bom", n: 5, badge: "bg-[#E6F3E6] text-[#2E6B2E] border-[#B3D9B3]" },
    { min: 70, label: "Bom",       n: 4, badge: "bg-[#EBF4FA] text-[#2B5A84] border-[#B8D4EA]" },
    { min: 50, label: "Suficiente",n: 3, badge: "bg-[#FEF5E6] text-[#8A5A19] border-[#F7DBAA]" },
    { min: 20, label: "Insuficiente", n: 2, badge: "bg-[#FDF0ED] text-[#9E3921] border-[#F5C2B8]" },
    { min: 0, label: "Reduzido",   n: 1, badge: "bg-[#F4EBEB] text-[#7A2A2A] border-[#D9B3B3]" },
];

export const TIPOS_INSTRUMENTO = [
    "Avaliação Sumativa",
    "Avaliação Formativa",
    "Questão de Aula",
    "Trabalhos Individuais ou de Grupo",
    "Avaliação de Diagnóstico",
    "Rubricas",
    "Trabalhos de Pesquisa",
    "Relatórios",
];

// Tipos cujos resultados não contam para a avaliação final — continuam a admitir
// classificações e geração de relatórios, tal como os restantes tipos de instrumento.
export const TIPOS_SEM_NOTA_FINAL = ["Avaliação Formativa", "Avaliação de Diagnóstico"];

export function contaParaFinal(inst) {
    return !TIPOS_SEM_NOTA_FINAL.includes(inst?.tipo);
}

// Filtra instrumentos que contam para a avaliação final — usar antes de agregar médias globais.
export function instsParaFinal(insts) {
    return (insts || []).filter(contaParaFinal);
}

// Palette to pick colors for domains by index
export const DOM_PALETTE = ["#2C4A3B", "#6B8BA4", "#D99E41", "#C86A53", "#8A9A86", "#7B4F8C", "#B0754F", "#446B84"];

export function domColor(index) {
    return DOM_PALETTE[index % DOM_PALETTE.length];
}

// Nota input scale
export const NOTA_MAX = 10;

// Filter instrumentos by semestre (1 or 2). If sem is null/undefined => no filter.
// Includes instruments whose `semestre` matches OR (if no explicit semestre stored)
// whose `data` falls within the semestre range configured on the turma.
export function filterBySemestre(insts, sem, turma) {
    if (!sem) return insts;
    const range = (turma?.semestres || {})[String(sem)] || null;
    return insts.filter((i) => {
        if (i.semestre === sem) return true;
        if (i.semestre != null && i.semestre !== sem) return false;
        // No semestre stored → try date range
        if (range && i.data && range.inicio && range.fim) {
            return i.data >= range.inicio && i.data <= range.fim;
        }
        return false;
    });
}

// Observação Direta é guardada por parâmetro e por semestre:
// turma.od_avaliacoes[parametro_id]["1" | "2"] = { dom, notas: { aluno_id: 0-10 } }
export function odEntry(turma, parametroId, sem) {
    return turma?.od_avaliacoes?.[parametroId]?.[String(sem)] || {};
}

// Extract OD entries relevant to a domain for an aluno (with optional semestre filter).
// Returns array of {parametro_id, dom, semestre, nota (0-10)}.
export function odEntriesForAlunoInDom(turma, alunoId, domCode, sem) {
    const oda = turma?.od_avaliacoes || {};
    const out = [];
    for (const [pid, porSem] of Object.entries(oda)) {
        for (const s of [1, 2]) {
            const entry = porSem?.[String(s)];
            if (!entry || entry.dom !== domCode) continue;
            if (sem && s !== sem) continue;
            const nota = entry.notas?.[alunoId];
            if (nota == null || nota === "") continue;
            const n = Number(nota);
            if (Number.isNaN(n)) continue;
            out.push({ parametro_id: pid, dom: entry.dom, semestre: s, nota: n });
        }
    }
    return out;
}

export function getNivel(v) {
    if (v == null || Number.isNaN(v)) return null;
    return NIVEIS.find((x) => v >= x.min) || NIVEIS[NIVEIS.length - 1];
}

// Classificação (%) de um instrumento num domínio: cada nota (0-10) pondera-se pela cotação da questão.
// Includes both questões (per-student notas) and observacao_direta items on the instrument
// (whose nota is a single value applied to any student who has any nota registered).
export function calcDominioInstrumento(instrumento, alunoId, domCode) {
    const notas = instrumento.notas?.[alunoId];
    const qs = (instrumento.questoes || []).filter((q) => q.dom === domCode);
    const ods = (instrumento.observacao_direta || []).filter((o) => o.dom === domCode && o.nota != null && o.nota !== "");
    const tot = qs.reduce((s, q) => s + Number(q.cotacao || 0), 0) + ods.length * NOTA_MAX;
    if (!tot) return null;
    const anyNotaQ = notas && qs.some((q) => notas[q.id] != null && notas[q.id] !== "");
    const anyOD = ods.length > 0;
    if (!anyNotaQ && !anyOD) return null;
    let weighted = 0;
    if (notas) {
        weighted += qs.reduce((s, q) => {
            const nota = Number(notas[q.id] || 0);
            return s + (nota / NOTA_MAX) * Number(q.cotacao || 0);
        }, 0);
    }
    weighted += ods.reduce((s, o) => s + (Number(o.nota) / NOTA_MAX) * NOTA_MAX, 0);
    return (weighted / tot) * 100;
}

// Domain-level averages across all instruments (and turma OD) for an aluno.
// Optional 4th arg `turma` includes OD contributions from `turma.od_avaliacoes`.
// Optional 5th arg `sem` filters OD entries (1 or 2) — instruments filtering must be done by the caller.
export function calcMediasDominioAluno(insts, alunoId, dominios, turma, sem) {
    const out = {};
    for (const d of dominios) {
        const vals = [];
        for (const inst of insts) {
            const v = calcDominioInstrumento(inst, alunoId, d.code);
            if (v != null) vals.push(v);
        }
        // Add OD entries as one value each (nota/10*100)
        if (turma) {
            for (const od of odEntriesForAlunoInDom(turma, alunoId, d.code, sem)) {
                vals.push((od.nota / NOTA_MAX) * 100);
            }
        }
        out[d.code] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }
    return out;
}

// Combina médias por domínio na média final ponderada pelo peso de cada domínio
// (só entram os domínios que têm valor).
export function ponderarDominios(doms, dominios) {
    let total = 0, totalPond = 0;
    for (const d of dominios) {
        if (doms[d.code] != null && d.peso > 0) {
            total += doms[d.code] * (d.peso / 100);
            totalPond += d.peso / 100;
        }
    }
    return totalPond > 0 ? total / totalPond : null;
}

// Weighted final for an aluno using dominios (each dominio has peso)
export function calcMediaFinal(insts, dominios, alunoId, turma, sem) {
    return ponderarDominios(calcMediasDominioAluno(insts, alunoId, dominios, turma, sem), dominios);
}

// Avaliação quantitativa de UM instrumento: cada domínio pondera as questões pela cotação,
// e o global pondera os domínios pelo seu peso (tal como na avaliação final).
export function calcClassifInstrumento(instrumento, alunoId, dominios) {
    const doms = {};
    for (const d of dominios) doms[d.code] = calcDominioInstrumento(instrumento, alunoId, d.code);
    return ponderarDominios(doms, dominios);
}

// ─── Escala 0-20 (10º/11º/12º ano) ────────────────────────────────────────────
// Extrai o nível numérico de um texto de "ano" (ex: "10º" → 10).
export function anoNivel(ano) {
    const m = /(\d+)/.exec(String(ano || ""));
    return m ? parseInt(m[1], 10) : null;
}

// Turmas de 10º, 11º ou 12º ano usam a escala 0-20 e deixam de ter avaliação qualitativa.
export function isEscala20(turma) {
    const n = anoNivel(turma?.ano);
    return n != null && n >= 10 && n <= 12;
}

// Formata uma percentagem (0-100) na escala apropriada à turma:
// 0-20 (arredondado) para 10º-12º ano, percentagem nos restantes.
export function formatAvaliacao(pct, turma) {
    if (pct == null || Number.isNaN(pct)) return "—";
    if (isEscala20(turma)) return String(Math.round((pct / 100) * 20));
    return pct.toFixed(1) + "%";
}

// ─── Proposta de recuperação (IA) ─────────────────────────────────────────────
export const LIMIAR_RECUPERACAO = 60;

// % obtida por um aluno numa aprendizagem essencial de UM instrumento
// (notas 0-10 ponderadas pela cotação das questões associadas). null se não houver notas.
export function pctAprendizagem(instrumento, compCode, alunoId) {
    const qs = (instrumento.questoes || []).filter((q) => q.comp === compCode);
    const notas = instrumento.notas?.[alunoId] || {};
    const totCot = qs.reduce((s, q) => s + Number(q.cotacao || 0), 0);
    const anyNota = qs.some((q) => notas[q.id] != null && notas[q.id] !== "");
    if (!totCot || !anyNota) return null;
    const weighted = qs.reduce((s, q) => s + (Number(notas[q.id] || 0) / NOTA_MAX) * Number(q.cotacao || 0), 0);
    return (weighted / totCot) * 100;
}

function dataInstrumento(inst) {
    return `${inst.data || (inst.created_at || "").slice(0, 10)}|${inst.created_at || ""}`;
}

// Resumo (sem dados pessoais) do momento do aluno, enviado à IA:
// - domínio com pior média (instrumentos que contam para a final + OD)
// - aprendizagens essenciais cuja avaliação MAIS RECENTE (por data do instrumento) é < 60%
export function calcPerfilRecuperacao(turma, aluno, insts, dominios) {
    const doms = calcMediasDominioAluno(instsParaFinal(insts), aluno.id, dominios, turma);
    let dominioFraco = null;
    for (const d of dominios) {
        const v = doms[d.code];
        if (v != null && (!dominioFraco || v < dominioFraco.pct)) {
            dominioFraco = { code: d.code, nome: (d.nome || "").slice(0, 200), pct: Math.round(v * 10) / 10 };
        }
    }

    const ordenados = [...insts].sort((a, b) => dataInstrumento(b).localeCompare(dataInstrumento(a)));
    const aes = [];
    for (const c of turma?.competencias || []) {
        for (const inst of ordenados) {
            const pct = pctAprendizagem(inst, c.code, aluno.id);
            if (pct == null) continue;
            if (pct < LIMIAR_RECUPERACAO) aes.push({ code: c.code, nome: (c.nome || "").slice(0, 600), pct: Math.round(pct * 10) / 10 });
            break; // só conta o instrumento mais recente com notas para esta aprendizagem
        }
    }
    aes.sort((a, b) => a.pct - b.pct);

    return {
        disciplina: (turma?.disciplina || "").slice(0, 120),
        ano: (turma?.ano || "").slice(0, 20),
        dominio_fraco: dominioFraco,
        aes,
    };
}
