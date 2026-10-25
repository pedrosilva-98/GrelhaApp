import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
    calcDominioInstrumento, calcClassifInstrumento, aplicaAluno, isEscala20, odEntry, nomeAprendizagem,
    resumoTurma, getNivel, outrasMedidas, siglasDL54, TIPOS_SEM_NOTA_FINAL,
} from "@/lib/grelha";
import { textoParaPdf } from "@/lib/pdf";

// Registo completo em PDF a partir da cópia de segurança (GET /api/backup):
// para cada turma, os alunos e as suas características, as classificações de cada instrumento,
// a observação direta e a avaliação por domínio.

const VERDE = [44, 74, 59];
const CINZA = [90, 100, 100];
const M = 36;
const TAB = {
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, textColor: [44, 62, 53], lineColor: [229, 227, 219], lineWidth: 0.5, cellPadding: 3.5, overflow: "linebreak" },
    headStyles: { fillColor: VERDE, textColor: [249, 248, 246], fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [249, 248, 246] },
    margin: { left: M, right: M, top: 40, bottom: 36 },
};

const t = (v) => textoParaPdf(v ?? "");
const virgula = (n, casas) => n.toFixed(casas).replace(".", ",");
const media20 = (pct) => Math.round((pct / 100) * 20 * 100) / 100;

function fmtData(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || "");
}

// Número com no máximo 2 casas decimais e vírgula (ex.: cotações 16,67).
const num = (v) => String(Math.round(Number(v) * 100) / 100).replace(".", ",");

// Valor sem unidade, para tabelas largas (a unidade vai na linha por cima da tabela).
function valorCurto(pct, turma) {
    if (pct == null) return "—";
    return isEscala20(turma) ? String(Math.round(media20(pct))) : virgula(pct, 1);
}

function valor(pct, turma) {
    if (pct == null) return "—";
    return isEscala20(turma) ? String(Math.round(media20(pct))) : `${virgula(pct, 1)}%`;
}

function mediaTexto(pct, turma) {
    if (pct == null) return "—";
    return isEscala20(turma) ? virgula(media20(pct), 2) : `${virgula(pct, 1)}%`;
}

function nivelTexto(pct, turma) {
    if (pct == null) return "—";
    return isEscala20(turma) ? String(Math.round(media20(pct))) : String(getNivel(pct).n);
}

function titulo(doc, y, texto, tamanho = 12) {
    if (y > doc.internal.pageSize.getHeight() - 90) { doc.addPage(); y = 44; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(tamanho);
    doc.setTextColor(...VERDE);
    doc.text(t(texto), M, y);
    return y + 8;
}

function linha(doc, y, texto, opts = {}) {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size || 9);
    doc.setTextColor(...(opts.cor || CINZA));
    const linhas = doc.splitTextToSize(t(texto), doc.internal.pageSize.getWidth() - 2 * M);
    if (y + linhas.length * 11 > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 44; }
    doc.text(linhas, M, y + 8);
    return y + linhas.length * 11 + 4;
}

function tabela(doc, y, head, body, extra = {}) {
    autoTable(doc, { ...TAB, startY: y + 4, head: [head], body: body.length ? body : [[{ content: "Sem registos.", colSpan: head.length }]], ...extra });
    return doc.lastAutoTable.finalY + 18;
}

