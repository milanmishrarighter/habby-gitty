"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2, X, Circle } from "lucide-react";

export type SaveStepStatus = "pending" | "running" | "done" | "error";

export interface SaveStep {
  id: string;
  label: string;
  status: SaveStepStatus;
  /** Shown under the step — a failure reason, or what the step produced. */
  detail?: string;
}

interface SaveProgressDialogProps {
  open: boolean;
  steps: SaveStep[];
  /** Everything has stopped running, successfully or not. */
  finished: boolean;
  /** Notes about what the save did: rewards, fines, emails. */
  summary: string[];
  onDone: () => void;
}

const StepIcon: React.FC<{ status: SaveStepStatus }> = ({ status }) => {
  switch (status) {
    case "done":
      return <Check className="h-4 w-4 text-green-600" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    case "error":
      return <X className="h-4 w-4 text-red-600" />;
    default:
      return <Circle className="h-4 w-4 text-gray-300" />;
  }
};

const SaveProgressDialog: React.FC<SaveProgressDialogProps> = ({ open, steps, finished, summary, onDone }) => {
  const completed = steps.filter(step => step.status === "done" || step.status === "error").length;
  const percent = steps.length === 0 ? 0 : Math.round((completed / steps.length) * 100);
  const failedSteps = steps.filter(step => step.status === "error");
  // The entry itself failing means nothing was saved, which is a different
  // outcome from a side step failing after the entry was already safe.
  const entryFailed = steps.find(step => step.id === "entry")?.status === "error";

  return (
    <Dialog
      open={open}
      // Can't be dismissed by clicking outside or pressing Escape while work is
      // still running; once finished, only the Done button closes it.
      onOpenChange={() => {}}
    >
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {!finished ? "Saving your entry…" : entryFailed ? "Save failed" : failedSteps.length > 0 ? "Saved, with problems" : "Success"}
          </DialogTitle>
          <DialogDescription>
            {!finished
              ? "Please keep this open while everything is recorded."
              : entryFailed
                ? "The entry wasn't saved. Nothing has changed — fix the issue and try again."
                : failedSteps.length > 0
                  ? "Your entry is saved, but some of the follow-up work didn't complete."
                  : "Everything has been recorded."}
          </DialogDescription>
        </DialogHeader>

        <Progress
          value={percent}
          className={finished && (entryFailed || failedSteps.length > 0) ? "[&>div]:bg-amber-500" : ""}
        />

        <ul className="space-y-2 text-sm">
          {steps.map((step) => (
            <li key={step.id} className="flex gap-2">
              <span className="mt-0.5 shrink-0"><StepIcon status={step.status} /></span>
              <span className="flex-grow">
                <span className={step.status === "pending" ? "text-gray-400" : "text-gray-800"}>{step.label}</span>
                {step.detail && (
                  <span className={`block text-xs ${step.status === "error" ? "text-red-600" : "text-gray-500"}`}>
                    {step.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        {finished && summary.length > 0 && (
          <div className="rounded-md bg-gray-50 border border-gray-200 p-3 space-y-1">
            {summary.map((line, index) => (
              <p key={index} className="text-sm text-gray-700">{line}</p>
            ))}
          </div>
        )}

        {finished && (
          <DialogFooter>
            <Button onClick={onDone} className="w-full sm:w-auto">Done</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SaveProgressDialog;
