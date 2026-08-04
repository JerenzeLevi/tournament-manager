"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { startTournament } from "@/app/actions/tournaments";
import { generateSingleElimRounds } from "@/lib/tournament-engine/single-elim";
import { generateDoubleElimRounds } from "@/lib/tournament-engine/double-elim";
import type { EngineParticipant, Format } from "@/lib/tournament-engine/types";

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** For elim formats, figures out who (if anyone) gets a free bye into round 2
 * because the participant count isn't a power of 2 — so the host can see and
 * confirm it instead of it happening silently. */
function computeByes(format: Format, participants: EngineParticipant[]): string[] {
  if (format !== "single_elim" && format !== "double_elim") return [];
  const round1 =
    format === "single_elim"
      ? generateSingleElimRounds(participants)[0]
      : generateDoubleElimRounds(participants).winners[0];
  if (!round1) return [];
  const byId = new Map(participants.map((p) => [p.id, p.name]));
  return round1.matches
    .filter((m) => m.winnerId && (!m.participant1Id || !m.participant2Id))
    .map((m) => byId.get(m.winnerId!) ?? "?");
}

export function StartTournamentButton({
  tournamentId,
  format,
  participants,
}: {
  tournamentId: string;
  format: Format;
  participants: EngineParticipant[];
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const bracketSize = nextPowerOfTwo(participants.length);
  const byeNames = useMemo(
    () => computeByes(format, participants),
    [format, participants]
  );

  function doStart() {
    startTransition(async () => {
      await startTournament(tournamentId);
    });
  }

  function handleClick() {
    if (byeNames.length > 0) {
      setConfirmOpen(true);
    } else {
      doStart();
    }
  }

  return (
    <>
      <Button disabled={participants.length < 2 || isPending} onClick={handleClick}>
        {isPending ? "Starting…" : "Start Tournament"}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uneven bracket</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 text-sm">
            <p>
              {participants.length} participants — bracket size is {bracketSize}, so{" "}
              {byeNames.length} {byeNames.length === 1 ? "seed gets" : "seeds get"} a
              bye directly into Round 2 without playing:
            </p>
            <ul className="list-inside list-disc font-medium">
              {byeNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="text-zinc-500">
              This follows standard seeding (top seeds get the bye). To avoid byes
              entirely, adjust the participant count to a power of 2 (e.g. 4, 8, 16).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                doStart();
              }}
            >
              Start anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
