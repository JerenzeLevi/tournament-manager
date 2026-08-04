import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MatchCard } from "@/components/match-card";
import { RoundBestOfEditor } from "@/components/round-best-of-editor";

interface Round {
  id: string;
  roundNumber: number;
  label: string;
  bestOf: number | null;
}

interface Match {
  id: string;
  roundId: string;
  participant1Id: string | null;
  participant2Id: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  status: string;
  bracketSlot: number;
  bracketSide: string | null;
}

export function RoundsBoard({
  tournamentId,
  rounds,
  matches,
  participantsById,
  bestOfFor,
}: {
  tournamentId: string;
  rounds: Round[];
  matches: Match[];
  participantsById: Record<string, { name: string }>;
  bestOfFor: (round: Round) => number;
}) {
  const matchesByRound = new Map<string, Match[]>();
  for (const m of matches) {
    const list = matchesByRound.get(m.roundId) ?? [];
    list.push(m);
    matchesByRound.set(m.roundId, list);
  }

  const sides = [...new Set(rounds.map((r) => sideLabel(r.roundNumber)))];

  return (
    <div className="grid gap-8">
      {sides.map((side) => {
        const sideRounds = rounds.filter((r) => sideLabel(r.roundNumber) === side);
        return (
          <div key={side}>
            {sides.length > 1 && (
              <h2 className="mb-3 text-sm font-medium text-zinc-500">{side}</h2>
            )}
            <div className="flex gap-4 overflow-x-auto pb-2">
              {sideRounds.map((round) => (
                <div key={round.id} className="w-64 shrink-0">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm">{round.label}</CardTitle>
                      <RoundBestOfEditor
                        tournamentId={tournamentId}
                        roundId={round.id}
                        bestOf={bestOfFor(round)}
                      />
                    </CardHeader>
                    <CardContent className="grid gap-3">
                      {(matchesByRound.get(round.id) ?? [])
                        .sort((a, b) => a.bracketSlot - b.bracketSlot)
                        .map((m) => (
                          <MatchCard
                            key={m.id}
                            tournamentId={tournamentId}
                            match={m}
                            participantsById={participantsById}
                            bestOf={bestOfFor(round)}
                          />
                        ))}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function sideLabel(roundNumber: number): string {
  if (roundNumber >= 2000) return "Grand Finals";
  if (roundNumber >= 1000) return "Losers Bracket";
  return "Winners Bracket";
}
