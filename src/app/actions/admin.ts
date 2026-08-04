"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { tournaments } from "@/db/schema";

// Not a real auth system — a hardcoded gate behind an intentionally obscure UI trigger.
// Checked server-side only so the password never ships in the client bundle.
const ADMIN_USERNAME = "unhingesociety";
const ADMIN_PASSWORD = "jerenzelevi";
const WIPE_CONFIRM_PHRASE = "jerenzelevitheapex";

export async function checkAdminCredentials(username: string, password: string) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export async function deleteAllTournaments(confirmPhrase: string) {
  if (confirmPhrase !== WIPE_CONFIRM_PHRASE) {
    throw new Error("Confirmation phrase did not match.");
  }
  const db = getDb();
  await db.delete(tournaments);
  try {
    revalidatePath("/");
  } catch {
    // no-op outside request scope
  }
}
