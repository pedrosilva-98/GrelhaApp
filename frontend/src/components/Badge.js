import { getNivel, NIVEIS } from "@/lib/grelha";

export default function Badge({ v, level, mode = "label", testid }) {
    // mode: "label" (default, e.g. "Muito Bom") or "number" (e.g. "5")
    let n;
    if (level != null) n = NIVEIS.find((x) => x.n === level);
    else if (v != null) n = getNivel(v);
    if (!n) return <span className="text-brand-sage text-xs">—</span>;
    const text = mode === "number" ? String(n.n) : n.label;
    return (
        <span
            data-testid={testid}
            className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${n.badge} tracking-wide whitespace-nowrap ${mode === "number" ? "font-mono min-w-[26px]" : ""}`}
        >
            {text}
        </span>
    );
}
