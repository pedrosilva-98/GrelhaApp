import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { distribuicaoQuestoes, nomeAprendizagem, domColor, TIPOS_SEM_NOTA_FINAL } from "@/lib/grelha";
import { textoParaPdf } from "@/lib/pdf";

// Resumo de um instrumento de avaliação: as questões com o domínio e a aprendizagem essencial,
// e no fim a percentagem de questões de cada domínio (para ver se o instrumento está equilibrado).

const VERDE = [44, 74, 59];
const CINZA = [90, 100, 100];
const M = 40;
const t = (v) => textoParaPdf(v ?? "");
const num = (v) => String(Math.round(Number(v) * 100) / 100).replace(".", ",");

function hexRgb(hex) {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function fmtData(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || "");
}

export function gerarResumoInstrumentoPDF({ turma, alunos = [], inst }) {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const largura = doc.internal.pageSize.getWidth();
    const dominios = turma.dominios || [];
    const corDom = Object.fromEntries(dominios.map((d, i) => [d.code, hexRgb(domColor(i))]));
    const nomeDom = Object.fromEntries(dominios.map((d) => [d.code, d.nome]));
    const questoes = inst.questoes || [];
    const totalPontos = questoes.reduce((s, q) => s + (Number(q.cotacao) || 0), 0);

    doc.setProperties({ title: `Resumo - ${inst.nome}` });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...VERDE);
    doc.text("Resumo do instrumento de avaliação", M, 50);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...CINZA);
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-PT")}`, largura - M, 50, { align: "right" });

    const porId = Object.fromEntries(alunos.map((a) => [a.id, a]));
    const aplica = Array.isArray(inst.alunos_ids)
        ? `Alunos específicos: ${inst.alunos_ids.map((id) => porId[id]).filter(Boolean).map((a) => `${a.numero}. ${a.nome}`).join("; ")}`
        : "Todos os alunos";
    autoTable(doc, {
        startY: 62,
        body: [
            ["Turma", t(`${turma.disciplina || ""} · ${turma.ano || ""} ${turma.turma || ""}`)],
            ["Instrumento", t(inst.nome)],
            ["Tipo", t(inst.tipo) + (TIPOS_SEM_NOTA_FINAL.includes(inst.tipo) ? " (não conta para a avaliação final)" : "")],
            ["Semestre · data", `${inst.semestre ? `${inst.semestre}º semestre` : "—"}${inst.data ? ` · ${fmtData(inst.data)}` : ""}`],
            ["Aplica-se a", t(aplica)],
            ["Questões", `${questoes.length} questões · ${num(totalPontos)} pontos`],
        ],
        theme: "plain",
        styles: { font: "helvetica", fontSize: 10, textColor: [44, 62, 53], cellPadding: 2.5 },
        columnStyles: { 0: { cellWidth: 100, fontStyle: "bold", textColor: CINZA } },
        margin: { left: M, right: M },
    });

    // Questões
    let y = doc.lastAutoTable.finalY + 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...VERDE);
    doc.text("Questões", M, y);
    autoTable(doc, {
        startY: y + 8,
        head: [["Questão", "Domínio", "Cotação", "Aprendizagem essencial"]],
        body: questoes.map((q) => [
            t(q.id),
            q.dom,
            num(q.cotacao),
            q.comp ? t(`${q.comp} - ${nomeAprendizagem(inst, q.comp, turma.competencias) || ""}`) : "—",
        ]),
        theme: "grid",
        styles: { font: "helvetica", fontSize: 9, textColor: [44, 62, 53], lineColor: [229, 227, 219], lineWidth: 0.5, cellPadding: 4, valign: "middle" },
        headStyles: { fillColor: VERDE, textColor: [249, 248, 246], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [249, 248, 246] },
        columnStyles: { 0: { cellWidth: 55, halign: "center" }, 1: { cellWidth: 60, halign: "center", fontStyle: "bold" }, 2: { cellWidth: 55, halign: "center" } },
        didParseCell: (d) => {
            if (d.section === "body" && d.column.index === 1 && corDom[d.cell.raw]) d.cell.styles.textColor = corDom[d.cell.raw];
        },
        margin: { left: M, right: M, bottom: 40 },
    });

    // Distribuição pelos domínios
    const dist = distribuicaoQuestoes(questoes, dominios);
    y = doc.lastAutoTable.finalY + 26;
    if (y > doc.internal.pageSize.getHeight() - 60 - dist.length * 40) { doc.addPage(); y = 50; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...VERDE);
    doc.text("Distribuição das questões pelos domínios", M, y);
    autoTable(doc, {
        startY: y + 8,
        head: [["Domínio", "Nº de questões", "% das questões", "Pontos"]],
        body: dist.map((d) => [t(`${d.code} - ${nomeDom[d.code] || ""}`), String(d.n), `${num(d.pct)}%`, num(d.pontos)]),
        theme: "grid",
        styles: { font: "helvetica", fontSize: 10, textColor: [44, 62, 53], lineColor: [229, 227, 219], lineWidth: 0.5, cellPadding: 5 },
        headStyles: { fillColor: VERDE, textColor: [249, 248, 246], fontStyle: "bold" },
        columnStyles: { 1: { cellWidth: 90, halign: "center" }, 2: { cellWidth: 100, halign: "center", fontStyle: "bold" }, 3: { cellWidth: 70, halign: "center" } },
        margin: { left: M, right: M },
    });

    // Barra com a proporção de questões de cada domínio.
    y = doc.lastAutoTable.finalY + 18;
    const larguraBarra = largura - 2 * M;
    let x = M;
    for (const d of dist) {
        const w = (d.pct / 100) * larguraBarra;
        doc.setFillColor(...(corDom[d.code] || VERDE));
        doc.rect(x, y, w, 16, "F");
        if (w > 60) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);
            doc.text(`${d.code} ${Math.round(d.pct)}%`, x + w / 2, y + 11, { align: "center" });
        }
        x += w;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text("Percentagem calculada sobre o número de questões do instrumento.", M, y + 32);

    return doc;
}

// Abre o PDF num separador novo (o visualizador do browser permite guardar ou imprimir).
// Se o browser bloquear o separador, descarrega o ficheiro.
export function abrirResumoInstrumentoPDF(params) {
    const doc = gerarResumoInstrumentoPDF(params);
    const nome = `resumo_${String(params.inst.nome || "instrumento").replace(/[^A-Za-z0-9À-ÿ_-]+/g, "-")}.pdf`;
    const url = URL.createObjectURL(doc.output("blob"));
    const janela = window.open(url, "_blank");
    if (!janela) doc.save(nome);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
