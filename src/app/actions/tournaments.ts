"use server";

import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

// revalidatePath throws if called outside an active request/render scope (e.g. scripts,
// tests). The mutation itself already succeeded, so a cache-revalidation failure shouldn't
// bubble up as an action failure.
function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // no-op outside request scope
  }
}
import { and, eq, asc } from "drizzle-orm";
import { getDb } from "@/db";
import { tournaments, participants, rounds, matches } from "@/db/schema";
import type { Format } from "@/lib/tournament-engine/types";
import {
  generateSingleElimRounds,
  nextSlotForWinner,
  hasThirdPlaceMatch,
  semifinalRoundNumber,
  loserToThirdPlace,
  THIRD_PLACE_ROUND_NUMBER,
} from "@/lib/tournament-engine/single-elim";
import { generateRoundRobinRounds } from "@/lib/tournament-engine/round-robin";
import {
  defaultSwissRounds,
  generateNextSwissRound,
} from "@/lib/tournament-engine/swiss";
import {
  generateDoubleElimRounds,
  winnersAdvance,
  loserDropsTo,
  losersAdvance,
} from "@/lib/tournament-engine/double-elim";

export async function createTournament(name: string, format: Format, bestOf: number = 1) {
  const db = getDb();
  const id = nanoid(10);
  await db.insert(tournaments).values({
    id,
    name,
    format,
    status: "setup",
    settings: { bestOf },
  });
  safeRevalidate("/");
  return id;
}

export async function addParticipant(tournamentId: string, name: string) {
  const db = getDb();
  const existing = await db.query.participants.findMany({
    where: eq(participants.tournamentId, tournamentId),
  });
  await db.insert(participants).values({
    id: nanoid(10),
    tournamentId,
    name,
    seed: existing.length + 1,
  });
  safeRevalidate(`/t/${tournamentId}`);
}

// Lets a name be retyped directly wherever it appears — the setup list, or any bracket
// slot once the tournament has started (renames the participant everywhere at once).
export async function renameParticipant(tournamentId: string, participantId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const db = getDb();
  await db.update(participants).set({ name: trimmed }).where(eq(participants.id, participantId));
  safeRevalidate(`/t/${tournamentId}`);
}

export async function removeParticipant(tournamentId: string, participantId: string) {
  const db = getDb();
  await db.delete(participants).where(eq(participants.id, participantId));
  safeRevalidate(`/t/${tournamentId}`);
}

// Moves a participant to an exact seed position (1-based), shifting everyone else to
// make room. This is the "host manually decides placement" path — picking a position
// directly is far less ambiguous than nudging with up/down arrows.
export async function setParticipantSeed(
  tournamentId: string,
  participantId: string,
  newSeed: number
) {
  const db = getDb();
  const all = await db.query.participants.findMany({
    where: eq(participants.tournamentId, tournamentId),
    orderBy: [asc(participants.seed)],
  });
  const idx = all.findIndex((p) => p.id === participantId);
  if (idx === -1) return;

  const clamped = Math.max(1, Math.min(all.length, newSeed));
  const [moved] = all.splice(idx, 1);
  all.splice(clamped - 1, 0, moved);

  for (let i = 0; i < all.length; i++) {
    if (all[i].seed !== i + 1) {
      await db.update(participants).set({ seed: i + 1 }).where(eq(participants.id, all[i].id));
    }
  }
  safeRevalidate(`/t/${tournamentId}`);
}

// Randomizes seed order — the "auto-generate" option for hosts who don't care about
// manual bracket placement.
export async function shuffleSeeds(tournamentId: string) {
  const db = getDb();
  const all = await db.query.participants.findMany({
    where: eq(participants.tournamentId, tournamentId),
  });
  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (let i = 0; i < shuffled.length; i++) {
    await db.update(participants).set({ seed: i + 1 }).where(eq(participants.id, shuffled[i].id));
  }
  safeRevalidate(`/t/${tournamentId}`);
}

