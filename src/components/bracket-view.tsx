import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BracketTree } from "@/components/bracket-tree";
import { RoundsBoard } from "@/components/rounds-board";
import { MatchCard } from "@/components/match-card";

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

export function BracketView({
  tournamentId,
  format,
  rounds,
  matches,
  participantsById,
  defaultBestOf,
}: {
  tournamentId: string;
  format: string;
  rounds: Round[];
  matches: Match[];
  participantsById: Record<string, { name: string }>;
  defaultBestOf: number;
}) {
  const matchesByRound = new Map<string, Match[]>();
  for (const m of matches) {
    const list = matchesByRound.get(m.roundId) ?? [];
    list.push(m);
    matchesByRound.set(m.roundId, list);
  }
  const sortedMatches = (roundId: string) =>
    (matchesByRound.get(roundId) ?? []).sort((a, b) => a.bracketSlot - b.bracketSlot);
  const bestOfFor = (r: Round) => r.bestOf ?? defaultBestOf;

  if (format === "single_elim") {
    const thirdPlaceRound = rounds.find((r) => r.roundNumber === -1);
    const thirdPlaceMatch = thirdPlaceRound ? sortedMatches(thirdPlaceRound.id)[0] : undefined;
    const sorted = rounds
      .filter((r) => r.roundNumber !== -1)
      .sort((a, b) => a.roundNumber - b.roundNumber);
    const bracketRounds = sorted.map((r) => ({
      id: r.id,
      label: r.label,
      matches: sortedMatches(r.id),
      bestOf: bestOfFor(r),
      connector: "halve" as const,
    }));
    return (
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bracket</CardTitle>
          </CardHeader>
          <CardContent>
            <BracketTree tournamentId={tournamentId} rounds={bracketRounds} participantsById={participantsById} />
          </CardContent>
        </Card>
        {thirdPlaceRound && thirdPlaceMatch && (
          <Card className="max-w-xs">
            <CardHeader>
              <CardTitle className="text-base">Third Place Match</CardTitle>
            </CardHeader>
            <CardContent>
              <MatchCard
                tournamentId={tournamentId}
                match={thirdPlaceMatch}
                participantsById={participantsById}
                bestOf={bestOfFor(thirdPlaceRound)}
              />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (format === "double_elim") {
    const winnersRounds = rounds
      .filter((r) => r.roundNumber < 1000)
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .map((r) => ({
        id: r.id,
        label: r.label,
        matches: sortedMatches(r.id),
        bestOf: bestOfFor(r),
        connector: "halve" as const,
      }));
    const losersRoundsRaw = rounds
      .filter((r) => r.roundNumber >= 1000 && r.roundNumber < 2000)
      .sort((a, b) => a.roundNumber - b.roundNumber);
    const grandFinalsRound = rounds.find((r) => r.roundNumber >= 2000);
    const grandFinalsMatch = grandFinalsRound ? sortedMatches(grandFinalsRound.id)[0] : undefined;

    // Losers bracket alternates: a round with the same match count as the previous one
    // (a WB-loser dropdown round) connects with a single straight line; a round with
    // half as many matches (a consolidation round) connects with the classic doubling bar.
    let prevCount: number | null = null;
    const losersRounds = losersRoundsRaw.map((r) => {
      const count = sortedMatches(r.id).length;
      const connector: "halve" | "straight" | undefined =
        prevCount === null ? undefined : count === prevCount ? "straight" : "halve";
      prevCount = count;
      return { id: r.id, label: r.label, matches: sortedMatches(r.id), bestOf: bestOfFor(r), connector };
    });

    const winnersMatchTotal = winnersRounds.reduce((sum, r) => sum + r.matches.length, 0);

    return (
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Winners Bracket</CardTitle>
          </CardHeader>
          <CardContent>
            <BracketTree
              tournamentId={tournamentId}
              rounds={winnersRounds}
              participantsById={participantsById}
              trailing={
                grandFinalsRound && grandFinalsMatch
                  ? {
                      id: grandFinalsRound.id,
                      label: grandFinalsRound.label,
                      match: grandFinalsMatch,
                      bestOf: bestOfFor(grandFinalsRound),
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
        {losersRounds.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Losers Bracket</CardTitle>
            </CardHeader>
            <CardContent>
              <BracketTree
                tournamentId={tournamentId}
                rounds={losersRounds}
                participantsById={participantsById}
                matchNumberStart={winnersMatchTotal + 1}
              />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <RoundsBoard
      tournamentId={tournamentId}
      rounds={rounds}
      matches={matches}
      participantsById={participantsById}
      bestOfFor={bestOfFor}
    />
  );
}
