// Domain and level definitions

export const DOMINIOS = {
    CP: { nome: "Conceitos e Procedimentos", color: "#2C4A3B" },
    RRP: { nome: "Raciocínio e Resolução de Problemas", color: "#6B8BA4" },
    CM: { nome: "Comunicação Matemática", color: "#D99E41" },
    ER: { nome: "Ético-Relacional", color: "#C86A53" },
};

export const NIVEIS = [
    { min: 90, label: "Muito Bom", n: 5, badge: "bg-[#E6F3E6] text-[#2E6B2E] border-[#B3D9B3]" },
    { min: 70, label: "Bom", n: 4, badge: "bg-[#EBF4FA] text-[#2B5A84] border-[#B8D4EA]" },
    { min: 50, label: "Suficiente", n: 3, badge: "bg-[#FEF5E6] text-[#8A5A19] border-[#F7DBAA]" },
    { min: 20, label: "Insuficiente", n: 2, badge: "bg-[#FDF0ED] text-[#9E3921] border-[#F5C2B8]" },
    { min: 0, label: "Reduzido", n: 1, badge: "bg-[#F4EBEB] text-[#7A2A2A] border-[#D9B3B3]" },
];

export const TIPOS_INSTRUMENTO = [
    "F.Sumativa", "F.Formativa", "Q.Aula", "TPC", "OB.Direta", "F.Diagnóstica",
];

export const DOM_KEYS = ["CP", "RRP", "CM", "ER"];

export function getNivel(v) {
    if (v == null || Number.isNaN(v)) return null;
    return NIVEIS.find((x) => v >= x.min) || NIVEIS[NIVEIS.length - 1];
}

export function calcClassif(instrumento, alunoId) {
    const notas = instrumento.notas?.[alunoId];
    if (!notas) return null;
    const totCot = instrumento.questoes.reduce((s, q) => s + Number(q.cotacao || 0), 0);
    if (!totCot) return null;
    const totNota = instrumento.questoes.reduce((s, q) => s + Number(notas[q.id] || 0), 0);
    return (totNota / totCot) * 100;
}

export function calcDominiosInstrumento(instrumento, alunoId) {
    const notas = instrumento.notas?.[alunoId];
    const res = {};
    for (const d of DOM_KEYS) {
        if (!notas) { res[d] = null; continue; }
        const qs = instrumento.questoes.filter((q) => q.dom === d);
        const tot = qs.reduce((s, q) => s + Number(q.cotacao || 0), 0);
        if (!tot) { res[d] = null; continue; }
        const nota = qs.reduce((s, q) => s + Number(notas[q.id] || 0), 0);
        res[d] = (nota / tot) * 100;
    }
    return res;
}

export function calcMediasDominioAluno(insts, alunoId) {
    const buckets = { CP: [], RRP: [], CM: [], ER: [] };
    for (const inst of insts) {
        const doms = calcDominiosInstrumento(inst, alunoId);
        for (const d of DOM_KEYS) if (doms[d] != null) buckets[d].push(doms[d]);
    }
    const out = {};
    for (const d of DOM_KEYS) {
        out[d] = buckets[d].length
            ? buckets[d].reduce((s, v) => s + v, 0) / buckets[d].length
            : null;
    }
    return out;
}

export function calcMediaFinal(insts, ponderacoes, alunoId) {
    const doms = calcMediasDominioAluno(insts, alunoId);
    let total = 0, totalPond = 0;
    for (const d of DOM_KEYS) {
        if (doms[d] != null && ponderacoes[d] > 0) {
            total += doms[d] * (ponderacoes[d] / 100);
            totalPond += ponderacoes[d] / 100;
        }
    }
    return totalPond > 0 ? total / totalPond : null;
}
