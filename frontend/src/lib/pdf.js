import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DOM_KEYS, DOMINIOS, calcMediaFinal, calcMediasDominioAluno, getNivel } from "@/lib/grelha";

export function exportGrelhaPDF({ user, alunos, insts, ponderacoes }) {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-PT");

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(44, 74, 59);
    doc.text("Grelha de Avaliação", 40, 40);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 100, 100);
    const sub = `${user?.disciplina || ""} · ${user?.ano || ""} ${user?.turma || ""} · Prof. ${user?.nome || ""}`;
    doc.text(sub, 40, 58);
    doc.text(`Gerado em ${dateStr}`, doc.internal.pageSize.getWidth() - 40, 40, { align: "right" });

    doc.setDrawColor(229, 227, 219);
    doc.line(40, 70, doc.internal.pageSize.getWidth() - 40, 70);

    // Ponderações line
    const pondLine = DOM_KEYS.map((d) => `${d}: ${ponderacoes[d]}%`).join("   ·   ");
    doc.setFontSize(9);
    doc.setTextColor(90, 100, 100);
    doc.text(`Ponderações — ${pondLine}`, 40, 88);

    // Table
    const head = [["#", "Aluno", ...DOM_KEYS, "Média", "Nível"]];
    const body = alunos.map((a, i) => {
        const doms = calcMediasDominioAluno(insts, a.id);
        const media = calcMediaFinal(insts, ponderacoes, a.id);
        const nivel = getNivel(media);
        return [
            String(i + 1).padStart(2, "0"),
            a.nome,
            ...DOM_KEYS.map((d) => (doms[d] != null ? doms[d].toFixed(1) + "%" : "—")),
            media != null ? media.toFixed(1) + "%" : "—",
            nivel ? nivel.label : "—",
        ];
    });

    autoTable(doc, {
        head, body,
        startY: 100,
        theme: "grid",
        styles: { font: "helvetica", fontSize: 9, textColor: [44, 62, 53], lineColor: [229, 227, 219], lineWidth: 0.5, cellPadding: 6 },
        headStyles: { fillColor: [44, 74, 59], textColor: [249, 248, 246], fontStyle: "bold", fontSize: 9 },
        alternateRowStyles: { fillColor: [249, 248, 246] },
        columnStyles: {
            0: { cellWidth: 30, halign: "center" },
            1: { cellWidth: 180 },
            2: { halign: "center", textColor: DOMINIOS.CP.color.match(/[0-9A-F]{2}/g)?.map((h) => parseInt(h, 16)) || [44, 74, 59] },
            3: { halign: "center" },
            4: { halign: "center" },
            5: { halign: "center" },
            6: { halign: "center", fontStyle: "bold" },
            7: { halign: "center" },
        },
    });

    // Instrumentos summary
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

    // Footer
    const pageH = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(150, 155, 145);
    doc.text("Grelha de Avaliação · gerado automaticamente", 40, pageH - 20);

    const safeName = `${(user?.turma || "turma")}_${(user?.disciplina || "").replace(/\s+/g, "-")}_${dateStr.replace(/\//g, "-")}`;
    doc.save(`grelha_${safeName}.pdf`);
}
