import { useEffect, useState } from "react";
import { Star, Loader2 } from "lucide-react";
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

export default function AdminRatings() {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<HelpdeskScore[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
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
    void load();
  }, []);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" /> Memuat penilaian...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-display font-bold">Peringkat Helpdesk</h2>
        </div>
        {leaderboard.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Belum ada penilaian.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-mono uppercase tracking-widest text-muted-foreground">
                <th className="px-5 py-3">#</th>
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
        )}
      </div>

      {/* Detail rating */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-display font-bold">Detail Penilaian</h2>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">Belum ada penilaian.</div>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold">{r.code}</span>
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