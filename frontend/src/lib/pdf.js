import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calcMediaFinal, calcMediasDominioAluno, getNivel, calcDominioInstrumento, NOTA_MAX, instsParaFinal, isEscala20, formatAvaliacao } from "@/lib/grelha";
// ─── Avaliação final (grelha da turma) ───────────────────────────────────────
export function exportGrelhaPDF({ user, turma, alunos, insts }) {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-PT");
    const dominios = turma.dominios || [];
    const escala20 = isEscala20(turma);
    const finalInsts = instsParaFinal(insts);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(44, 74, 59);
    doc.text("Avaliação final", 40, 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 100, 100);
    const sub = `${turma.disciplina} · ${turma.ano} ${turma.turma} · Prof. ${user?.nome || ""}`;
    doc.text(sub, 40, 58);
    doc.text(`Gerado em ${dateStr}`, doc.internal.pageSize.getWidth() - 40, 40, { align: "right" });

    doc.setDrawColor(229, 227, 219);
    doc.line(40, 70, doc.internal.pageSize.getWidth() - 40, 70);

    const pondLine = dominios.map((d) => `${d.code}: ${d.peso}% (${d.nome})`).join("   ·   ");
    doc.setFontSize(9);
    doc.setTextColor(90, 100, 100);
    const wrap = doc.splitTextToSize("Ponderações — " + pondLine, doc.internal.pageSize.getWidth() - 80);
    doc.text(wrap, 40, 88);

    const startY = 100 + (wrap.length - 1) * 10;

    const head = [["#", "Aluno", ...dominios.map((d) => d.code), "Média", ...(escala20 ? [] : ["Nível"])]];
    const body = alunos.map((a, i) => {
        const doms = calcMediasDominioAluno(finalInsts, a.id, dominios, turma);
        const media = calcMediaFinal(finalInsts, dominios, a.id, turma);
        const nivel = getNivel(media);
        return [
            String(i + 1).padStart(2, "0"),
            a.nome,
            ...dominios.map((d) => formatAvaliacao(doms[d.code], turma)),
            formatAvaliacao(media, turma),
            ...(escala20 ? [] : [nivel ? nivel.label : "—"]),
        ];
    });

    autoTable(doc, {
        head, body, startY,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 9, textColor: [44, 62, 53], lineColor: [229, 227, 219], lineWidth: 0.5, cellPadding: 6 },
        headStyles: { fillColor: [44, 74, 59], textColor: [249, 248, 246], fontStyle: "bold", fontSize: 9 },
        alternateRowStyles: { fillColor: [249, 248, 246] },
        columnStyles: {
            0: { cellWidth: 30, halign: "center" },
            1: { cellWidth: 180 },
        },
    });

    let y = doc.lastAutoTable.finalY + 24;
    doc.setFontSize(11);
    doc.setTextColor(44, 74, 59);
    doc.setFont("helvetica", "bold");
    doc.text("Instrumentos considerados", 40, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 100, 100);
    const instText = finalInsts.length
        ? finalInsts.map((i) => `• ${i.nome} (${i.tipo}${i.data ? " · " + i.data : ""})`).join("     ")
        : "Sem instrumentos.";
    doc.text(doc.splitTextToSize(instText, doc.internal.pageSize.getWidth() - 80), 40, y + 10);

    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(150, 155, 145);
    doc.text("Avaliação final · gerado automaticamente", 40, pageH - 20);

    const safeName = `${turma.turma}_${(turma.disciplina || "").replace(/\s+/g, "-")}_${dateStr.replace(/\//g, "-")}`;
    doc.save(`avaliacao_final_${safeName}.pdf`);
}

