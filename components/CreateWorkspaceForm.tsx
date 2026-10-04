"use client";

import { useActionState, useState } from "react";
import { createWorkspace, type CreateState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultStartDate } from "@/lib/startDate";
import { useToday } from "@/lib/useToday";

export function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState<CreateState, FormData>(createWorkspace, {});
  // "Today" is the viewer's clock, null until hydration, so SSR and the first render match.
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(null);
  const startDate = picked ?? (today ? defaultStartDate(today) : "");

  return (
    <form action={action} className="mt-5 grid gap-4 sm:grid-cols-[1fr_9.5rem_8rem_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" placeholder="My year" maxLength={80} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="startDate">Starts on</Label>
        <Input
          id="startDate"
          name="startDate"
          type="date"
          min="2000-01-01"
          value={startDate}
          onChange={(e) => setPicked(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pin">PIN (optional)</Label>
        <Input
          id="pin"
          name="pin"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          autoComplete="off"
          placeholder="4 digits"
          title="4 digits"
        />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Creating…" : "Create"}
      </Button>
      {state.error && (
        <p className="text-sm text-destructive sm:col-span-4" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
