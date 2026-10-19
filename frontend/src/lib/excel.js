import * as XLSX from "xlsx";
import { calcDominioInstrumento, calcClassifInstrumento, aplicaAluno, isEscala20, odEntry, nomeAprendizagem } from "@/lib/grelha";

// Cópia de segurança em Excel das classificações lançadas.

function nomeFolha(nome, usados) {
    // Excel: máx. 31 caracteres, sem : \ / ? * [ ] e nomes únicos.
    const base = (String(nome || "Folha").replace(/[:\\/?*[\]]/g, " ").trim() || "Folha").slice(0, 28);
    let n = base, i = 2;
    while (usados.has(n.toLowerCase())) n = `${base.slice(0, 26)} ${i++}`;
    usados.add(n.toLowerCase());
    return n;
}

function valorEscala(pct, escala20) {
    if (pct == null || Number.isNaN(pct)) return "";
    return Math.round((escala20 ? pct / 5 : pct) * 10) / 10;
}

function fmtData(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || "");
}

function folhaInstrumento({ turma, alunos, inst, dominios }) {
    const escala20 = isEscala20(turma);
    const unidade = escala20 ? "0-20" : "%";
    const questoes = inst.questoes || [];
    const linhas = [
        [inst.nome],
        ["Tipo", inst.tipo || "", "Data", fmtData(inst.data), "Semestre", inst.semestre ? `${inst.semestre}º` : ""],
        ["Notas de 0 a 10 por questão."],
        [],
        [
            "Nº", "Aluno",
            ...questoes.map((q) => `${q.id} (${q.dom} · ${q.cotacao} pts)`),
            ...dominios.map((d) => `${d.code} (${unidade})`),
            `Avaliação (${unidade})`,
        ],
    ];
    for (const a of alunos.filter((x) => aplicaAluno(inst, x.id))) {
        const notas = inst.notas?.[a.id] || {};
        linhas.push([
            a.numero ?? "", a.nome,
            ...questoes.map((q) => (notas[q.id] != null && notas[q.id] !== "" ? Number(notas[q.id]) : "")),
            ...dominios.map((d) => valorEscala(calcDominioInstrumento(inst, a.id, d.code), escala20)),
            valorEscala(calcClassifInstrumento(inst, a.id, dominios), escala20),
        ]);
    }
    // Questões e aprendizagens associadas, por baixo da tabela.
    linhas.push([], ["Questão", "Domínio", "Cotação", "Aprendizagem essencial"]);
    for (const q of questoes) {
        linhas.push([q.id, q.dom, q.cotacao, q.comp ? `${q.comp} — ${nomeAprendizagem(inst, q.comp, turma.competencias) || ""}` : ""]);
    }
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [{ wch: 5 }, { wch: 30 }, ...questoes.map(() => ({ wch: 12 })), ...dominios.map(() => ({ wch: 10 })), { wch: 14 }];
    return ws;
}

function folhaObservacao({ turma, alunos }) {
    const parametros = turma.parametros_od || [];
    if (!parametros.length) return null;
    const cab = ["Nº", "Aluno"];
    for (const p of parametros) for (const sem of [1, 2]) {
        const dom = odEntry(turma, p.id, sem).dom;
        cab.push(`${p.nome} · ${sem}º S${dom ? ` (${dom})` : ""}`);
    }
    const linhas = [["Observação direta (notas de 0 a 10)"], [], cab];
    for (const a of alunos) {
        const l = [a.numero ?? "", a.nome];
        for (const p of parametros) for (const sem of [1, 2]) {
            const v = odEntry(turma, p.id, sem).notas?.[a.id];
            l.push(v != null && v !== "" ? Number(v) : "");
        }
        linhas.push(l);
    }
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    ws["!cols"] = [{ wch: 5 }, { wch: 30 }, ...cab.slice(2).map(() => ({ wch: 16 }))];
    return ws;
}

function nomeFicheiro(turma, sufixo) {
    const hoje = new Date().toISOString().slice(0, 10);
    const t = `${turma.disciplina || ""}_${turma.ano || ""}${turma.turma || ""}`.replace(/[^A-Za-z0-9À-ÿ_-]+/g, "-");
    return `${t}_${sufixo}_${hoje}.xlsx`;
}

// Um instrumento → um ficheiro Excel.
export function exportInstrumentoExcel({ turma, alunos, inst }) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, folhaInstrumento({ turma, alunos, inst, dominios: turma.dominios || [] }), nomeFolha(inst.nome, new Set()));
    XLSX.writeFile(wb, nomeFicheiro(turma, String(inst.nome || "instrumento").replace(/[^A-Za-z0-9À-ÿ_-]+/g, "-")));
}

// Todos os instrumentos (uma folha cada) + observação direta → um ficheiro Excel.
export function exportTodosInstrumentosExcel({ turma, alunos, insts }) {
    const wb = XLSX.utils.book_new();
    const usados = new Set();
    const dominios = turma.dominios || [];
    for (const inst of insts) {
        XLSX.utils.book_append_sheet(wb, folhaInstrumento({ turma, alunos, inst, dominios }), nomeFolha(inst.nome, usados));
    }
    const od = folhaObservacao({ turma, alunos });
    if (od) XLSX.utils.book_append_sheet(wb, od, nomeFolha("Observação direta", usados));
    if (!wb.SheetNames.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Sem instrumentos."]]), "Vazio");
    XLSX.writeFile(wb, nomeFicheiro(turma, "registos"));
}