function seccaoTurma(doc, { turma, alunos: alunosRaw, instrumentos }) {
    const dominios = turma.dominios || [];
    const alunos = alunosRaw.map((a, i) => ({ ...a, numero: i + 1 }));
    const porId = Object.fromEntries(alunos.map((a) => [a.id, a]));
    const escala = isEscala20(turma) ? "0-20" : "%";

    let y = 48;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...VERDE);
    doc.text(t(`${turma.disciplina || ""} · ${turma.ano || ""} ${turma.turma || ""}`), M, y);
    y += 10;
    const sems = turma.semestres || {};
    const semTxt = ["1", "2"].map((k) => (sems[k]?.inicio ? `${k}º sem.: ${fmtData(sems[k].inicio)} a ${fmtData(sems[k].fim)}` : null)).filter(Boolean).join("   ·   ");
    y = linha(doc, y, `Domínios e ponderações: ${dominios.map((d) => `${d.code} - ${d.nome} (${d.peso}%)`).join("; ") || "—"}`);
    y = linha(doc, y, `Meta de sucesso: ${turma.meta_sucesso != null ? `${turma.meta_sucesso}%` : "—"}${semTxt ? `   ·   ${semTxt}` : ""}`) + 8;

    // 1. Alunos
    y = titulo(doc, y, "Alunos");
    y = tabela(doc, y, ["Nº", "Nome", "Data de nascimento", "Nº processo", "Dec. Lei 54", "Email"], alunos.map((a) => [
        String(a.numero), t(a.nome), fmtData(a.data_nascimento), t(a.n_processo || ""), siglasDL54(a).join(" ") || "—", t(a.email || ""),
    ]), { columnStyles: { 0: { cellWidth: 26, halign: "center" } } });

    // 2. Educação Especial
    const ee = alunos.filter((a) => (a.problematica || "").trim() || siglasDL54(a).length || outrasMedidas(a).length);
    y = titulo(doc, y, "Educação Especial (DL 54/2018)");
    y = tabela(doc, y, ["Nº", "Aluno", "Problemática", "Universais", "Seletivas", "Adicionais", "Outras medidas"], ee.map((a) => [
        String(a.numero), t(a.nome), t(a.problematica || "") || "—",
        ...["universais", "seletivas", "adicionais"].map((k) => t((a.medidas?.[k] || []).join("; ")) || "—"),
        t(outrasMedidas(a).map((g) => `${g.tipo || "Outras"}: ${(g.medidas || []).join("; ")}`).join(" | ")) || "—",
    ]), { columnStyles: { 0: { cellWidth: 26, halign: "center" }, 1: { cellWidth: 100 } } });

    // 3. Instrumentos
    for (const inst of instrumentos) {
        const qs = inst.questoes || [];
        const aplica = alunos.filter((a) => aplicaAluno(inst, a.id));
        y = titulo(doc, y, `Instrumento: ${inst.nome}`, 11);
        const info = [
            inst.tipo, inst.semestre ? `${inst.semestre}º semestre` : null, inst.data ? fmtData(inst.data) : null,
            TIPOS_SEM_NOTA_FINAL.includes(inst.tipo) ? "não conta para a avaliação final" : null,
            Array.isArray(inst.alunos_ids) ? `só para: ${inst.alunos_ids.map((id) => porId[id]).filter(Boolean).map((a) => a.numero).join(", ")}` : "todos os alunos",
        ].filter(Boolean).join("   ·   ");
        y = linha(doc, y, `${info}   ·   notas de 0 a 10 por questão; domínios e avaliação em ${escala === "%" ? "percentagem" : "valores (0-20)"}`);
        const notas = inst.notas || {};
        const larga = qs.length + dominios.length > 14;
        const fonte = larga ? 6.5 : 8;
        y = tabela(doc, y, [
            "Nº", "Aluno", ...qs.map((q) => `${q.id}\n${q.dom}·${num(q.cotacao)}`), ...dominios.map((d) => d.code), "Aval.",
        ], aplica.map((a) => [
            String(a.numero), t(a.nome),
            ...qs.map((q) => { const v = notas[a.id]?.[q.id]; return v != null && v !== "" ? num(v) : ""; }),
            ...dominios.map((d) => valorCurto(calcDominioInstrumento(inst, a.id, d.code), turma)),
            valorCurto(calcClassifInstrumento(inst, a.id, dominios), turma),
        ]), {
            styles: { ...TAB.styles, fontSize: fonte, halign: "center", cellPadding: larga ? 2 : 3.5 },
            headStyles: { ...TAB.headStyles, fontSize: fonte, halign: "center" },
            columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: larga ? 90 : 120, halign: "left" } },
        });
        const comAE = qs.filter((q) => q.comp);
        if (comAE.length) {
            y = linha(doc, y - 12, `Aprendizagens: ${comAE.map((q) => `${q.id} - ${nomeAprendizagem(inst, q.comp, turma.competencias) || q.comp}`).join("; ")}`, { size: 7.5 }) + 10;
        }
    }

    // 4. Observação direta
    const parametros = turma.parametros_od || [];
    if (parametros.length) {
        y = titulo(doc, y, "Observação direta (0 a 10)");
        const cab = ["Nº", "Aluno"];
        for (const p of parametros) for (const sem of [1, 2]) {
            const dom = odEntry(turma, p.id, sem).dom;
            cab.push(`${t(p.nome)}\n${sem}º S${dom ? ` · ${dom}` : ""}`);
        }
        y = tabela(doc, y, cab, alunos.map((a) => {
            const l = [String(a.numero), t(a.nome)];
            for (const p of parametros) for (const sem of [1, 2]) {
                const v = odEntry(turma, p.id, sem).notas?.[a.id];
                l.push(v != null && v !== "" ? String(v).replace(".", ",") : "");
            }
            return l;
        }), { styles: { ...TAB.styles, halign: "center" }, columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 110, halign: "left" } } });
    }

    // 5. Avaliação por domínio (inclui o domínio ético-relacional e a observação direta)
    const anoTurma = { turma, alunos, insts: instrumentos, dominios };
    for (const [nome, sem] of [["1º semestre", 1], ["2º semestre", 2], ["Anual", null]]) {
        const r = resumoTurma({ ...anoTurma, sem });
        y = titulo(doc, y, `Avaliação por domínio · ${nome}`);
        y = tabela(doc, y, ["Nº", "Aluno", ...dominios.map((d) => `${d.code} - ${t(d.nome)}`), "Média", "Nível"], r.medias.map((a) => [
            String(a.numero), t(a.nome), ...dominios.map((d) => valor(a.doms[d.code], turma)), mediaTexto(a.media, turma), nivelTexto(a.media, turma),
        ]), { styles: { ...TAB.styles, halign: "center" }, columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 130, halign: "left" } } });
    }
}

