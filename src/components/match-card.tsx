"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { recordResult, renameParticipant } from "@/app/actions/tournaments";

interface Match {
  id: string;
  participant1Id: string | null;
  participant2Id: string | null;
  score1: number | null;
  score2: number | null;
  winnerId: string | null;
  status: string;
}

function EditableName({
  tournamentId,
  participantId,
  name,
  bold,
}: {
  tournamentId: string;
  participantId: string;
  name: string;
  bold: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [, startTransition] = useTransition();

  function save() {
    setEditing(false);
    const trimmed = value.trim();
    if (!trimmed || trimmed === name) {
      setValue(name);
      return;
    }
    startTransition(async () => {
      await renameParticipant(tournamentId, participantId, trimmed);
    });
  }

  if (editing) {
    return (
      <Input
        autoFocus
        className="h-6 px-1 text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(name);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`truncate text-left hover:underline ${bold ? "font-semibold" : ""}`}
      title="Click to rename"
    >
      {name}
    </button>
  );
}

export function MatchCard({
  tournamentId,
  match,
  participantsById,
  fixedHeight,
  bestOf,
}: {
  tournamentId: string;
  match: Match;
  participantsById: Record<string, { name: string }>;
  /** Reserves the score-button row's height even when not shown, so every card in a
   * connector-line bracket is the same height (required for the line math to line up). */
  fixedHeight?: boolean;
  /** Best-of-N games. Caps entry so a game count can't accidentally exceed the format,
   * and requires the winner to actually reach the majority before it can be reported. */
  bestOf?: number;
}) {
  const [score1, setScore1] = useState(match.score1?.toString() ?? "");
  const [score2, setScore2] = useState(match.score2?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const winThreshold = bestOf ? Math.ceil((bestOf + 1) / 2) : undefined;

  const isByeSlot1 = !match.participant1Id && !!match.winnerId;
  const isByeSlot2 = !match.participant2Id && !!match.winnerId;

  const name1 = match.participant1Id
    ? participantsById[match.participant1Id]?.name ?? "?"
    : isByeSlot1
      ? "bye"
      : "TBD";
  const name2 = match.participant2Id
    ? participantsById[match.participant2Id]?.name ?? "?"
    : isByeSlot2
      ? "bye"
      : "TBD";

  const editable =
    match.status === "pending" && !!match.participant1Id && !!match.participant2Id;

  const s1Num = Number(score1);
  const s2Num = Number(score2);
  const scoresValid =
    score1 !== "" &&
    score2 !== "" &&
    !Number.isNaN(s1Num) &&
    !Number.isNaN(s2Num) &&
    s1Num !== s2Num;
  // A best-of-N match ends the moment someone reaches the win threshold — the
  // winner's score must be EXACTLY the threshold (not just "at least"), otherwise
  // e.g. Bo3 would wrongly accept 3-2 instead of only 2-0/2-1.
  const winnerExact = !winThreshold || Math.max(s1Num, s2Num) === winThreshold;
  const canSubmit = scoresValid && winnerExact;

  function submit() {
    if (!canSubmit) return;
    startTransition(async () => {
      await recordResult(tournamentId, match.id, s1Num, s2Num);
    });
  }

  function clampInput(raw: string): string {
    if (raw === "") return raw;
    const n = Number(raw);
    if (Number.isNaN(n) || n < 0) return "0";
    return winThreshold ? String(Math.min(n, winThreshold)) : String(n);
  }

  return (
    <div
      className={`rounded-md border bg-card px-3 py-2 text-sm ${fixedHeight ? "flex h-full flex-col justify-center" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {match.participant1Id ? (
            <EditableName
              tournamentId={tournamentId}
              participantId={match.participant1Id}
              name={name1}
              bold={match.winnerId === match.participant1Id}
            />
          ) : (
            <span className="text-zinc-400">{name1}</span>
          )}
        </div>
        {editable ? (
          <Input
            className="h-7 w-12 shrink-0 text-center font-mono"
            value={score1}
            onChange={(e) => setScore1(clampInput(e.target.value))}
          />
        ) : (
          <span className="shrink-0 font-mono text-muted-foreground">{match.score1 ?? ""}</span>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {match.participant2Id ? (
            <EditableName
              tournamentId={tournamentId}
              participantId={match.participant2Id}
              name={name2}
              bold={match.winnerId === match.participant2Id}
            />
          ) : (
            <span className="text-zinc-400">{name2}</span>
          )}
        </div>
        {editable ? (
          <Input
            className="h-7 w-12 shrink-0 text-center font-mono"
            value={score2}
            onChange={(e) => setScore2(clampInput(e.target.value))}
          />
        ) : (
          <span className="shrink-0 font-mono text-muted-foreground">{match.score2 ?? ""}</span>
        )}
      </div>
      {editable && winThreshold && !winnerExact && (score1 !== "" || score2 !== "") ? (
        <p className="mt-1 text-[10px] text-zinc-400">
          Winner must reach exactly {winThreshold} (e.g. {winThreshold}-0 up to{" "}
          {winThreshold}-{winThreshold - 1})
        </p>
      ) : null}
      {editable ? (
        <Button
          size="sm"
          className="mt-2 w-full"
          disabled={isPending || !canSubmit}
          onClick={submit}
        >
          {isPending ? "Saving…" : "Report Score"}
        </Button>
      ) : fixedHeight ? (
        <div className="mt-2 h-8" />
      ) : null}
    </div>
  );
}
