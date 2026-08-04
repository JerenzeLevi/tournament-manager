import type { EngineParticipant, GeneratedRound } from "./types";
import { computeStandings } from "./round-robin";

interface CompletedMatch {
  participant1Id: string | null;
  participant2Id: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
}

export function defaultSwissRounds(participantCount: number): number {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, participantCount))));
}

// Generates the pairing for the next Swiss round, avoiding rematches when possible,
// pairing by current standings (score groups), and giving a bye to the lowest-ranked
// unpaired participant if the pool is odd.
export function generateNextSwissRound(
  participants: EngineParticipant[],
  completedMatches: CompletedMatch[],
  roundNumber: number
): GeneratedRound {
  const standings = computeStandings(participants, completedMatches);
  const played = new Set(
    completedMatches
      .filter((m) => m.participant1Id && m.participant2Id)
      .map((m) => [m.participant1Id, m.participant2Id].sort().join("|"))
  );

  const remaining = [...standings.map((s) => s.participantId)];
  const matches = [];
  let slot = 0;

  while (remaining.length > 0) {
    const a = remaining.shift()!;
    if (remaining.length === 0) {
      // odd one out gets a bye
      matches.push({
        roundNumber,
        roundLabel: `Swiss Round ${roundNumber}`,
        participant1Id: a,
        participant2Id: null,
        bracketSlot: slot++,
        winnerId: a,
      });
      break;
    }
    let opponentIdx = remaining.findIndex(
      (b) => !played.has([a, b].sort().join("|"))
    );
    if (opponentIdx === -1) opponentIdx = 0; // rematch unavoidable
    const b = remaining.splice(opponentIdx, 1)[0];
    matches.push({
      roundNumber,
      roundLabel: `Swiss Round ${roundNumber}`,
      participant1Id: a,
      participant2Id: b,
      bracketSlot: slot++,
    });
  }

  return {
    roundNumber,
    label: `Swiss Round ${roundNumber}`,
    matches,
  };
}

export { computeStandings } from "./round-robin";