async function insertRound(
  db: ReturnType<typeof getDb>,
  tournamentId: string,
  roundNumber: number,
  label: string,
  bestOf: number | null = null
) {
  const id = nanoid(10);
  await db.insert(rounds).values({ id, tournamentId, roundNumber, label, bestOf });
  return id;
}

// Lets the host escalate format round-by-round (e.g. Bo3 early rounds, Bo5 semis,
// Bo7 grand final) instead of one fixed best-of for the whole tournament.
export async function setRoundBestOf(tournamentId: string, roundId: string, bestOf: number) {
  const db = getDb();
  await db.update(rounds).set({ bestOf }).where(eq(rounds.id, roundId));
  safeRevalidate(`/t/${tournamentId}`);
}

export async function startTournament(tournamentId: string) {
  const db = getDb();
  const t = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
  });
  if (!t) throw new Error("Tournament not found");
  const parts = await db.query.participants.findMany({
    where: eq(participants.tournamentId, tournamentId),
  });
  if (parts.length < 2) throw new Error("Need at least 2 participants");

  const engineParticipants = parts.map((p) => ({
    id: p.id,
    name: p.name,
    seed: p.seed,
  }));
  const defaultBestOf = (t.settings as { bestOf?: number } | null)?.bestOf ?? null;

  if (t.format === "single_elim") {
    const generated = generateSingleElimRounds(engineParticipants);
    for (const round of generated) {
      const roundId = await insertRound(db, tournamentId, round.roundNumber, round.label, defaultBestOf);
      for (const m of round.matches) {
        await db.insert(matches).values({
          id: nanoid(10),
          tournamentId,
          roundId,
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          bracketSlot: m.bracketSlot,
          bracketSide: "winners",
          winnerId: m.winnerId ?? null,
          status: m.winnerId ? "complete" : "pending",
        });
      }
    }
    if (hasThirdPlaceMatch(parts.length)) {
      const roundId = await insertRound(
        db,
        tournamentId,
        THIRD_PLACE_ROUND_NUMBER,
        "Third Place Match",
        defaultBestOf
      );
      await db.insert(matches).values({
        id: nanoid(10),
        tournamentId,
        roundId,
        participant1Id: null,
        participant2Id: null,
        bracketSlot: 0,
        bracketSide: "winners",
        status: "pending",
      });
    }
  } else if (t.format === "double_elim") {
    const { winners, losers, grandFinals } = generateDoubleElimRounds(engineParticipants);
    const encodedGroups: { round: (typeof winners)[number]; offset: number }[] = [
      ...winners.map((round) => ({ round, offset: 0 })),
      ...losers.map((round) => ({ round, offset: 1000 })),
      { round: grandFinals, offset: 2000 },
    ];
    for (const { round, offset } of encodedGroups) {
      const roundId = await insertRound(db, tournamentId, round.roundNumber + offset, round.label, defaultBestOf);
      for (const m of round.matches) {
        await db.insert(matches).values({
          id: nanoid(10),
          tournamentId,
          roundId,
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          bracketSlot: m.bracketSlot,
          bracketSide: m.bracketSide,
          winnerId: m.winnerId ?? null,
          status: m.winnerId ? "complete" : "pending",
        });
      }
    }
  } else if (t.format === "round_robin") {
    const generated = generateRoundRobinRounds(engineParticipants, false);
    for (const round of generated) {
      const roundId = await insertRound(db, tournamentId, round.roundNumber, round.label, defaultBestOf);
      for (const m of round.matches) {
        await db.insert(matches).values({
          id: nanoid(10),
          tournamentId,
          roundId,
          participant1Id: m.participant1Id,
          participant2Id: m.participant2Id,
          bracketSlot: m.bracketSlot,
          winnerId: m.winnerId ?? null,
          status: m.winnerId ? "complete" : "pending",
        });
      }
    }
  } else if (t.format === "swiss") {
    const swissRounds = defaultSwissRounds(parts.length);
    await db
      .update(tournaments)
      .set({ settings: { ...(t.settings as object), swissRounds } })
      .where(eq(tournaments.id, tournamentId));
    const round = generateNextSwissRound(engineParticipants, [], 1);
    const roundId = await insertRound(db, tournamentId, 1, round.label, defaultBestOf);
    for (const m of round.matches) {
      await db.insert(matches).values({
        id: nanoid(10),
        tournamentId,
        roundId,
        participant1Id: m.participant1Id,
        participant2Id: m.participant2Id,
        bracketSlot: m.bracketSlot,
        winnerId: m.winnerId ?? null,
        status: m.winnerId ? "complete" : "pending",
      });
    }
  }

  if (t.format === "single_elim" || t.format === "double_elim") {
    await advanceAllByes(db, tournamentId, t.format);
  }

  await db.update(tournaments).set({ status: "active" }).where(eq(tournaments.id, tournamentId));
  safeRevalidate(`/t/${tournamentId}`);
}

