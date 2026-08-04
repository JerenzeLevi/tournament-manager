export type Format = "single_elim" | "double_elim" | "round_robin" | "swiss";

export type BracketSide = "winners" | "losers" | "grand_finals";

export interface EngineParticipant {
  id: string;
  name: string;
  seed: number;
}

export interface EngineMatch {
  id?: string;
  roundNumber: number;
  roundLabel: string;
  participant1Id: string | null;
  participant2Id: string | null;
  bracketSlot: number;
  bracketSide?: BracketSide;
  winnerId?: string | null;
}

export interface GeneratedRound {
  roundNumber: number;
  label: string;
  matches: EngineMatch[];
}

export interface TournamentSettings {
  swissRounds?: number;
}
