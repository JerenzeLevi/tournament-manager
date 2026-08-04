import { MatchCard } from "@/components/match-card";
import { RoundBestOfEditor } from "@/components/round-best-of-editor";

const SLOT_HEIGHT = 132; // px, vertical space reserved per match — generous gap by design
const CARD_HEIGHT = 92; // px, actual card height (leaves whitespace above/below in its slot)
const GAP = 40; // px, column gap — split evenly between the two connector stubs
const COL_WIDTH = 216;

interface Match {
  id: string;
  participant1Id: string | null;
  participant2Id: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  status: string;
  bracketSlot: number;
}

interface Round {
  id: string;
  label: string;
  matches: Match[];
  bestOf: number;
  /** How this round's matches connect to the previous round's:
   *  'halve' = classic bracket doubling (two feeders merge into one line+bar),
   *  'straight' = same match count as previous round (1:1, single line, no bar),
   *  omitted/first round = no connector drawn. */
  connector?: "halve" | "straight";
}

/**
 * Renders a bracket tree with connector lines drawn via CSS only — no JS measurement
 * needed. Every column shares the same total height and uses
 * `justify-content: space-around` (or `space-evenly` for 'straight' rounds, which keep
 * the same match count), so matches land exactly where their connector lines expect.
 */
export function BracketTree({
  tournamentId,
  rounds,
  participantsById,
  trailing,
  matchNumberStart = 1,
}: {
  tournamentId: string;
  rounds: Round[];
  participantsById: Record<string, { name: string }>;
  /** An extra terminal node (e.g. Grand Finals) connected by a single straight line
   * from the last round, without a doubling relationship. */
  trailing?: { id: string; label: string; match: Match; bestOf: number };
  /** Match numbers are labeled globally across the whole tournament, not per-column. */
  matchNumberStart?: number;
}) {
  if (rounds.length === 0) return null;
  const baseHeight = rounds[0].matches.length * SLOT_HEIGHT;
  let matchCounter = matchNumberStart;

  return (
    <div className="flex overflow-x-auto pb-4" style={{ gap: GAP }}>
      {rounds.map((round, ri) => (
        <div key={round.id} className="flex shrink-0 flex-col" style={{ width: COL_WIDTH }}>
          <div className="mb-3 flex items-center justify-center gap-2 text-center text-xs font-medium text-zinc-500">
            <span>{round.label}</span>
            <RoundBestOfEditor tournamentId={tournamentId} roundId={round.id} bestOf={round.bestOf} />
          </div>
          <div className="flex flex-col justify-around" style={{ height: baseHeight }}>
            {round.matches.map((m) => {
              const label = `Match ${matchCounter++}`;
              return (
                <div
                  key={m.id}
                  className={`relative flex items-center ${
                    round.connector === "halve"
                      ? "bracket-connector"
                      : round.connector === "straight"
                        ? "bracket-connector-straight"
                        : ""
                  }`}
                  style={{ height: baseHeight / round.matches.length }}
                >
                  <div
                    className={`relative w-full ${ri < rounds.length - 1 || trailing ? "bracket-stub-right" : ""}`}
                    style={{ height: CARD_HEIGHT }}
                  >
                    <div className="absolute -top-5 left-0.5 text-[10px] font-medium text-zinc-400">
                      {label}
                    </div>
                    <MatchCard
                      tournamentId={tournamentId}
                      match={m}
                      participantsById={participantsById}
                      fixedHeight
                      bestOf={round.bestOf}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {trailing && (
        <div className="flex shrink-0 flex-col" style={{ width: COL_WIDTH }}>
          <div className="mb-3 flex items-center justify-center gap-2 text-center text-xs font-medium text-zinc-500">
            <span>{trailing.label}</span>
            <RoundBestOfEditor tournamentId={tournamentId} roundId={trailing.id} bestOf={trailing.bestOf} />
          </div>
          <div className="flex items-center bracket-connector-straight" style={{ height: baseHeight }}>
            <div className="relative w-full" style={{ height: CARD_HEIGHT }}>
              <div className="absolute -top-5 left-0.5 text-[10px] font-medium text-zinc-400">
                Match {matchCounter++}
              </div>
              <MatchCard
                tournamentId={tournamentId}
                match={trailing.match}
                participantsById={participantsById}
                fixedHeight
                bestOf={trailing.bestOf}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
