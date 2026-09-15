"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Check, Loader2, X, Circle } from "lucide-react";
import { format, parseISO } from "date-fns";

export type SaveStepStatus = "pending" | "running" | "done" | "error";

/** A fine or reward recorded against one of the dates being saved. */
export interface RegisteredAmount {
  type: "fine" | "reward";
  amount: number;
  description: string;
  date: string;
}

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
  /** The fines and rewards registered for the dates in this entry. */
  summary: RegisteredAmount[];
  onDone: () => void;
  /** The dates this entry covers, for the summary heading. */
  dates: string[];
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

const SaveProgressDialog: React.FC<SaveProgressDialogProps> = ({ open, steps, finished, summary, onDone, dates }) => {
  const completed = steps.filter(step => step.status === "done" || step.status === "error").length;
  const percent = steps.length === 0 ? 0 : Math.round((completed / steps.length) * 100);
  const failedSteps = steps.filter(step => step.status === "error");
  // The entry itself failing means nothing was saved, which is a different
  // outcome from a side step failing after the entry was already safe.
  const entryFailed = steps.find(step => step.id === "entry")?.status === "error";

  const distinctDates = [...new Set(summary.map(item => item.date))];
  const showDates = distinctDates.length > 1;
  const net = summary.reduce((total, item) => total + (item.type === "reward" ? item.amount : -item.amount), 0);
  const dateLabel = dates.length > 1
    ? `${format(parseISO(dates[0]), "d MMM")} – ${format(parseISO(dates[dates.length - 1]), "d MMM")}`
    : dates.length === 1 ? format(parseISO(dates[0]), "EEE, d MMM") : "this entry";

  return (
    <Dialog
      open={open}
      // Can't be dismissed by clicking outside or pressing Escape while work is
      // still running; once finished, only the Done button closes it.
      onOpenChange={() => {}}
    >
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto [&>button]:hidden"
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

        {finished && !entryFailed && (
          <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
            <p className="text-sm font-semibold text-gray-800 mb-2">
              Fines and rewards for {dateLabel}
            </p>
            {summary.length === 0 ? (
              <p className="text-sm text-gray-500">None registered.</p>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {summary.map((item, index) => (
                    <li key={index} className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-700">
                        {showDates && <span className="text-gray-500">{format(parseISO(item.date), "d MMM")} · </span>}
                        {item.description}
                      </span>
                      <span className={`shrink-0 font-semibold tabular-nums ${item.type === "reward" ? "text-green-700" : "text-red-700"}`}>
                        {item.type === "reward" ? "+" : "−"}₹{item.amount}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between mt-2 pt-2 border-t border-gray-200 text-sm font-semibold">
                  <span>Net</span>
                  <span className={`tabular-nums ${net >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {net >= 0 ? "+" : "−"}₹{Math.abs(net)}
                  </span>
                </div>
              </>
            )}
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
