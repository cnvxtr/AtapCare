import { useEffect, useState } from "react";
import { Check, ChevronDown, Star } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  getRatings,
  type RatingRow,
  type HelpdeskScore,
} from "@/services";

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-4 w-4 ${s <= n ? "text-amber-400 fill-current" : "text-muted-foreground/40"}`} />
      ))}
    </span>
  );
}

function StarCount({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`h-3.5 w-3.5 ${s <= n ? "text-amber-400 fill-current" : "opacity-30"}`} />
      ))}
    </span>
  );
}

export default function AdminRatings() {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<HelpdeskScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [starFilter, setStarFilter] = useState<number | null>(null);

  const load = async () => {
    try {
      const { rows, leaderboard } = await getRatings();
      setRows(rows);
      setLeaderboard(leaderboard);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-display font-bold">Peringkat Helpdesk</h2>
        </div>
        {loading ? null : leaderboard.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Belum ada penilaian.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border text-left text-xs font-mono uppercase tracking-widest text-muted-foreground">
                <th className="px-5 py-3">No</th>
                <th className="px-5 py-3">Helpdesk</th>
                <th className="px-5 py-3 text-center">Rata-rata</th>
                <th className="px-5 py-3 text-center">Total Bintang</th>
                <th className="px-5 py-3 text-center">Total Rating</th>
                <th className="px-5 py-3 text-center">Tiket Divalidasi</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((h, i) => (
                <tr key={h.userId ?? h.name} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-semibold">{i + 1}</td>
                  <td className="px-5 py-3 font-medium">{h.name}</td>
                  <td className="px-5 py-3 text-center">{h.avg.toFixed(1)}</td>
                  <td className="px-5 py-3 text-center text-amber-500">{h.totalStars}</td>
                  <td className="px-5 py-3 text-center">{h.total}</td>
                  <td className="px-5 py-3 text-center">{h.validated}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Detail rating */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-display font-bold">Detail Penilaian</h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="px-2 h-8 bg-card border border-border rounded text-[13px] text-foreground gap-1 whitespace-nowrap flex items-center justify-between cursor-pointer">
                <span className="inline-flex items-center gap-1">
                  {starFilter === null ? "Semua Bintang" : `Bintang ${starFilter}`}
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-current shrink-0" />
                </span>
                <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-border bg-card text-foreground p-1.5 min-w-[150px]">
              {[null, 5, 4, 3, 2, 1].map((v, idx) => (
                <DropdownMenuItem
                  key={idx}
                  onClick={() => setStarFilter(v)}
                  className={`relative flex items-center rounded-sm py-1.5 pl-2 pr-8 text-sm cursor-pointer mb-px ${starFilter === v ? "bg-foreground text-primary-foreground" : "hover:bg-foreground hover:text-primary-foreground"}`}
                >
                  <span>
                    {v === null ? "Semua" : <StarCount n={v} />}
                  </span>
                  <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                    {starFilter === v && <Check className="h-4 w-4" />}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {loading ? null : rows.filter(r => starFilter === null || r.rating === starFilter).length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Belum ada penilaian.</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.filter(r => starFilter === null || r.rating === starFilter).map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold max-md:text-xs">{r.code}</span>
                      <Stars n={r.rating} />
                      <span className="text-xs text-muted-foreground">{fmtDate(r.closedAt)}</span>
                    </div>
                    <p className="text-sm mt-1 text-muted-foreground">
                      {r.customer} · {r.helpdeskName || "Helpdesk?"}
                    </p>
                  </div>
                </div>
                {r.review && <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{r.review}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}