// Bracket generation auto-completes bye matches (single participant, no opponent) but
// doesn't know the DB round/match ids yet, so the winner never gets placed into the next
// slot. Walk completed matches in round order and advance each one now that everything
// is persisted.
async function advanceAllByes(
  db: ReturnType<typeof getDb>,
  tournamentId: string,
  format: "single_elim" | "double_elim"
) {
  const byeMatches = await db.query.matches.findMany({
    where: and(eq(matches.tournamentId, tournamentId), eq(matches.status, "complete")),
  });
  const roundsById = new Map(
    (await db.query.rounds.findMany({ where: eq(rounds.tournamentId, tournamentId) })).map((r) => [r.id, r])
  );
  const sorted = byeMatches
    .filter((m) => m.winnerId)
    .sort((a, b) => (roundsById.get(a.roundId)?.roundNumber ?? 0) - (roundsById.get(b.roundId)?.roundNumber ?? 0));

  for (const m of sorted) {
    if (format === "single_elim") {
      await advanceSingleElim(db, tournamentId, m.bracketSlot, m.roundId, m.winnerId!);
    } else {
      const loserId =
        m.participant1Id && m.participant2Id
          ? m.winnerId === m.participant1Id
            ? m.participant2Id
            : m.participant1Id
          : null;
      await advanceDoubleElim(db, tournamentId, m, m.winnerId!, loserId);
    }
  }
}

