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
];

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

export function getNivel(v) {
    if (v == null || Number.isNaN(v)) return null;
    return NIVEIS.find((x) => v >= x.min) || NIVEIS[NIVEIS.length - 1];
}

// Classification of an instrument for a student:
// Each questão has cotacao (weight). Nota is 0-10 for each questão.
// classif % = (sum(nota_i/10 * cot_i) / sum(cot_i)) * 100
export function calcClassif(instrumento, alunoId) {
    const notas = instrumento.notas?.[alunoId];
    if (!notas) return null;
    const totCot = instrumento.questoes.reduce((s, q) => s + Number(q.cotacao || 0), 0);
    if (!totCot) return null;
    // If no nota entered at all, return null
    const anyNota = instrumento.questoes.some((q) => notas[q.id] != null && notas[q.id] !== "");
    if (!anyNota) return null;
    const weighted = instrumento.questoes.reduce((s, q) => {
        const nota = Number(notas[q.id] || 0);
        return s + (nota / NOTA_MAX) * Number(q.cotacao || 0);
    }, 0);
    return (weighted / totCot) * 100;
}

// Same idea restricted to a domain code
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

// Domain-level averages across all instruments for an aluno
export function calcMediasDominioAluno(insts, alunoId, dominios) {
    const out = {};
    for (const d of dominios) {
        const vals = [];
        for (const inst of insts) {
            const v = calcDominioInstrumento(inst, alunoId, d.code);
            if (v != null) vals.push(v);
        }
        out[d.code] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    }
    return out;
}

// Weighted final for an aluno using dominios (each dominio has peso)
export function calcMediaFinal(insts, dominios, alunoId) {
    const doms = calcMediasDominioAluno(insts, alunoId, dominios);
    let total = 0, totalPond = 0;
    for (const d of dominios) {
        if (doms[d.code] != null && d.peso > 0) {
            total += doms[d.code] * (d.peso / 100);
            totalPond += d.peso / 100;
        }
    }
    return totalPond > 0 ? total / totalPond : null;
}