export function exportRegistoCompletoPDF(backup) {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const prof = backup.professor || {};
    const gerado = new Date(backup.gerado_em || Date.now()).toLocaleString("pt-PT");

    // Capa
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...VERDE);
    doc.text("Registo de avaliação", M, 90);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(...CINZA);
    const linhasCapa = [
        `Professor(a): ${prof.nome || "—"}${prof.email ? ` (${prof.email})` : ""}`,
        `Agrupamento: ${prof.agrupamento || "—"}`,
        `Ano letivo: ${prof.ano_letivo || "—"}`,
        `Gerado em: ${gerado}`,
        `Turmas: ${(backup.turmas || []).map((x) => `${x.turma.disciplina} ${x.turma.ano} ${x.turma.turma}`).join("; ") || "—"}`,
    ];
    doc.text(doc.splitTextToSize(t(linhasCapa.join("\n")), doc.internal.pageSize.getWidth() - 2 * M), M, 120);

    for (const tb of backup.turmas || []) {
        doc.addPage();
        seccaoTurma(doc, tb);
    }

    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(150, 155, 145);
        const h = doc.internal.pageSize.getHeight();
        doc.text(t(`Caderno de Registo de Avaliação · registo completo · ${gerado}`), M, h - 16);
        doc.text(`${i} / ${n}`, doc.internal.pageSize.getWidth() - M, h - 16, { align: "right" });
    }
    doc.save(`registo_completo_${new Date().toISOString().slice(0, 10)}.pdf`);
}