export async function recordResult(
  tournamentId: string,
  matchId: string,
  score1: number,
  score2: number
) {
  const db = getDb();
  const match = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
  if (!match) throw new Error("Match not found");
  if (!match.participant1Id || !match.participant2Id) throw new Error("Match not ready");

  const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) });
  if (!t) throw new Error("Tournament not found");
  const round = await db.query.rounds.findFirst({ where: eq(rounds.id, match.roundId) });
  const defaultBestOf = (t.settings as { bestOf?: number } | null)?.bestOf;
  const bestOf = round?.bestOf ?? defaultBestOf;
  if (bestOf) {
    // A best-of-N match ends the instant someone reaches the win threshold, so the
    // winner's score must be EXACTLY that threshold — "at least" would wrongly
    // accept e.g. 3-2 in a Bo3.
    const winThreshold = Math.ceil((bestOf + 1) / 2);
    if (Math.max(score1, score2) !== winThreshold) {
      throw new Error(
        `A winner needs exactly ${winThreshold} wins in a best-of-${bestOf} (e.g. ${winThreshold}-0 up to ${winThreshold}-${winThreshold - 1}).`
      );
    }
  }

  const winnerId = score1 > score2 ? match.participant1Id : score2 > score1 ? match.participant2Id : null;
  const loserId = winnerId === match.participant1Id ? match.participant2Id : match.participant1Id;

  await db
    .update(matches)
    .set({ score1, score2, winnerId, status: "complete" })
    .where(eq(matches.id, matchId));

  if (t.format === "single_elim" && winnerId) {
    const allRounds = await db.query.rounds.findMany({ where: eq(rounds.tournamentId, tournamentId) });
    const finalRoundNumber = Math.max(...allRounds.map((r) => r.roundNumber));
    const isFinal = round && round.roundNumber === finalRoundNumber;
    const thirdPlaceRound = allRounds.find((r) => r.roundNumber === THIRD_PLACE_ROUND_NUMBER);

    if (round && thirdPlaceRound && !isFinal) {
      const parts = await db.query.participants.findMany({ where: eq(participants.tournamentId, tournamentId) });
      if (round.roundNumber === semifinalRoundNumber(parts.length) && loserId) {
        const target = loserToThirdPlace(match.bracketSlot);
        const tpMatch = await db.query.matches.findFirst({ where: eq(matches.roundId, thirdPlaceRound.id) });
        if (tpMatch) {
          await db
            .update(matches)
            .set(target.isParticipant1 ? { participant1Id: loserId } : { participant2Id: loserId })
            .where(eq(matches.id, tpMatch.id));
        }
      }
    }

    if (isFinal) {
      const thirdPlaceDone = !thirdPlaceRound || (await isRoundComplete(db, thirdPlaceRound.id));
      if (thirdPlaceDone) {
        await db.update(tournaments).set({ status: "complete" }).where(eq(tournaments.id, tournamentId));
      }
    } else if (round?.roundNumber === THIRD_PLACE_ROUND_NUMBER) {
      const finalRound = allRounds.find((r) => r.roundNumber === finalRoundNumber);
      const finalDone = finalRound && (await isRoundComplete(db, finalRound.id));
      if (finalDone) {
        await db.update(tournaments).set({ status: "complete" }).where(eq(tournaments.id, tournamentId));
      }
    } else {
      await advanceSingleElim(db, tournamentId, match.bracketSlot, match.roundId, winnerId);
    }
  } else if (t.format === "double_elim" && winnerId) {
    await advanceDoubleElim(db, tournamentId, match, winnerId, loserId);
  } else if (t.format === "swiss") {
    await maybeAdvanceSwiss(db, tournamentId);
  } else if (t.format === "round_robin") {
    const allMatches = await db.query.matches.findMany({ where: eq(matches.tournamentId, tournamentId) });
    if (allMatches.every((m) => m.status === "complete")) {
      await db.update(tournaments).set({ status: "complete" }).where(eq(tournaments.id, tournamentId));
    }
  }

  safeRevalidate(`/t/${tournamentId}`);
}

async function isRoundComplete(db: ReturnType<typeof getDb>, roundId: string) {
  const roundMatches = await db.query.matches.findMany({ where: eq(matches.roundId, roundId) });
  return roundMatches.length > 0 && roundMatches.every((m) => m.status === "complete");
}

async function advanceSingleElim(
  db: ReturnType<typeof getDb>,
  tournamentId: string,
  bracketSlot: number,
  roundId: string,
  winnerId: string
) {
  const round = await db.query.rounds.findFirst({ where: eq(rounds.id, roundId) });
  if (!round) return;
  const target = nextSlotForWinner(round.roundNumber, bracketSlot);
  const nextRound = await db.query.rounds.findFirst({
    where: and(eq(rounds.tournamentId, tournamentId), eq(rounds.roundNumber, target.roundNumber)),
  });
  if (!nextRound) return; // was the final
  const nextMatch = await db.query.matches.findFirst({
    where: and(eq(matches.roundId, nextRound.id), eq(matches.bracketSlot, target.bracketSlot)),
  });
  if (!nextMatch) return;
  await db
    .update(matches)
    .set(target.isParticipant1 ? { participant1Id: winnerId } : { participant2Id: winnerId })
    .where(eq(matches.id, nextMatch.id));
}

async function findRoundByEncodedNumber(
  db: ReturnType<typeof getDb>,
  tournamentId: string,
  side: "winners" | "losers" | "grand_finals",
  roundNumber: number
) {
  const encoded = side === "losers" ? roundNumber + 1000 : side === "grand_finals" ? roundNumber + 2000 : roundNumber;
  return db.query.rounds.findFirst({
    where: and(eq(rounds.tournamentId, tournamentId), eq(rounds.roundNumber, encoded)),
  });
}