// ─── Relatório por instrumento (aprendizagens essenciais) ─────────────────────
// Para cada aluno e cada aprendizagem presente no instrumento:
//   % = (Σ nota_i/10 × cot_i) / (Σ cot_i) × 100
// Assinala em vermelho as aprendizagens com < 60%.
export function exportInstrumentoRelatorioPDF({ user, turma, alunos, instrumento }) {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-PT");

    const compsInInstrumento = Array.from(new Set(
        (instrumento.questoes || []).map((q) => q.comp).filter(Boolean)
    ));
    const allComps = turma.competencias || [];
    const compByCode = Object.fromEntries(allComps.map((c) => [c.code, c]));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(44, 74, 59);
    doc.text("Relatório por aprendizagens", 40, 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 100, 100);
    const sub = `${turma.disciplina} · ${turma.ano} ${turma.turma} · ${instrumento.nome} (${instrumento.tipo})`;
    doc.text(sub, 40, 58);
    doc.text(`Gerado em ${dateStr}`, doc.internal.pageSize.getWidth() - 40, 40, { align: "right" });

    doc.setDrawColor(229, 227, 219);
    doc.line(40, 70, doc.internal.pageSize.getWidth() - 40, 70);

    if (!compsInInstrumento.length) {
        doc.setFontSize(11);
        doc.setTextColor(158, 57, 33);
        doc.text(
            "Este instrumento ainda não tem aprendizagens associadas às questões. Edite o instrumento e atribua uma aprendizagem a cada questão para gerar este relatório.",
            40, 100, { maxWidth: doc.internal.pageSize.getWidth() - 80 },
        );
        doc.save(`relatorio_${instrumento.nome.replace(/\s+/g, "-")}_${dateStr.replace(/\//g, "-")}.pdf`);
        return;
    }

    // Legend header + table below
    doc.setFontSize(9);
    doc.setTextColor(90, 100, 100);
    doc.setFont("helvetica", "bold");
    doc.text("Desempenho por aprendizagem (percentagem obtida por cada aluno):", 40, 88);
    doc.setFont("helvetica", "normal");
    const startY = 102;

    // Table: rows = aprendizagens, cols = "Aprendizagem" + alunos + Média
    const alunoHeaders = alunos.map((a) => a.nome);
    const head = [["#", "Aprendizagem", ...alunoHeaders, "Média"]];

    const cellStyles = {}; // { rowIdx: { colIdx: styles } }
    const body = compsInInstrumento.map((code, rowIdx) => {
        const c = compByCode[code];
        cellStyles[rowIdx] = {};
        const label = c?.nome || "(descritor em falta)";
        const row = [String(rowIdx + 1).padStart(2, "0"), label];
        const values = [];
        alunos.forEach((a, colOffset) => {
            const qs = (instrumento.questoes || []).filter((q) => q.comp === code);
            const notas = (instrumento.notas || {})[a.id] || {};
            const totCot = qs.reduce((s, q) => s + Number(q.cotacao || 0), 0);
            const anyNota = qs.some((q) => notas[q.id] != null && notas[q.id] !== "");
            let pct = null;
            if (totCot > 0 && anyNota) {
                const weighted = qs.reduce((s, q) => s + (Number(notas[q.id] || 0) / NOTA_MAX) * Number(q.cotacao || 0), 0);
                pct = (weighted / totCot) * 100;
            }
            row.push(pct != null ? pct.toFixed(1) + "%" : "—");
            if (pct != null) values.push(pct);
            // Column index in body: 2 + colOffset (after # and Aprendizagem)
            if (pct != null && pct < 60) {
                cellStyles[rowIdx][2 + colOffset] = { fillColor: [252, 218, 210], textColor: [138, 26, 26], fontStyle: "bold" };
            }
        });
        // Média row (average of students that have any note)
        const avg = values.length ? (values.reduce((s, v) => s + v, 0) / values.length) : null;
        row.push(avg != null ? avg.toFixed(1) + "%" : "—");
        return row;
    });

    // Column widths: fit content
    const numAlunoCols = alunos.length;
    const alunoColWidth = Math.max(48, Math.min(90, Math.floor((doc.internal.pageSize.getWidth() - 80 - 30 - 200 - 60) / Math.max(1, numAlunoCols))));
    const columnStyles = {
        0: { cellWidth: 26, halign: "center" },
        1: { cellWidth: 200 },
    };
    for (let i = 0; i < numAlunoCols; i++) {
        columnStyles[2 + i] = { cellWidth: alunoColWidth, halign: "center" };
    }
    columnStyles[2 + numAlunoCols] = { cellWidth: 55, halign: "center", fontStyle: "bold" };

    autoTable(doc, {
        head, body, startY,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 8.5, textColor: [44, 62, 53], lineColor: [229, 227, 219], lineWidth: 0.5, cellPadding: 5, overflow: "linebreak" },
        headStyles: { fillColor: [44, 74, 59], textColor: [249, 248, 246], fontStyle: "bold", fontSize: 8.5, halign: "center" },
        alternateRowStyles: { fillColor: [249, 248, 246] },
        columnStyles,
        didParseCell(data) {
            if (data.section !== "body") return;
            const cs = cellStyles[data.row.index]?.[data.column.index];
            if (cs) Object.assign(data.cell.styles, cs);
        },
    });

    let y = doc.lastAutoTable.finalY + 20;
    // Aggregate: how many alunos <60% in each comp
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(44, 74, 59);
    doc.text("Síntese", 40, y);
    y += 14;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    compsInInstrumento.forEach((code) => {
        let total = 0, low = 0, sum = 0;
        alunos.forEach((a) => {
            const qs = (instrumento.questoes || []).filter((q) => q.comp === code);
            const notas = (instrumento.notas || {})[a.id] || {};
            const totCot = qs.reduce((s, q) => s + Number(q.cotacao || 0), 0);
            const anyNota = qs.some((q) => notas[q.id] != null && notas[q.id] !== "");
            if (totCot > 0 && anyNota) {
                const w = qs.reduce((s, q) => s + (Number(notas[q.id] || 0) / NOTA_MAX) * Number(q.cotacao || 0), 0);
                const pct = (w / totCot) * 100;
                total++;
                sum += pct;
                if (pct < 60) low++;
            }
        });
        const avg = total ? (sum / total).toFixed(1) : "—";
        const label = (compByCode[code]?.nome || "(descritor)").slice(0, 80);
        doc.text(
            `• ${label} — média ${avg}%  |  ${low}/${total} aluno(s) abaixo de 60%`,
            40, y, { maxWidth: doc.internal.pageSize.getWidth() - 80 },
        );
        y += 12;
    });

    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(150, 155, 145);
    doc.text("Células a vermelho: aluno abaixo de 60% da cotação nessa aprendizagem.", 40, pageH - 32);
    doc.text("Relatório por aprendizagens · gerado automaticamente", 40, pageH - 20);

    const safeName = `${(instrumento.nome || "instrumento").replace(/\s+/g, "-")}_${dateStr.replace(/\//g, "-")}`;
    doc.save(`relatorio_${safeName}.pdf`);
}

