import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { tournaments, participants, rounds, matches } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ParticipantManager } from "@/components/participant-manager";
import { StartTournamentButton } from "@/components/start-tournament-button";
import { BracketView } from "@/components/bracket-view";
import { StandingsTable } from "@/components/standings-table";
import { TournamentResults } from "@/components/tournament-results";
import { computeStandings } from "@/lib/tournament-engine/round-robin";

const formatLabels: Record<string, string> = {
  single_elim: "Single Elimination",
  double_elim: "Double Elimination",
  round_robin: "Round Robin",
  swiss: "Swiss",
};

export default async function TournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, id),
  });
  if (!tournament) notFound();

  const parts = await db.query.participants.findMany({
    where: eq(participants.tournamentId, id),
    orderBy: [asc(participants.seed)],
  });

  const allRounds = await db.query.rounds.findMany({
    where: eq(rounds.tournamentId, id),
    orderBy: [asc(rounds.roundNumber)],
  });

  const allMatches = await db.query.matches.findMany({
    where: eq(matches.tournamentId, id),
  });

  const participantsById = Object.fromEntries(parts.map((p) => [p.id, p]));

  const showStandings =
    tournament.format === "round_robin" || tournament.format === "swiss";

  const standings = showStandings
    ? computeStandings(
        parts.map((p) => ({ id: p.id, name: p.name, seed: p.seed })),
        allMatches
          .filter((m) => m.status === "complete")
          .map((m) => ({
            participant1Id: m.participant1Id,
            participant2Id: m.participant2Id,
            score1: m.score1,
            score2: m.score2,
            winnerId: m.winnerId,
          }))
      )
    : [];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All tournaments
        </Link>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">
              {tournament.name}
            </h1>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary">
                {formatLabels[tournament.format] ?? tournament.format}
              </Badge>
              <Badge variant={tournament.status === "complete" ? "default" : "outline"}>
                {tournament.status}
              </Badge>
            </div>
          </div>
          {tournament.status === "setup" && (
            <StartTournamentButton
              tournamentId={id}
              format={tournament.format}
              participants={parts.map((p) => ({ id: p.id, name: p.name, seed: p.seed }))}
            />
          )}
        </div>

        {tournament.status === "setup" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Participants</CardTitle>
            </CardHeader>
            <CardContent>
              <ParticipantManager tournamentId={id} participants={parts} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {tournament.status === "complete" && (
              <TournamentResults
                format={tournament.format}
                rounds={allRounds}
                matches={allMatches}
                participants={parts.map((p) => ({ id: p.id, name: p.name, seed: p.seed }))}
                participantsById={participantsById}
              />
            )}
            {showStandings && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Standings</CardTitle>
                </CardHeader>
                <CardContent>
                  <StandingsTable
                    standings={standings}
                    participantsById={participantsById}
                  />
                </CardContent>
              </Card>
            )}
            <BracketView
              tournamentId={id}
              format={tournament.format}
              rounds={allRounds}
              matches={allMatches}
              participantsById={participantsById}
              defaultBestOf={(tournament.settings as { bestOf?: number } | null)?.bestOf ?? 1}
            />
          </div>
        )}
      </main>
    </div>
  );
}
