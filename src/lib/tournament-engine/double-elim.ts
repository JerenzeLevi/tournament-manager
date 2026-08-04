import type { EngineParticipant, GeneratedRound } from "./types";

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const next: number[] = [];
    const total = order.length * 2 + 1;
    for (const seed of order) next.push(seed, total - seed);
    order = next;
  }
  return order;
}

/**
 * Simplified double elimination generator for power-of-two participant counts.
 * Winners bracket mirrors single elimination. Losers bracket is generated as an
 * empty skeleton (participants fill in as winners-bracket losers drop down).
 * Grand finals is a single match (no bracket reset) — WB champion vs LB champion.
 */
export function generateDoubleElimRounds(
  participants: EngineParticipant[]
): { winners: GeneratedRound[]; losers: GeneratedRound[]; grandFinals: GeneratedRound } {
  const size = nextPowerOfTwo(participants.length);
  const k = Math.log2(size);
  const order = seedOrder(size);
  const bySeed = new Map(participants.map((p) => [p.seed, p]));

  const winners: GeneratedRound[] = [];

  const round1Matches = [];
  for (let i = 0; i < size / 2; i++) {
    const pA = bySeed.get(order[i * 2]) ?? null;
    const pB = bySeed.get(order[i * 2 + 1]) ?? null;
    round1Matches.push({
      roundNumber: 1,
      roundLabel: "Winners Round 1",
      participant1Id: pA?.id ?? null,
      participant2Id: pB?.id ?? null,
      bracketSlot: i,
      bracketSide: "winners" as const,
      winnerId: pA && !pB ? pA.id : pB && !pA ? pB.id : undefined,
    });
  }
  winners.push({ roundNumber: 1, label: "Winners Round 1", matches: round1Matches });

  for (let r = 2; r <= k; r++) {
    const matchCount = size / Math.pow(2, r);
    const label = matchCount === 1 ? "Winners Final" : `Winners Round ${r}`;
    const matches = Array.from({ length: matchCount }, (_, i) => ({
      roundNumber: r,
      roundLabel: label,
      participant1Id: null,
      participant2Id: null,
      bracketSlot: i,
      bracketSide: "winners" as const,
    }));
    winners.push({ roundNumber: r, label, matches });
  }

  const lbRoundCount = 2 * (k - 1);
  const losers: GeneratedRound[] = [];
  for (let i = 1; i <= lbRoundCount; i++) {
    const matchCount = size / Math.pow(2, Math.ceil(i / 2) + 1);
    const label = i === lbRoundCount ? "Losers Final" : `Losers Round ${i}`;
    const matches = Array.from({ length: matchCount }, (_, slot) => ({
      roundNumber: i,
      roundLabel: label,
      participant1Id: null,
      participant2Id: null,
      bracketSlot: slot,
      bracketSide: "losers" as const,
    }));
    losers.push({ roundNumber: i, label, matches });
  }

  const grandFinals: GeneratedRound = {
    roundNumber: lbRoundCount + 1,
    label: "Grand Finals",
    matches: [
      {
        roundNumber: lbRoundCount + 1,
        roundLabel: "Grand Finals",
        participant1Id: null,
        participant2Id: null,
        bracketSlot: 0,
        bracketSide: "grand_finals" as const,
      },
    ],
  };

  return { winners, losers, grandFinals };
}

export interface AdvanceTarget {
  bracketSide: "winners" | "losers" | "grand_finals";
  roundNumber: number;
  bracketSlot: number;
  isParticipant1: boolean;
}

/** Where does the WINNER of a winners-bracket match go? */
export function winnersAdvance(roundNumber: number, bracketSlot: number, lbRoundCount: number): AdvanceTarget {
  const wbRoundCount = lbRoundCount / 2 + 1;
  if (roundNumber === wbRoundCount) {
    // winner of the winners bracket final goes to grand finals as participant1
    return { bracketSide: "grand_finals", roundNumber: lbRoundCount + 1, bracketSlot: 0, isParticipant1: true };
  }
  return {
    bracketSide: "winners",
    roundNumber: roundNumber + 1,
    bracketSlot: Math.floor(bracketSlot / 2),
    isParticipant1: bracketSlot % 2 === 0,
  };
}

/** Where does the LOSER of a winners-bracket match drop down to in the losers bracket? */
export function loserDropsTo(wbRoundNumber: number, bracketSlot: number): AdvanceTarget {
  if (wbRoundNumber === 1) {
    return {
      bracketSide: "losers",
      roundNumber: 1,
      bracketSlot: Math.floor(bracketSlot / 2),
      isParticipant1: bracketSlot % 2 === 0,
    };
  }
  // WB round r (r>=2) losers feed into LB round 2*(r-1) as participant2, same slot index
  return {
    bracketSide: "losers",
    roundNumber: 2 * (wbRoundNumber - 1),
    bracketSlot,
    isParticipant1: false,
  };
}

/** Where does the WINNER of a losers-bracket match go? */
export function losersAdvance(
  lbRoundNumber: number,
  bracketSlot: number,
  lbRoundCount: number
): AdvanceTarget {
  if (lbRoundNumber === lbRoundCount) {
    return { bracketSide: "grand_finals", roundNumber: lbRoundCount + 1, bracketSlot: 0, isParticipant1: false };
  }
  const destRound = lbRoundNumber + 1;
  if (destRound % 2 === 0) {
    // moving into an even round: keep slot, become participant1 (opponent is a WB dropdown loser)
    return { bracketSide: "losers", roundNumber: destRound, bracketSlot, isParticipant1: true };
  }
  // moving into an odd round (>1): pair down with the adjacent winner
  return {
    bracketSide: "losers",
    roundNumber: destRound,
    bracketSlot: Math.floor(bracketSlot / 2),
    isParticipant1: bracketSlot % 2 === 0,
  };
}