// Backwards-compat placeholder (some imports may still expect this name)
export { calcDominioInstrumento };

// Converts a Blob to a base64 string (no "data:" prefix) for sending as an email attachment.
export function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",").pop());
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// ─── Proposta de recuperação (gerada por IA e revista pelo professor) ─────────
// A fonte padrão do jsPDF só desenha WinAnsi (cp1252): converte símbolos comuns e troca o resto por "?".
const PDF_SIMBOLOS = { "≥": ">=", "≤": "<=", "≠": "!=", "≈": "~", "−": "-", "√": "raiz", "π": "pi", "∞": "infinito", "→": "->", "⇒": "=>" };
const PDF_CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

export function textoParaPdf(texto) {
    let out = "";
    for (const ch of String(texto ?? "")) {
        if (ch.charCodeAt(0) <= 255 || PDF_CP1252_EXTRA.includes(ch)) out += ch;
        else out += PDF_SIMBOLOS[ch] ?? "?";
    }
    return out;
}

function addPropostaRecuperacao(doc, proposta, incluirSolucoes) {
    const questoes = proposta?.questoes || [];
    if (!questoes.length) return;
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const maxW = W - 80;
    const limite = H - 60;

    function novaPagina() {
        doc.addPage();
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150, 155, 145);
        doc.text("Proposta gerada com apoio de IA e revista pelo professor.", 40, H - 18);
        return 50;
    }

    let y = novaPagina();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(44, 74, 59);
    doc.text("Proposta de recuperação", 40, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 100, 100);
    doc.text(doc.splitTextToSize("Atividade sugerida com base nas aprendizagens em que o desempenho recente foi mais fraco.", maxW), 40, y);
    y += 26;

    questoes.forEach((q, i) => {
        const cabecalho = `${i + 1}.${q.ae_code ? `  [${q.ae_code}]` : ""}`;
        const linhas = doc.splitTextToSize(textoParaPdf(q.enunciado), maxW - 22);
        const linhasSol = incluirSolucoes && q.solucao ? doc.splitTextToSize(`Solução: ${textoParaPdf(q.solucao)}`, maxW - 22) : [];
        const altura = 14 + linhas.length * 13 + (linhasSol.length ? linhasSol.length * 12 + 6 : 0) + 14;
        if (y + altura > limite) y = novaPagina();

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(44, 74, 59);
        doc.text(cabecalho, 40, y);
        y += 14;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(44, 62, 53);
        doc.text(linhas, 62, y);
        y += linhas.length * 13;
        if (linhasSol.length) {
            y += 6;
            doc.setFontSize(9);
            doc.setTextColor(138, 90, 25);
            doc.text(linhasSol, 62, y);
            y += linhasSol.length * 12;
        }
        y += 14;
    });
}

