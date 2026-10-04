"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPerson, updatePerson } from "@/app/w/[slug]/actions";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Person } from "@/lib/types";

/** `person` undefined = closed, null = adding, Person = editing. */
type Props = {
  slug: string;
  person: Person | null | undefined;
  onClose: () => void;
  onSaved: (person: Person) => void;
};

export function PersonDialog(props: Props) {
  return (
    <Dialog open={props.person !== undefined} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-sm">
        {props.person !== undefined && (
          <PersonForm key={props.person?.id ?? "new"} {...props} person={props.person} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PersonForm({ slug, person, onClose, onSaved }: Props & { person: Person | null }) {
  const [name, setName] = useState(person?.name ?? "");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = person ? await updatePerson(slug, person.id, { name }) : await createPerson(slug, { name });
      if (!res.ok) return void toast.error(res.error);
      onSaved(res.data);
      onClose();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{person ? "Edit person" : "Add a person"}</DialogTitle>
        <DialogDescription>
          Everyone with the edit link can log as anyone here. It shows who did what, it isn’t an account.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="person-name">Name</Label>
        <div className="flex items-center gap-2.5">
          <Avatar person={{ name: name || "?" }} />
          <Input
            id="person-name"
            placeholder="Raul Carrizo"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={pending || !name.trim()}>
          {person ? "Save" : "Add"}
        </Button>
      </DialogFooter>
    </form>
  );
}
