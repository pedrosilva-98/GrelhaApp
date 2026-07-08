import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { calcMediaFinal, calcMediasDominioAluno, getNivel } from "@/lib/grelha";

export function exportGrelhaPDF({ user, turma, alunos, insts }) {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-PT");
    const dominios = turma.dominios || [];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(44, 74, 59);
    doc.text("Grelha de Avaliação", 40, 40);

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
            nivel ? nivel.label : "—",
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
    doc.text("Grelha de Avaliação · gerado automaticamente", 40, pageH - 20);

    const safeName = `${turma.turma}_${(turma.disciplina || "").replace(/\s+/g, "-")}_${dateStr.replace(/\//g, "-")}`;
    doc.save(`grelha_${safeName}.pdf`);
}
