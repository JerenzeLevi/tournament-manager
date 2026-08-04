"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setRoundBestOf } from "@/app/actions/tournaments";

export function RoundBestOfEditor({
  tournamentId,
  roundId,
  bestOf,
}: {
  tournamentId: string;
  roundId: string;
  bestOf: number;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={String(bestOf)}
      onValueChange={(v) =>
        startTransition(async () => {
          await setRoundBestOf(tournamentId, roundId, Number(v));
        })
      }
    >
      <SelectTrigger
        className="h-5 w-14 px-1.5 text-[10px] font-semibold"
        disabled={isPending}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1">Bo1</SelectItem>
        <SelectItem value="3">Bo3</SelectItem>
        <SelectItem value="5">Bo5</SelectItem>
        <SelectItem value="7">Bo7</SelectItem>
      </SelectContent>
    </Select>
  );
}
