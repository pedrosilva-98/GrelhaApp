import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getNivel, isEscala20, resumoTurma, TIPOS_SEM_NOTA_FINAL } from "@/lib/grelha";
import { textoParaPdf } from "@/lib/pdf";

// Relatórios do separador Resumo: avaliação de 1º/2º semestre e relatório anual.

const VERDE = [44, 74, 59];
const CINZA = [90, 100, 100];
const MARGEM = 40;
const MEDIDAS = [
    { key: "universais", label: "Universais" },
    { key: "seletivas", label: "Seletivas" },
    { key: "adicionais", label: "Adicionais" },
];
const TABELA = {
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, textColor: [44, 62, 53], lineColor: [229, 227, 219], lineWidth: 0.5, cellPadding: 5 },
    headStyles: { fillColor: VERDE, textColor: [249, 248, 246], fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [249, 248, 246] },
    margin: { left: MARGEM, right: MARGEM },
};

const virgula = (n, casas) => n.toFixed(casas).replace(".", ",");
const media20 = (pct) => Math.round((pct / 100) * 20 * 100) / 100;

// Média da turma: "72,3% · nível 4 (Bom)" no básico; "14,25 valores · nível 14" no secundário.
function textoMedia(pct, turma) {
    if (pct == null) return "—";
    if (isEscala20(turma)) {
        const v = media20(pct);
        return `${virgula(v, 2)} valores · nível ${Math.round(v)}`;
    }
    const n = getNivel(pct);
    return `${virgula(pct, 1)}% · nível ${n.n} (${n.label})`;
}

// Valor de um domínio: % com vírgula no básico, 0-20 arredondado no secundário.
function valorDominio(pct, turma) {
    if (pct == null) return "—";
    return isEscala20(turma) ? String(Math.round(media20(pct))) : `${virgula(pct, 1)}%`;
}

function fmtData(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || "");
}

function nivelAluno(pct, turma) {
    if (pct == null) return "—";
    return isEscala20(turma) ? String(Math.round(media20(pct))) : String(getNivel(pct).n);
}

function mediaAluno(pct, turma) {
    if (pct == null) return "—";
    return isEscala20(turma) ? virgula(media20(pct), 2) : `${virgula(pct, 1)}%`;
}

function textoDesvio(taxa, meta) {
    if (taxa == null) return "—";
    if (meta == null) return "Sem meta definida";
    const d = taxa - meta;
    if (d === 0) return "0 p.p. (meta atingida)";
    return `${d > 0 ? "+" : "-"}${Math.abs(d)} p.p. (${d > 0 ? "acima da meta" : "abaixo da meta"})`;
}

function criarDoc() {
    return new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
}

function largura(doc) {
    return doc.internal.pageSize.getWidth() - MARGEM * 2;
}

// Garante espaço na página; devolve o y onde continuar.
function espaco(doc, y, precisa = 60) {
    if (y + precisa > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        return 50;
    }
    return y;
}

function cabecalho(doc, titulo, { user, turma }) {
    const hoje = new Date().toLocaleDateString("pt-PT");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...VERDE);
    doc.text(titulo, MARGEM, 48);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...CINZA);
    doc.text(`Gerado em ${hoje}`, doc.internal.pageSize.getWidth() - MARGEM, 48, { align: "right" });

    const linhas = [
        ["Agrupamento", user?.agrupamento || "—"],
        ["Ano letivo", user?.ano_letivo || "—"],
        ["Professor(a)", `${user?.nome || "—"}${user?.email ? ` (${user.email})` : ""}`],
        ["Disciplina", turma.disciplina || "—"],
        ["Turma", `${turma.ano || ""} ${turma.turma || ""}`.trim() || "—"],
    ];
    autoTable(doc, {
        startY: 62,
        body: linhas.map(([k, v]) => [k, textoParaPdf(v)]),
        theme: "plain",
        styles: { font: "helvetica", fontSize: 10, textColor: [44, 62, 53], cellPadding: 2.5 },
        columnStyles: { 0: { cellWidth: 90, fontStyle: "bold", textColor: CINZA } },
        margin: { left: MARGEM, right: MARGEM },
    });
    doc.setDrawColor(229, 227, 219);
    const y = doc.lastAutoTable.finalY + 10;
    doc.line(MARGEM, y, doc.internal.pageSize.getWidth() - MARGEM, y);
    return y + 22;
}

function seccao(doc, y, titulo) {
    y = espaco(doc, y, 70);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...VERDE);
    doc.text(titulo, MARGEM, y);
    return y + 10;
}

function paragrafo(doc, y, texto, opts = {}) {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size || 10);
    doc.setTextColor(...(opts.cor || [44, 62, 53]));
    const linhas = doc.splitTextToSize(textoParaPdf(texto), largura(doc));
    y = espaco(doc, y, linhas.length * 13 + 6);
    doc.text(linhas, MARGEM, y + 4);
    return y + linhas.length * 13 + 4;
}

