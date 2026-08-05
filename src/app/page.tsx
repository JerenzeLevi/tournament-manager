import Link from "next/link";
import Image from "next/image";
import { getDb } from "@/db";
import { tournaments } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { CreateTournamentDialog } from "@/components/create-tournament-dialog";

export const dynamic = "force-dynamic";

const formatLabels: Record<string, string> = {
  single_elim: "Single Elimination",
  double_elim: "Double Elimination",
  round_robin: "Round Robin",
  swiss: "Swiss",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function Home() {
  const db = getDb();
  const all = await db.query.tournaments.findMany({
    orderBy: [desc(tournaments.createdAt)],
    with: { participants: true },
  });

  return (
    <div className="min-h-screen">
      <section className="relative isolate overflow-hidden">
        <Image
          src="/apex-bg.png"
          alt=""
          fill
          priority
          aria-hidden
          className="scale-110 object-cover object-[50%_20%] opacity-25 blur-2xl"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
        <div
          className="absolute inset-0 opacity-70 mix-blend-screen"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 60% at 80% 30%, rgba(124, 58, 237, 0.35), transparent 70%)",
          }}
        />

        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.3em] text-primary/80">
              Breaking the system
            </p>
            <h1 className="font-heading text-5xl font-bold tracking-tight text-foreground sm:text-7xl">
              Tournament Manager
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted-foreground">
              The architecture of competition.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <CreateTournamentDialog />
              <a
                href="#tournaments"
                className="inline-flex h-9 items-center rounded-lg border border-border/60 bg-background/40 px-4 text-sm font-medium text-foreground/90 backdrop-blur transition-colors hover:border-primary/50 hover:text-foreground"
              >
                Browse Tournaments
              </a>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <div className="absolute -inset-6 rounded-[2rem] bg-primary/20 opacity-60 blur-3xl" />
            <div className="relative aspect-[1122/1402] w-full overflow-hidden rounded-3xl border border-border/60 shadow-[0_0_60px_rgba(124,58,237,0.25)]">
              <Image
                src="/apex-bg.png"
                alt="Breaking the System — the apex of competition"
                fill
                priority
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div id="tournaments">
          {all.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No tournaments yet. Create one to begin.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {all.map((t) => (
                <Link key={t.id} href={`/t/${t.id}`} className="group">
                  <div className="rounded-2xl border border-border bg-card p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-[0_0_24px_rgba(124,58,237,0.15)]">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-heading text-lg font-medium">{t.name}</h2>
                      <Badge variant={t.status === "complete" ? "default" : "outline"}>
                        {t.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatLabels[t.format] ?? t.format}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">
                        {t.participants.length} {t.participants.length === 1 ? "player" : "players"}
                      </span>
                      <span className="font-mono">{dateFormatter.format(t.createdAt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
