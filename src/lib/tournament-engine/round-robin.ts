import type { EngineParticipant, GeneratedRound } from "./types";

// Circle method round-robin scheduling. Returns one round per array entry.
export function generateRoundRobinRounds(
  participants: EngineParticipant[],
  doubleRound = false
): GeneratedRound[] {
  const ids: (string | null)[] = participants.map((p) => p.id);
  if (ids.length % 2 !== 0) ids.push(null); // bye slot
  const n = ids.length;
  const roundCount = n - 1;
  const rounds: GeneratedRound[] = [];

  let arr = [...ids];
  for (let r = 0; r < roundCount; r++) {
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      matches.push({
        roundNumber: r + 1,
        roundLabel: `Round ${r + 1}`,
        participant1Id: a,
        participant2Id: b,
        bracketSlot: i,
        winnerId: a && !b ? a : b && !a ? b : undefined,
      });
    }
    rounds.push({ roundNumber: r + 1, label: `Round ${r + 1}`, matches });
    // rotate all but the first element
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  if (doubleRound) {
    const secondLeg = rounds.map((rd) => ({
      roundNumber: rd.roundNumber + roundCount,
      label: `Round ${rd.roundNumber + roundCount}`,
      matches: rd.matches.map((m) => ({
        ...m,
        roundNumber: m.roundNumber + roundCount,
        roundLabel: `Round ${m.roundNumber + roundCount}`,
        // reverse home/away for the second leg
        participant1Id: m.participant2Id,
        participant2Id: m.participant1Id,
        winnerId: undefined,
      })),
    }));
    return [...rounds, ...secondLeg];
  }

  return rounds;
}

export interface Standing {
  participantId: string;
  wins: number;
  losses: number;
  draws: number;
  /** Match points: 1 per win, 0.5 per draw (½-½), 0 per loss. */
  matchPoints: number;
  pointsFor: number;
  pointsAgainst: number;
}

// A draw is a completed two-player match with no winner. Byes always have a winner, so
// they never count as draws.
export function isDraw(m: {
  participant1Id: string | null;
  participant2Id: string | null;
  winnerId: string | null;
}): boolean {
  return !!m.participant1Id && !!m.participant2Id && m.winnerId === null;
}

export function computeStandings(
  participants: EngineParticipant[],
  completedMatches: {
    participant1Id: string | null;
    participant2Id: string | null;
    score1: number | null;
    score2: number | null;
    winnerId: string | null;
  }[]
): Standing[] {
  const table = new Map<string, Standing>(
    participants.map((p) => [
      p.id,
      {
        participantId: p.id,
        wins: 0,
        losses: 0,
        draws: 0,
        matchPoints: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      },
    ])
  );

  for (const m of completedMatches) {
    if (!m.participant1Id || !m.participant2Id) continue;
    const s1 = table.get(m.participant1Id);
    const s2 = table.get(m.participant2Id);
    if (!s1 || !s2) continue;
    if (m.score1 != null) s1.pointsFor += m.score1;
    if (m.score2 != null) s2.pointsFor += m.score2;
    if (m.score1 != null) s2.pointsAgainst += m.score1;
    if (m.score2 != null) s1.pointsAgainst += m.score2;

    if (m.winnerId === m.participant1Id) {
      s1.wins++;
      s1.matchPoints += 1;
      s2.losses++;
    } else if (m.winnerId === m.participant2Id) {
      s2.wins++;
      s2.matchPoints += 1;
      s1.losses++;
    } else if (isDraw(m)) {
      s1.draws++;
      s2.draws++;
      s1.matchPoints += 0.5;
      s2.matchPoints += 0.5;
    }
  }

  return [...table.values()].sort(
    (a, b) =>
      b.matchPoints - a.matchPoints ||
      b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst)
  );
}