function tabela(doc, y, head, body, extra = {}) {
    autoTable(doc, { ...TABELA, startY: espaco(doc, y, 50), head: [head], body, ...extra });
    return doc.lastAutoTable.finalY + 20;
}

function tabelaAlunos(doc, y, { turma, dominios, medias }) {
    const head = ["Nº", "Aluno", ...dominios.map((d) => d.code), "Média", "Nível"];
    const body = medias.map((a) => [
        String(a.numero ?? ""),
        textoParaPdf(a.nome),
        ...dominios.map((d) => valorDominio(a.doms[d.code], turma)),
        mediaAluno(a.media, turma),
        nivelAluno(a.media, turma),
    ]);
    return tabela(doc, y, head, body.length ? body : [["", "Sem alunos.", ...dominios.map(() => ""), "", ""]], {
        columnStyles: { 0: { cellWidth: 28, halign: "center" }, 1: { cellWidth: 170 } },
    });
}

function tabelaDistribuicao(doc, y, dist) {
    return tabela(doc, y, ["Nível", "Descrição", "Nº de alunos"], dist.map((d) => [String(d.n), d.label, String(d.count)]), {
        columnStyles: { 0: { cellWidth: 50, halign: "center" }, 2: { cellWidth: 90, halign: "center" } },
    });
}

function rodape(doc, texto) {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150, 155, 145);
        const h = doc.internal.pageSize.getHeight();
        doc.text(texto, MARGEM, h - 22);
        doc.text(`${i} / ${n}`, doc.internal.pageSize.getWidth() - MARGEM, h - 22, { align: "right" });
    }
}

