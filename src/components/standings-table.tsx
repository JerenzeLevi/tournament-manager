import { Crown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Standing } from "@/lib/tournament-engine/round-robin";

function computeRanks(standings: Standing[]): number[] {
  const ranks: number[] = [];
  for (let i = 0; i < standings.length; i++) {
    if (i === 0) {
      ranks.push(1);
      continue;
    }
    const prev = standings[i - 1];
    const curr = standings[i];
    const prevDiff = prev.pointsFor - prev.pointsAgainst;
    const currDiff = curr.pointsFor - curr.pointsAgainst;
    const tied = prev.wins === curr.wins && prevDiff === currDiff;
    ranks.push(tied ? ranks[i - 1] : i + 1);
  }
  return ranks;
}

export function StandingsTable({
  standings,
  participantsById,
}: {
  standings: Standing[];
  participantsById: Record<string, { name: string }>;
}) {
  const ranks = computeRanks(standings);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-mono">#</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">MP</TableHead>
          <TableHead className="text-right">W-L</TableHead>
          <TableHead className="text-right">Diff</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((s, i) => (
          <TableRow key={s.participantId}>
            <TableCell className="font-mono text-muted-foreground">{ranks[i]}</TableCell>
            <TableCell className="flex items-center gap-1.5">
              {ranks[i] === 1 && s.wins > 0 && <Crown className="size-3.5 text-warning" />}
              {participantsById[s.participantId]?.name ?? "—"}
            </TableCell>
            <TableCell className="text-right font-mono">{s.wins}</TableCell>
            <TableCell className="text-right font-mono">
              {s.wins}-{s.losses}
              {s.draws > 0 ? `-${s.draws}` : ""}
            </TableCell>
            <TableCell className="text-right font-mono">
              {s.pointsFor - s.pointsAgainst}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
