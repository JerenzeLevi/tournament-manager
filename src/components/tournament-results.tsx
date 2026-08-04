import { Trophy, Medal, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { computeStandings } from "@/lib/tournament-engine/round-robin";

interface Round {
  id: string;
  roundNumber: number;
}

interface Match {
  id: string;
  roundId: string;
  participant1Id: string | null;
  participant2Id: string | null;
  winnerId: string | null;
  status: string;
  bracketSide: string | null;
}

interface Placement {
  rank: string;
  label: string;
  participantId: string;
}

function computeSingleElimPlacements(rounds: Round[], matches: Match[]): Placement[] {
  const byRound = new Map<string, Match[]>();
  for (const m of matches) {
    const list = byRound.get(m.roundId) ?? [];
    list.push(m);
    byRound.set(m.roundId, list);
  }
  const mainRounds = rounds.filter((r) => r.roundNumber !== -1);
  if (mainRounds.length === 0) return [];
  const finalRound = mainRounds.reduce((a, b) => (a.roundNumber > b.roundNumber ? a : b));
  const finalMatch = (byRound.get(finalRound.id) ?? [])[0];
  if (!finalMatch?.winnerId) return [];

  const placements: Placement[] = [
    { rank: "1st", label: "Champion", participantId: finalMatch.winnerId },
  ];
  const runnerUpId =
    finalMatch.winnerId === finalMatch.participant1Id
      ? finalMatch.participant2Id
      : finalMatch.participant1Id;
  if (runnerUpId) placements.push({ rank: "2nd", label: "Runner-up", participantId: runnerUpId });

  const thirdPlaceRound = rounds.find((r) => r.roundNumber === -1);
  const thirdPlaceMatch = thirdPlaceRound ? (byRound.get(thirdPlaceRound.id) ?? [])[0] : undefined;
  if (thirdPlaceMatch?.winnerId) {
    placements.push({ rank: "3rd", label: "3rd Place", participantId: thirdPlaceMatch.winnerId });
    const fourthId =
      thirdPlaceMatch.winnerId === thirdPlaceMatch.participant1Id
        ? thirdPlaceMatch.participant2Id
        : thirdPlaceMatch.participant1Id;
    if (fourthId) placements.push({ rank: "4th", label: "4th Place", participantId: fourthId });
  }
  return placements;
}

function computeDoubleElimPlacements(rounds: Round[], matches: Match[]): Placement[] {
  const byRound = new Map<string, Match[]>();
  for (const m of matches) {
    const list = byRound.get(m.roundId) ?? [];
    list.push(m);
    byRound.set(m.roundId, list);
  }
  const grandFinalsRound = rounds.find((r) => r.roundNumber >= 2000);
  const grandFinalsMatch = grandFinalsRound ? (byRound.get(grandFinalsRound.id) ?? [])[0] : undefined;
  if (!grandFinalsMatch?.winnerId) return [];

  const placements: Placement[] = [
    { rank: "1st", label: "Champion", participantId: grandFinalsMatch.winnerId },
  ];
  const runnerUpId =
    grandFinalsMatch.winnerId === grandFinalsMatch.participant1Id
      ? grandFinalsMatch.participant2Id
      : grandFinalsMatch.participant1Id;
  if (runnerUpId) placements.push({ rank: "2nd", label: "Runner-up", participantId: runnerUpId });

  const losersRounds = rounds.filter((r) => r.roundNumber >= 1000 && r.roundNumber < 2000);
  if (losersRounds.length > 0) {
    const losersFinal = losersRounds.reduce((a, b) => (a.roundNumber > b.roundNumber ? a : b));
    const losersFinalMatch = (byRound.get(losersFinal.id) ?? [])[0];
    if (losersFinalMatch?.winnerId) {
      const thirdId =
        losersFinalMatch.winnerId === losersFinalMatch.participant1Id
          ? losersFinalMatch.participant2Id
          : losersFinalMatch.participant1Id;
      if (thirdId) placements.push({ rank: "3rd", label: "3rd Place", participantId: thirdId });
    }
  }
  return placements;
}

const RANK_ICON: Record<string, typeof Trophy> = {
  "1st": Trophy,
  "2nd": Medal,
  "3rd": Award,
};

export function TournamentResults({
  format,
  rounds,
  matches,
  participants,
  participantsById,
}: {
  format: string;
  rounds: Round[];
  matches: Match[];
  participants: { id: string; name: string; seed: number }[];
  participantsById: Record<string, { name: string }>;
}) {
  let placements: Placement[] = [];

  if (format === "single_elim") {
    placements = computeSingleElimPlacements(rounds, matches);
  } else if (format === "double_elim") {
    placements = computeDoubleElimPlacements(rounds, matches);
  } else {
    const standings = computeStandings(
      participants,
      matches
        .filter((m) => m.status === "complete")
        .map((m) => ({
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          score1: null,
          score2: null,
          winnerId: m.winnerId,
        }))
    );
    const labels = ["1st", "2nd", "3rd", "4th", "5th"];
    placements = standings.slice(0, 5).map((s, i) => ({
      rank: labels[i] ?? `${i + 1}th`,
      label: i === 0 ? "Champion" : i === 1 ? "Runner-up" : `${labels[i]} Place`,
      participantId: s.participantId,
    }));
  }

  if (placements.length === 0) return null;

  const champion = placements[0];
  const rest = placements.slice(1);

  return (
    <Card className="overflow-hidden border-primary/30">
      <CardHeader>
        <CardTitle className="text-base">Final Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-2 rounded-xl bg-gradient-to-b from-primary/10 to-transparent py-8 text-center">
          <Trophy className="size-8 text-warning" />
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Champion
          </p>
          <p className="font-heading text-3xl font-bold">
            {participantsById[champion.participantId]?.name ?? "—"}
          </p>
        </div>

        {rest.length > 0 && (
          <ul className="mt-4 grid gap-1.5">
            {rest.map((p) => {
              const Icon = RANK_ICON[p.rank] ?? Award;
              return (
                <li
                  key={p.rank}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="w-10 shrink-0 font-mono text-muted-foreground">{p.rank}</span>
                  <span className="flex-1">{participantsById[p.participantId]?.name ?? "—"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
