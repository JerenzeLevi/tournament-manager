import type { EngineParticipant, GeneratedRound } from "./types";

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Standard bracket seeding order (e.g. for 8: 1,8,4,5,2,7,3,6)
function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const next: number[] = [];
    const total = order.length * 2 + 1;
    for (const seed of order) {
      next.push(seed, total - seed);
    }
    order = next;
  }
  return order;
}

export function generateSingleElimRounds(
  participants: EngineParticipant[]
): GeneratedRound[] {
  const size = nextPowerOfTwo(participants.length);
  const order = seedOrder(size);
  const bySeed = new Map(participants.map((p) => [p.seed, p]));

  const roundCount = Math.log2(size);
  const rounds: GeneratedRound[] = [];

  // Round 1: pair participants (and byes) per seed order
  const round1Matches = [];
  for (let i = 0; i < size / 2; i++) {
    const seedA = order[i * 2];
    const seedB = order[i * 2 + 1];
    const pA = bySeed.get(seedA) ?? null;
    const pB = bySeed.get(seedB) ?? null;
    round1Matches.push({
      roundNumber: 1,
      roundLabel: "Round 1",
      participant1Id: pA?.id ?? null,
      participant2Id: pB?.id ?? null,
      bracketSlot: i,
      bracketSide: "winners" as const,
      // auto-advance if one side is a bye
      winnerId:
        pA && !pB ? pA.id : pB && !pA ? pB.id : undefined,
    });
  }
  rounds.push({ roundNumber: 1, label: "Round 1", matches: round1Matches });

  for (let r = 2; r <= roundCount; r++) {
    const matchCount = size / Math.pow(2, r);
    const label =
      matchCount === 1
        ? "Final"
        : matchCount === 2
          ? "Semifinal"
          : `Round ${r}`;
    const matches = [];
    for (let i = 0; i < matchCount; i++) {
      matches.push({
        roundNumber: r,
        roundLabel: label,
        participant1Id: null,
        participant2Id: null,
        bracketSlot: i,
        bracketSide: "winners" as const,
      });
    }
    rounds.push({ roundNumber: r, label, matches });
  }

  return rounds;
}

// Given a completed match, returns { roundNumber, bracketSlot, slotIndex } for where the winner goes next
export function nextSlotForWinner(
  roundNumber: number,
  bracketSlot: number
): { roundNumber: number; bracketSlot: number; isParticipant1: boolean } {
  return {
    roundNumber: roundNumber + 1,
    bracketSlot: Math.floor(bracketSlot / 2),
    isParticipant1: bracketSlot % 2 === 0,
  };
}

/** A 3rd place match only makes sense once there's an actual semifinal (4+ participants). */
export function hasThirdPlaceMatch(participantCount: number): boolean {
  return nextPowerOfTwo(participantCount) >= 4;
}

/** The round number of the semifinal — the round whose losers play for 3rd place. */
export function semifinalRoundNumber(participantCount: number): number {
  return Math.log2(nextPowerOfTwo(participantCount)) - 1;
}

/** Sentinel round number for the 3rd place match — never collides with a real
 * bracket round (those start at 1), and is deliberately excluded from the main
 * BracketTree rendering since it doesn't fit the doubling structure. */
export const THIRD_PLACE_ROUND_NUMBER = -1;

/** Where does the LOSER of a semifinal match go? Third place match has exactly one
 * slot; the two semifinal losers fill participant1/participant2 by their slot. */
export function loserToThirdPlace(semifinalBracketSlot: number): { isParticipant1: boolean } {
  return { isParticipant1: semifinalBracketSlot === 0 };
}
