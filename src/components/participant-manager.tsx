"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addParticipant,
  removeParticipant,
  setParticipantSeed,
  shuffleSeeds,
} from "@/app/actions/tournaments";

interface Participant {
  id: string;
  name: string;
  seed: number;
}

export function ParticipantManager({
  tournamentId,
  participants,
}: {
  tournamentId: string;
  participants: Participant[];
}) {
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!name.trim()) return;
    const value = name.trim();
    setName("");
    startTransition(async () => {
      await addParticipant(tournamentId, value);
    });
  }

  const sorted = [...participants].sort((a, b) => a.seed - b.seed);

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Participant name"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <Button onClick={handleAdd} disabled={isPending || !name.trim()}>
          Add
        </Button>
      </div>

      {sorted.length > 1 && (
        <div className="rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <p>
            <strong>Seed</strong> sets bracket position — seed #1 is the top seed and
            plays the lowest seed first. Pick an exact position for each player below, or
            let it randomize everyone at once.
          </p>
          <button
            className="mt-2 font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100"
            onClick={() =>
              startTransition(async () => {
                await shuffleSeeds(tournamentId);
              })
            }
          >
            Randomize all seeds
          </button>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-zinc-500">No participants yet.</p>
      ) : (
        <ul className="grid gap-1">
          {sorted.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <Select
                value={String(p.seed)}
                onValueChange={(v) =>
                  startTransition(async () => {
                    await setParticipantSeed(tournamentId, p.id, Number(v));
                  })
                }
              >
                <SelectTrigger className="h-8 w-16 shrink-0 font-mono" aria-label={`Seed position for ${p.name}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sorted.map((_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      #{i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="flex-1">{p.name}</span>
              <button
                className="text-xs text-zinc-400 hover:text-red-500"
                onClick={() =>
                  startTransition(async () => {
                    await removeParticipant(tournamentId, p.id);
                  })
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
