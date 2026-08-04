"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Image from "next/image";
import { createTournament } from "@/app/actions/tournaments";
import type { Format } from "@/lib/tournament-engine/types";

const FORMAT_PREVIEWS: Record<Format, { image?: string; description: string }> = {
  single_elim: {
    image: "/display/single.jpg",
    description: "One loss and you're out. Winners advance round by round to a final.",
  },
  double_elim: {
    image: "/display/double.jpg",
    description:
      "A loss drops you to the losers bracket instead of eliminating you outright — you're only out after two losses. Losers-bracket winner meets the winners-bracket champion in the Grand Finals.",
  },
  swiss: {
    image: "/display/swiss.jpg",
    description:
      "Everyone plays a fixed number of rounds, paired each round against someone with a similar record (no fixed bracket tree) — like chess Swiss pairings. Standings by wins decide the outcome.",
  },
  round_robin: {
    description:
      "Every participant plays every other participant once. Standings are ranked by wins, then point differential. No bracket tree — just a full schedule.",
  },
};

export function CreateTournamentDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("single_elim");
  const [bestOf, setBestOf] = useState("1");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      const id = await createTournament(name.trim(), format, Number(bestOf));
      setOpen(false);
      setName("");
      router.push(`/t/${id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Tournament</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Tournament</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer Championship"
              />
            </div>
            <div className="grid gap-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_elim">Single Elimination</SelectItem>
                  <SelectItem value="double_elim">Double Elimination</SelectItem>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="swiss">Swiss</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Best of (starting point)</Label>
              <Select value={bestOf} onValueChange={setBestOf}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Best of 1</SelectItem>
                  <SelectItem value="3">Best of 3</SelectItem>
                  <SelectItem value="5">Best of 5</SelectItem>
                  <SelectItem value="7">Best of 7</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">
                Applies to every round by default — you can escalate individual rounds
                (e.g. Bo5 semis, Bo7 final) once the bracket is generated.
              </p>
            </div>
          </div>

          <div className="rounded-md border bg-zinc-50 p-2 dark:bg-zinc-900">
            <p className="mb-2 text-xs font-medium text-zinc-500">Layout preview</p>
            {FORMAT_PREVIEWS[format].image && (
              <div className="relative mb-2 h-40 w-full overflow-hidden rounded">
                <Image
                  src={FORMAT_PREVIEWS[format].image!}
                  alt={`${format} layout example`}
                  fill
                  className="object-cover object-top"
                />
              </div>
            )}
            <p className="text-xs text-zinc-500">{FORMAT_PREVIEWS[format].description}</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
            {isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