// ─── Relatório INDIVIDUAL por aluno (aprendizagens essenciais) ───────────────
// One PDF per aluno. Header includes aluno name + domain % breakdown, e.g. "Pedro Miguel (CP-89%, RRP-20%)".
// Body: table of aprendizagens x student % (single column) with <60% highlighted red.
function buildRelatorioAlunoDoc({ user, turma, aluno, instrumento, insts, proposta, incluirSolucoes }) {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-PT");
    const dominios = turma.dominios || [];

    // Domain percentages for this aluno (across instrumentos que contam para a final + turma OD, matches Dashboard)
    const domsPct = calcMediasDominioAluno(instsParaFinal(insts || [instrumento]), aluno.id, dominios, turma);
    const domBits = dominios
        .map((d) => (domsPct[d.code] != null ? `${d.code}-${Math.round(domsPct[d.code])}%` : `${d.code}-—`))
        .join(", ");
    const alunoLabel = `${aluno.nome} (${domBits})`;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(44, 74, 59);
    doc.text("Relatório individual por aprendizagens", 40, 44);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 100, 100);
    doc.text(`${turma.disciplina} · ${turma.ano} ${turma.turma} · ${instrumento.nome} (${instrumento.tipo})`, 40, 62);
    doc.text(`Gerado em ${dateStr}${user?.nome ? ` · Prof. ${user.nome}` : ""}`, 40, 76);

    doc.setDrawColor(229, 227, 219);
    doc.line(40, 90, doc.internal.pageSize.getWidth() - 40, 90);

    // "Situação atual" + aluno label (bold, wrapped)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 128, 118);
    doc.text("SITUAÇÃO ATUAL", 40, 104);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(44, 74, 59);
    const wrapped = doc.splitTextToSize(alunoLabel, doc.internal.pageSize.getWidth() - 80);
    doc.text(wrapped, 40, 120);
    let startY = 130 + (wrapped.length - 1) * 14;

    // Table rows: one per aprendizagem present in the instrumento
    const compsInInstrumento = Array.from(new Set((instrumento.questoes || []).map((q) => q.comp).filter(Boolean)));
    const compByCode = Object.fromEntries((turma.competencias || []).map((c) => [c.code, c]));

    const safeName = `${aluno.nome.replace(/\s+/g, "-")}_${(instrumento.nome || "").replace(/\s+/g, "-")}_${dateStr.replace(/\//g, "-")}`;

    if (!compsInInstrumento.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(158, 57, 33);
        doc.text(
            "Este instrumento ainda não tem aprendizagens associadas às questões. Edite o instrumento e atribua uma aprendizagem a cada questão.",
            40, startY + 12, { maxWidth: doc.internal.pageSize.getWidth() - 80 },
        );
        addPropostaRecuperacao(doc, proposta, incluirSolucoes);
        return { doc, safeName };
    }

    const cellStyles = {};
    const body = compsInInstrumento.map((code, rowIdx) => {
        const c = compByCode[code];
        const label = c?.nome || "(descritor em falta)";
        const qs = (instrumento.questoes || []).filter((q) => q.comp === code);
        const notas = (instrumento.notas || {})[aluno.id] || {};
        const totCot = qs.reduce((s, q) => s + Number(q.cotacao || 0), 0);
        const anyNota = qs.some((q) => notas[q.id] != null && notas[q.id] !== "");
        let pct = null;
        if (totCot > 0 && anyNota) {
            const weighted = qs.reduce((s, q) => s + (Number(notas[q.id] || 0) / NOTA_MAX) * Number(q.cotacao || 0), 0);
            pct = (weighted / totCot) * 100;
        }
        if (pct != null && pct < 60) {
            cellStyles[rowIdx] = { 2: { fillColor: [252, 218, 210], textColor: [138, 26, 26], fontStyle: "bold" } };
        }
        return [String(rowIdx + 1).padStart(2, "0"), label, pct != null ? pct.toFixed(1) + "%" : "—"];
    });

    autoTable(doc, {
        head: [["#", "Aprendizagem essencial", "%"]],
        body,
        startY,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 9.5, textColor: [44, 62, 53], lineColor: [229, 227, 219], lineWidth: 0.5, cellPadding: 6, overflow: "linebreak" },
        headStyles: { fillColor: [44, 74, 59], textColor: [249, 248, 246], fontStyle: "bold", fontSize: 9.5, halign: "center" },
        alternateRowStyles: { fillColor: [249, 248, 246] },
        columnStyles: {
            0: { cellWidth: 28, halign: "center" },
            1: { cellWidth: 380 },
            2: { cellWidth: 60, halign: "center" },
        },
        didParseCell(data) {
            if (data.section !== "body") return;
            const cs = cellStyles[data.row.index]?.[data.column.index];
            if (cs) Object.assign(data.cell.styles, cs);
        },
    });

    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(150, 155, 145);
    doc.text("Células a vermelho: aprendizagem abaixo de 60% da cotação.", 40, pageH - 30);
    doc.text("Relatório individual · gerado automaticamente", 40, pageH - 18);

    addPropostaRecuperacao(doc, proposta, incluirSolucoes);
    return { doc, safeName };
}

export function exportInstrumentoRelatorioAlunoPDF(params) {
    const { doc, safeName } = buildRelatorioAlunoDoc(params);
    doc.save(`relatorio_aluno_${safeName}.pdf`);
}

// Same report, returned as a Blob (for emailing) instead of triggering a download.
export function getInstrumentoRelatorioAlunoPDFBlob(params) {
    const { doc, safeName } = buildRelatorioAlunoDoc(params);
    return { blob: doc.output("blob"), filename: `relatorio_aluno_${safeName}.pdf` };
}