async function advanceDoubleElim(
  db: ReturnType<typeof getDb>,
  tournamentId: string,
  match: typeof matches.$inferSelect,
  winnerId: string,
  loserId: string | null
) {
  const round = await db.query.rounds.findFirst({ where: eq(rounds.id, match.roundId) });
  if (!round) return;

  const allParts = await db.query.participants.findMany({ where: eq(participants.tournamentId, tournamentId) });
  const size = nextPowerOfTwoLocal(allParts.length);
  const k = Math.log2(size);
  const realLbRoundCount = 2 * (k - 1);

  async function place(target: { bracketSide: string; roundNumber: number; bracketSlot: number; isParticipant1: boolean }, participantId: string) {
    const destRound = await findRoundByEncodedNumber(db, tournamentId, target.bracketSide as any, target.roundNumber);
    if (!destRound) return;
    const destMatch = await db.query.matches.findFirst({
      where: and(eq(matches.roundId, destRound.id), eq(matches.bracketSlot, target.bracketSlot)),
    });
    if (!destMatch) return;
    await db
      .update(matches)
      .set(target.isParticipant1 ? { participant1Id: participantId } : { participant2Id: participantId })
      .where(eq(matches.id, destMatch.id));
  }

  if (match.bracketSide === "winners") {
    const rawRound = round.roundNumber;
    const winTarget = winnersAdvance(rawRound, match.bracketSlot, realLbRoundCount);
    await place(winTarget, winnerId);
    if (loserId) {
      const loseTarget = loserDropsTo(rawRound, match.bracketSlot);
      await place(loseTarget, loserId);
    }
  } else if (match.bracketSide === "losers") {
    const rawRound = round.roundNumber - 1000;
    const target = losersAdvance(rawRound, match.bracketSlot, realLbRoundCount);
    await place(target, winnerId);
  } else if (match.bracketSide === "grand_finals") {
    await db.update(tournaments).set({ status: "complete" }).where(eq(tournaments.id, tournamentId));
  }
}

function nextPowerOfTwoLocal(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

async function maybeAdvanceSwiss(db: ReturnType<typeof getDb>, tournamentId: string) {
  const t = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) });
  if (!t) return;
  const settings = (t.settings as { swissRounds?: number }) ?? {};
  const totalRounds = settings.swissRounds ?? 1;

  const allRounds = await db.query.rounds.findMany({ where: eq(rounds.tournamentId, tournamentId) });
  const currentRoundNumber = Math.max(...allRounds.map((r) => r.roundNumber));
  const currentRound = allRounds.find((r) => r.roundNumber === currentRoundNumber)!;
  const currentMatches = await db.query.matches.findMany({ where: eq(matches.roundId, currentRound.id) });
  const allComplete = currentMatches.every((m) => m.status === "complete");
  if (!allComplete) return;

  if (currentRoundNumber >= totalRounds) {
    await db.update(tournaments).set({ status: "complete" }).where(eq(tournaments.id, tournamentId));
    return;
  }

  const allParts = await db.query.participants.findMany({ where: eq(participants.tournamentId, tournamentId) });
  const allMatches = await db.query.matches.findMany({ where: eq(matches.tournamentId, tournamentId) });
  const completed = allMatches.filter((m) => m.status === "complete");

  const engineParticipants = allParts.map((p) => ({ id: p.id, name: p.name, seed: p.seed }));
  const nextRoundNumber = currentRoundNumber + 1;
  const round = generateNextSwissRound(
    engineParticipants,
    completed.map((m) => ({
      participant1Id: m.participant1Id,
      participant2Id: m.participant2Id,
      score1: m.score1,
      score2: m.score2,
      winnerId: m.winnerId,
    })),
    nextRoundNumber
  );
  const defaultBestOf = (t.settings as { bestOf?: number } | null)?.bestOf ?? null;
  const roundId = await insertRound(
    db,
    tournamentId,
    nextRoundNumber,
    round.label,
    currentRound.bestOf ?? defaultBestOf
  );
  for (const m of round.matches) {
    await db.insert(matches).values({
      id: nanoid(10),
      tournamentId,
      roundId,
      participant1Id: m.participant1Id,
      participant2Id: m.participant2Id,
      bracketSlot: m.bracketSlot,
      winnerId: m.winnerId ?? null,
      status: m.winnerId ? "complete" : "pending",
    });
  }
}
