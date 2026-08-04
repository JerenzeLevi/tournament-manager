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

export function StandingsTable({
  standings,
  participantsById,
}: {
  standings: Standing[];
  participantsById: Record<string, { name: string }>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="font-mono">#</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">W</TableHead>
          <TableHead className="text-right">L</TableHead>
          <TableHead className="text-right">D</TableHead>
          <TableHead className="text-right">Diff</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {standings.map((s, i) => (
          <TableRow key={s.participantId}>
            <TableCell className="font-mono text-muted-foreground">{i + 1}</TableCell>
            <TableCell className="flex items-center gap-1.5">
              {i === 0 && s.wins > 0 && <Crown className="size-3.5 text-warning" />}
              {participantsById[s.participantId]?.name ?? "—"}
            </TableCell>
            <TableCell className="text-right font-mono">{s.wins}</TableCell>
            <TableCell className="text-right font-mono">{s.losses}</TableCell>
            <TableCell className="text-right font-mono">{s.draws}</TableCell>
            <TableCell className="text-right font-mono">
              {s.pointsFor - s.pointsAgainst}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
