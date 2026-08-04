"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkAdminCredentials, deleteAllTournaments } from "@/app/actions/admin";

const CLICK_WINDOW_MS = 1500;
const CLICKS_NEEDED = 5;
const WIPE_PHRASE = "jerenzelevitheapex";

type Stage = "closed" | "login" | "panel" | "confirm";

export function AdminEasterEgg() {
  const clickTimes = useRef<number[]>([]);
  const [stage, setStage] = useState<Stage>("closed");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [wipeError, setWipeError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleLogoClick() {
    const now = Date.now();
    clickTimes.current = [...clickTimes.current, now].filter(
      (t) => now - t <= CLICK_WINDOW_MS
    );
    if (clickTimes.current.length >= CLICKS_NEEDED) {
      clickTimes.current = [];
      setStage("login");
    }
  }

  function closeAll() {
    setStage("closed");
    setUsername("");
    setPassword("");
    setLoginError("");
    setConfirmText("");
    setWipeError("");
  }

  function handleLogin() {
    setLoginError("");
    startTransition(async () => {
      const ok = await checkAdminCredentials(username, password);
      if (ok) {
        setStage("panel");
      } else {
        setLoginError("Incorrect username or password.");
      }
    });
  }

  function handleWipe() {
    setWipeError("");
    startTransition(async () => {
      try {
        await deleteAllTournaments(confirmText);
        closeAll();
        router.push("/");
        router.refresh();
      } catch (e) {
        setWipeError(e instanceof Error ? e.message : "Failed to delete.");
      }
    });
  }

  return (
    <>
      <button
        onClick={handleLogoClick}
        className="opacity-40 transition-opacity hover:opacity-70"
        aria-label="Unhinge Society"
      >
        <Image src="/us-logo.png" alt="" width={28} height={28} />
      </button>

      <Dialog open={stage === "login"} onOpenChange={(open) => !open && closeAll()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Access</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="admin-username">Username</Label>
              <Input
                id="admin-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            {loginError && <p className="text-sm text-red-500">{loginError}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleLogin} disabled={isPending || !username || !password}>
              {isPending ? "Checking…" : "Log in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={stage === "panel" || stage === "confirm"}
        onOpenChange={(open) => !open && closeAll()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Panel</DialogTitle>
            <DialogDescription>
              This removes every tournament in the database — finished or not. There is no
              undo.
            </DialogDescription>
          </DialogHeader>

          {stage === "panel" && (
            <DialogFooter>
              <Button variant="destructive" onClick={() => setStage("confirm")}>
                Delete ALL tournaments
              </Button>
            </DialogFooter>
          )}

          {stage === "confirm" && (
            <div className="grid gap-3 py-2">
              <p className="text-sm font-medium">
                Are you sure you will erase all tournaments?
              </p>
              <p className="text-sm text-zinc-500">
                Type <span className="font-mono font-semibold">{WIPE_PHRASE}</span> to
                confirm.
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={WIPE_PHRASE}
              />
              {wipeError && <p className="text-sm text-red-500">{wipeError}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setStage("panel")}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={confirmText !== WIPE_PHRASE || isPending}
                  onClick={handleWipe}
                >
                  {isPending ? "Deleting…" : "Erase everything"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
