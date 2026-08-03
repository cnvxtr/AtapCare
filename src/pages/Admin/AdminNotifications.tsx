import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, Send, CalendarClock, Clock } from "lucide-react";
import {
  getBroadcasts,
  createBroadcast,
  cancelBroadcast,
  RECIPIENT_OPTIONS,
  type Broadcast,
} from "@/services";

const statusStyle: Record<string, string> = {
  terkirim: "bg-emerald-50 text-emerald-700 border-emerald-200",
  terjadwal: "bg-amber-50 text-amber-700 border-amber-200",
  dibatalkan: "bg-muted text-muted-foreground border-border",
};

const statusLabel: Record<string, string> = {
  terkirim: "Terkirim",
  terjadwal: "Terjadwal",
  dibatalkan: "Dibatalkan",
};

function recipientLabel(value: string): string {
  return RECIPIENT_OPTIONS.find((o) => o.value === value)?.label || value;
}

export function AdminNotifications() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [recipients, setRecipients] = useState("semua");
  const [scheduleNow, setScheduleNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    setBroadcasts(await getBroadcasts());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSend() {
    if (!title.trim()) {
      toast.error("Judul pengumuman wajib diisi");
      return;
    }
    if (!scheduleNow && !scheduledAt) {
      toast.error("Pilih jadwal kirim terlebih dahulu");
      return;
    }
    setSending(true);
    const res = await createBroadcast({
      title,
      message,
      recipients,
      scheduleNow,
      scheduledAt: scheduleNow ? undefined : new Date(scheduledAt).toISOString(),
    });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error || "Gagal mengirim pengumuman");
      return;
    }
    toast.success(scheduleNow ? "Pengumuman terkirim" : "Pengumuman terjadwal");
    setTitle("");
    setMessage("");
    setScheduledAt("");
    setScheduleNow(true);
    load();
  }

  async function handleCancel(id: string) {
    const ok = await cancelBroadcast(id);
    if (ok) {
      toast.success("Pengumuman dibatalkan");
      load();
    } else {
      toast.error("Gagal membatalkan");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            Buat Pengumuman
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Judul</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="cth. Pemadaman listrik area Sudirman, 3 Agustus"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Isi Pengumuman</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Detail pengumuman yang ingin disampaikan…"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Penerima</label>
            <Select value={recipients} onValueChange={setRecipients}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih penerima" />
              </SelectTrigger>
              <SelectContent>
                {RECIPIENT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={scheduleNow ? "default" : "outline"}
              size="sm"
              onClick={() => setScheduleNow(true)}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" /> Kirim Sekarang
            </Button>
            <Button
              type="button"
              variant={!scheduleNow ? "default" : "outline"}
              size="sm"
              onClick={() => setScheduleNow(false)}
            >
              <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> Jadwalkan
            </Button>
          </div>
          {!scheduleNow && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Jadwal Kirim</label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
          )}
          <Button onClick={handleSend} disabled={sending} className="w-full">
            {sending ? "Mengirim…" : scheduleNow ? "Kirim Pengumuman" : "Simpan Jadwal"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Pengumuman</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Memuat…</p>
          ) : broadcasts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Belum ada pengumuman.</p>
          ) : (
            <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
              {broadcasts.map((b) => (
                <div key={b.id} className="p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground leading-snug">{b.title}</p>
                    <Badge variant="outline" className={`shrink-0 ${statusStyle[b.status] || ""}`}>
                      {statusLabel[b.status] || b.status}
                    </Badge>
                  </div>
                  {b.message && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                      {b.message}
                    </p>
                  )}
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {recipientLabel(b.recipients)}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(b.created_at).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    {b.status === "terjadwal" && (
                      <button
                        onClick={() => handleCancel(b.id)}
                        className="text-red-500 hover:underline"
                      >
                        Batalkan
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

