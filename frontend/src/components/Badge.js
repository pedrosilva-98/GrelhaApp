import { getNivel, NIVEIS } from "@/lib/grelha";

export default function Badge({ v, level, testid }) {
    // v = numeric %, or provide level number directly
    let n;
    if (level != null) n = NIVEIS.find((x) => x.n === level);
    else if (v != null) n = getNivel(v);
    if (!n) return <span className="text-brand-sage text-xs">—</span>;
    return (
        <span
            data-testid={testid}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${n.badge} tracking-wide whitespace-nowrap`}
        >
            {n.label}
        </span>
    );
}
