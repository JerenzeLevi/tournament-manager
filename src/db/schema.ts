import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const formatEnum = pgEnum("format", [
  "single_elim",
  "double_elim",
  "round_robin",
  "swiss",
]);

export const statusEnum = pgEnum("status", ["setup", "active", "complete"]);

export const matchStatusEnum = pgEnum("match_status", [
  "pending",
  "complete",
]);

export const bracketSideEnum = pgEnum("bracket_side", [
  "winners",
  "losers",
  "grand_finals",
]);

export const tournaments = pgTable("tournaments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  format: formatEnum("format").notNull(),
  status: statusEnum("status").notNull().default("setup"),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const participants = pgTable("participants", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  seed: integer("seed").notNull(),
});

export const rounds = pgTable("rounds", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  label: text("label").notNull(),
  // Overrides the tournament's default best-of for this round only — e.g. Bo3 early
  // rounds escalating to Bo5 semis and a Bo7 grand final. Null falls back to the
  // tournament-wide default.
  bestOf: integer("best_of"),
});

export const matches = pgTable("matches", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  roundId: text("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  participant1Id: text("participant1_id").references(() => participants.id),
  participant2Id: text("participant2_id").references(() => participants.id),
  score1: integer("score1"),
  score2: integer("score2"),
  winnerId: text("winner_id").references(() => participants.id),
  status: matchStatusEnum("status").notNull().default("pending"),
  bracketSlot: integer("bracket_slot").notNull().default(0),
  bracketSide: bracketSideEnum("bracket_side"),
});

export const tournamentsRelations = relations(tournaments, ({ many }) => ({
  participants: many(participants),
  rounds: many(rounds),
  matches: many(matches),
}));

export const participantsRelations = relations(participants, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [participants.tournamentId],
    references: [tournaments.id],
  }),
}));

export const roundsRelations = relations(rounds, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [rounds.tournamentId],
    references: [tournaments.id],
  }),
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
  round: one(rounds, {
    fields: [matches.roundId],
    references: [rounds.id],
  }),
  participant1: one(participants, {
    fields: [matches.participant1Id],
    references: [participants.id],
    relationName: "participant1",
  }),
  participant2: one(participants, {
    fields: [matches.participant2Id],
    references: [participants.id],
    relationName: "participant2",
  }),
  winner: one(participants, {
    fields: [matches.winnerId],
    references: [participants.id],
    relationName: "winner",
  }),
}));
