import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calcMediaFinal, calcMediasDominioAluno, getNivel, calcDominioInstrumento, NOTA_MAX } from "@/lib/grelha";

// ─── Avaliação final (grelha da turma) ───────────────────────────────────────
export function exportGrelhaPDF({ user, turma, alunos, insts }) {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-PT");
    const dominios = turma.dominios || [];

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

    const head = [["#", "Aluno", ...dominios.map((d) => d.code), "Média", "Nível"]];
    const body = alunos.map((a, i) => {
        const doms = calcMediasDominioAluno(insts, a.id, dominios);
        const media = calcMediaFinal(insts, dominios, a.id);
        const nivel = getNivel(media);
        return [
            String(i + 1).padStart(2, "0"),
            a.nome,
            ...dominios.map((d) => (doms[d.code] != null ? doms[d.code].toFixed(1) + "%" : "—")),
            media != null ? media.toFixed(1) + "%" : "—",
            nivel ? String(nivel.n) : "—",
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
    const instText = insts.length
        ? insts.map((i) => `• ${i.nome} (${i.tipo}${i.data ? " · " + i.data : ""})`).join("     ")
        : "Sem instrumentos.";
    doc.text(doc.splitTextToSize(instText, doc.internal.pageSize.getWidth() - 80), 40, y + 10);

    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(150, 155, 145);
    doc.text("Avaliação final · gerado automaticamente", 40, pageH - 20);

    const safeName = `${turma.turma}_${(turma.disciplina || "").replace(/\s+/g, "-")}_${dateStr.replace(/\//g, "-")}`;
    doc.save(`avaliacao_final_${safeName}.pdf`);
}

// ─── Relatório por instrumento (competências essenciais) ─────────────────────
// Para cada aluno e cada competência presente no instrumento:
//   % = (Σ nota_i/10 × cot_i) / (Σ cot_i) × 100
// Assinala em vermelho as competências com < 60%.
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
    doc.text("Relatório por competências", 40, 40);

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
            "Este instrumento ainda não tem competências associadas às questões. Edite o instrumento e atribua uma competência a cada questão para gerar este relatório.",
            40, 100, { maxWidth: doc.internal.pageSize.getWidth() - 80 },
        );
        doc.save(`relatorio_${instrumento.nome.replace(/\s+/g, "-")}_${dateStr.replace(/\//g, "-")}.pdf`);
        return;
    }

    // Legend of competências
    doc.setFontSize(9);
    doc.setTextColor(90, 100, 100);
    doc.setFont("helvetica", "bold");
    doc.text("Competências avaliadas neste instrumento:", 40, 88);
    doc.setFont("helvetica", "normal");
    const lines = compsInInstrumento.map((code) => {
        const c = compByCode[code];
        return `  • ${code} — ${c?.nome || "(descritor em falta)"}`;
    });
    const legend = doc.splitTextToSize(lines.join("\n"), doc.internal.pageSize.getWidth() - 80);
    doc.text(legend, 40, 102);
    const startY = 102 + legend.length * 10 + 12;

    // Table: rows = alunos, cols = comp codes + "Global"
    const head = [["#", "Aluno", ...compsInInstrumento, "Global"]];

    // Compute value + flag <60 for cell styling
    const cellStyles = {}; // {rowIdx: {colIdx: {fillColor}}}
    const body = alunos.map((a, i) => {
        const row = [String(i + 1).padStart(2, "0"), a.nome];
        cellStyles[i] = {};
        compsInInstrumento.forEach((code, j) => {
            // subset instrument questoes to this comp
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
            // Column index in body: j + 2 (after # and Aluno)
            if (pct != null && pct < 60) {
                cellStyles[i][j + 2] = { fillColor: [252, 218, 210], textColor: [138, 26, 26], fontStyle: "bold" };
            }
        });
        // Global for this instrumento
        const totCot = instrumento.questoes.reduce((s, q) => s + Number(q.cotacao || 0), 0);
        const notas = (instrumento.notas || {})[a.id] || {};
        const anyNota = instrumento.questoes.some((q) => notas[q.id] != null && notas[q.id] !== "");
        let global = null;
        if (totCot > 0 && anyNota) {
            const w = instrumento.questoes.reduce((s, q) => s + (Number(notas[q.id] || 0) / NOTA_MAX) * Number(q.cotacao || 0), 0);
            global = (w / totCot) * 100;
        }
        row.push(global != null ? global.toFixed(1) + "%" : "—");
        return row;
    });

    autoTable(doc, {
        head, body, startY,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 9, textColor: [44, 62, 53], lineColor: [229, 227, 219], lineWidth: 0.5, cellPadding: 6 },
        headStyles: { fillColor: [44, 74, 59], textColor: [249, 248, 246], fontStyle: "bold", fontSize: 9 },
        alternateRowStyles: { fillColor: [249, 248, 246] },
        columnStyles: {
            0: { cellWidth: 26, halign: "center" },
            1: { cellWidth: 160 },
        },
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
        doc.text(
            `• ${code} — média ${avg}%  |  ${low}/${total} aluno(s) abaixo de 60%`,
            40, y, { maxWidth: doc.internal.pageSize.getWidth() - 80 },
        );
        y += 12;
    });

    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(150, 155, 145);
    doc.text("Células a vermelho: aluno abaixo de 60% da cotação nessa competência.", 40, pageH - 32);
    doc.text("Relatório por competências · gerado automaticamente", 40, pageH - 20);

    const safeName = `${(instrumento.nome || "instrumento").replace(/\s+/g, "-")}_${dateStr.replace(/\//g, "-")}`;
    doc.save(`relatorio_${safeName}.pdf`);
}

// Backwards-compat placeholder (some imports may still expect this name)
export { calcDominioInstrumento };