function nomeFicheiro(prefixo, turma) {
    const t = `${turma.disciplina || ""}_${turma.ano || ""}${turma.turma || ""}`.replace(/[^A-Za-z0-9À-ÿ_-]+/g, "-");
    return `${prefixo}_${t}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

const textoSucesso = (turma) => (isEscala20(turma) ? "média igual ou superior a 10 valores" : "média igual ou superior a 50%");

// ─── Avaliação de 1º / 2º semestre: a informação da página Resumo ─────────────
export function exportRelatorioSemestrePDF({ user, turma, alunos, insts, dominios, sem }) {
    const r = resumoTurma({ turma, alunos, insts, dominios, sem });
    const doc = criarDoc();
    let y = cabecalho(doc, `Avaliação do ${sem}º semestre`, { user, turma });

    y = seccao(doc, y, "Resumo");
    y = tabela(doc, y, ["Indicador", "Valor"], [
        ["Alunos na turma", String(alunos.length)],
        ["Alunos avaliados", String(r.comMedia.length)],
        ["Instrumentos de avaliação", String(r.filteredInsts.length)],
        ["Média da turma", textoMedia(r.mediaGeral, turma)],
        ["Taxa de sucesso", r.taxaSucessoPct != null ? `${r.taxaSucessoPct}%` : "—"],
        ["Meta de sucesso", r.meta != null ? `${r.meta}%` : "Sem meta definida"],
        ["Desvio em relação à meta", textoDesvio(r.taxaSucessoPct, r.meta)],
    ], { columnStyles: { 0: { cellWidth: 190, fontStyle: "bold" } } });
    y = paragrafo(doc, y - 12, `Sucesso: ${textoSucesso(turma)}.`, { size: 8, cor: CINZA }) + 14;

    y = seccao(doc, y, "Avaliação dos alunos por domínio");
    y = tabelaAlunos(doc, y, { turma, dominios, medias: r.medias });

    if (!isEscala20(turma)) {
        y = seccao(doc, y, "Níveis atribuídos");
        y = tabelaDistribuicao(doc, y, r.dist);
    }

    y = seccao(doc, y, "Instrumentos de avaliação do semestre");
    tabela(doc, y, ["Instrumento", "Tipo", "Data", "Conta para a avaliação"], r.filteredInsts.map((i) => [
        textoParaPdf(i.nome), i.tipo || "", fmtData(i.data), TIPOS_SEM_NOTA_FINAL.includes(i.tipo) ? "Não" : "Sim",
    ]));

    rodape(doc, `Avaliação do ${sem}º semestre · ${textoParaPdf(turma.disciplina || "")} ${turma.ano || ""} ${turma.turma || ""}`);
    doc.save(nomeFicheiro(`avaliacao_${sem}semestre`, turma));
}

// ─── Relatório anual (final de ano letivo) ────────────────────────────────────
export function exportRelatorioAnualPDF({ user, turma, alunos, insts, dominios }) {
    const anual = resumoTurma({ turma, alunos, insts, dominios, sem: null });
    const s1 = resumoTurma({ turma, alunos, insts, dominios, sem: 1 });
    const s2 = resumoTurma({ turma, alunos, insts, dominios, sem: 2 });
    const doc = criarDoc();
    let y = cabecalho(doc, "Relatório anual", { user, turma });

    // 1. Alunos avaliados
    y = seccao(doc, y, "1. Alunos avaliados");
    y = paragrafo(doc, y, `Número total de alunos avaliados: ${anual.comMedia.length} (de ${alunos.length} alunos na turma).`) + 14;

    // 2. Educação Especial
    y = seccao(doc, y, "2. Alunos avaliados com medidas de suporte à aprendizagem e à inclusão");
    const avaliados = new Set(anual.comMedia.map((a) => a.id));
    const comMedidas = alunos.filter((a) => avaliados.has(a.id) && MEDIDAS.some((m) => (a.medidas?.[m.key] || []).length));
    if (!comMedidas.length) {
        y = paragrafo(doc, y, "Nenhum aluno avaliado tem medidas registadas no perfil.") + 14;
    } else {
        y = paragrafo(doc, y, `${comMedidas.length} aluno(s) com medidas registadas:`) + 4;
        y = tabela(doc, y, ["Nº", "Aluno", ...MEDIDAS.map((m) => m.label)], comMedidas.map((a) => [
            String(a.numero ?? ""),
            textoParaPdf(a.nome),
            ...MEDIDAS.map((m) => textoParaPdf((a.medidas?.[m.key] || []).join("; ")) || "—"),
        ]), { columnStyles: { 0: { cellWidth: 28, halign: "center" }, 1: { cellWidth: 120 } } });
    }

    // 3. Média e 4. Sucesso
    y = seccao(doc, y, "3. Média da avaliação dos alunos e taxa de sucesso");
    const linhaPeriodo = (nome, r) => [
        nome,
        textoMedia(r.mediaGeral, turma),
        r.taxaSucessoPct != null ? `${r.taxaSucessoPct}%` : "—",
        textoDesvio(r.taxaSucessoPct, r.meta),
    ];
    y = tabela(doc, y, ["Período", "Média da turma", "Taxa de sucesso", "Desvio em relação à meta"], [
        linhaPeriodo("1º semestre", s1),
        linhaPeriodo("2º semestre", s2),
        linhaPeriodo("Anual", anual),
    ], { bodyStyles: {}, didParseCell: (d) => { if (d.section === "body" && d.row.index === 2) d.cell.styles.fontStyle = "bold"; } });
    y = paragrafo(doc, y - 12, `Meta de sucesso definida: ${anual.meta != null ? `${anual.meta}%` : "sem meta definida"}. Sucesso: ${textoSucesso(turma)}.`, { size: 8, cor: CINZA }) + 14;

    if (!isEscala20(turma)) {
        y = seccao(doc, y, "Níveis atribuídos (anual)");
        y = tabelaDistribuicao(doc, y, anual.dist);
    }

    // 5. Instrumentos por tipo
    y = seccao(doc, y, "4. Instrumentos de avaliação utilizados");
    const porTipo = {};
    for (const i of insts) porTipo[i.tipo || "Sem tipo"] = (porTipo[i.tipo || "Sem tipo"] || 0) + 1;
    const tipos = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
    y = tabela(doc, y, ["Tipo de instrumento", "Número"], [
        ...tipos.map(([t, n]) => [t + (TIPOS_SEM_NOTA_FINAL.includes(t) ? " (não conta para a avaliação final)" : ""), String(n)]),
        ["Total", String(insts.length)],
    ], {
        columnStyles: { 1: { cellWidth: 70, halign: "center" } },
        didParseCell: (d) => { if (d.section === "body" && d.row.index === tipos.length) d.cell.styles.fontStyle = "bold"; },
    });

    // 6. Diferenciados
    y = seccao(doc, y, "5. Instrumentos diferenciados para alunos específicos");
    const porId = Object.fromEntries(alunos.map((a) => [a.id, a]));
    const diferenciados = insts.filter((i) => Array.isArray(i.alunos_ids));
    if (!diferenciados.length) {
        y = paragrafo(doc, y, "Nenhum instrumento foi aplicado só a alunos específicos.") + 14;
    } else {
        y = paragrafo(doc, y, `${diferenciados.length} de ${insts.length} instrumento(s) foram diferenciados:`) + 4;
        y = tabela(doc, y, ["Instrumento", "Tipo", "Alunos"], diferenciados.map((i) => [
            textoParaPdf(i.nome),
            i.tipo || "",
            textoParaPdf(i.alunos_ids.map((id) => porId[id]).filter(Boolean).map((a) => `${a.numero}. ${a.nome}`).join("; ")),
        ]), { columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 110 } } });
    }

    // Anexo: avaliação anual por aluno
    y = seccao(doc, y, "Anexo: avaliação anual por aluno");
    tabelaAlunos(doc, y, { turma, dominios, medias: anual.medias });

    rodape(doc, `Relatório anual · ${textoParaPdf(turma.disciplina || "")} ${turma.ano || ""} ${turma.turma || ""}`);
    doc.save(nomeFicheiro("relatorio_anual", turma));
}
