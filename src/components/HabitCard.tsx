"use client";

import React from 'react';
import { Button } from "@/components/ui/button"; // Assuming you have a Button component
import { Habit } from "@/types/habit"; // Import the centralized Habit interface
import { DAY_TYPE_LABELS } from "@/utils/dayType";
import { FREQUENCY_LABELS, resolveConditionAmount, resolveConditionRecipients } from "@/utils/habitConditions";

interface HabitCardProps {
  habit: Habit;
  onEdit: (habit: Habit) => void;
  onDelete: (habitId: string, habitName: string) => void;
}

const HabitCard: React.FC<HabitCardProps> = ({ habit, onEdit, onDelete }) => {
  // Moved console.log into a useEffect
  React.useEffect(() => {
    console.log("HabitCard: Rendering with habit (from useEffect):", habit);
  }, [habit]);

  return (
    <div
      id={habit.id}
      className={`p-4 rounded-lg shadow-md flex flex-col space-y-2 ${habit.isDeactivated ? "opacity-60 grayscale" : ""}`}
      style={{ backgroundColor: `${habit.color}33` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-gray-800 font-bold text-lg">{habit.name}</span>
        <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: habit.color }}></div>
      </div>

      <div className="flex flex-wrap gap-2 mt-1">
        {habit.isDeactivated && (
          <span className="bg-amber-200 text-amber-900 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            Deactivated
          </span>
        )}
        <span className="bg-white/70 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
          {DAY_TYPE_LABELS[habit.dayType]}
        </span>
        {habit.allowTemporaryHold && (
          <span className="bg-white/70 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            Hold allowed
          </span>
        )}
        {habit.isTrackerOnly && (
          <span className="bg-sky-200 text-sky-900 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            Tracker only
          </span>
        )}
      </div>

      {(habit.trackingValues && habit.trackingValues.length > 0) && (
        <div className="flex flex-wrap gap-2 mt-2">
          {habit.trackingValues.map((value, index) => {
            const isArchived = (habit.archivedTrackingValues || []).includes(value);
            return (
              <span
                key={index}
                className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                  isArchived ? "bg-gray-100 text-gray-400 line-through" : "bg-gray-200 text-gray-700"
                }`}
                title={isArchived ? "Archived — hidden from new entries" : undefined}
              >
                {value}
              </span>
            );
          })}
        </div>
      )}

      {(habit.frequencyConditions && habit.frequencyConditions.length > 0) && (
        <div className="mt-2 text-sm text-gray-600 text-left">
          <h4 className="font-semibold mb-1">Conditions:</h4>
          {habit.frequencyConditions.map((condition, index) => (
            <p key={index}>
              &bull; If {condition.trackingValue} {condition.operator} {condition.count}{" "}
              ({FREQUENCY_LABELS[condition.frequency].toLowerCase()}) →{" "}
              <span className={condition.outcome === "reward" ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
                {condition.outcome} ₹{resolveConditionAmount(condition, habit.fineAmount, habit.rewardAmount)}
              </span>
              {condition.outcome === "fine" && resolveConditionRecipients(condition, habit.alertEmails || []).length > 0 && (
                <span className="text-gray-500"> · emails</span>
              )}
            </p>
          ))}
        </div>
      )}

      {habit.hintText && habit.hintText.trim() !== '' && (
        <p className="mt-2 text-sm text-gray-500 italic">Hint: {habit.hintText}</p>
      )}

      {(habit.fineAmount > 0 || habit.rewardAmount > 0) && (
        <p className="mt-2 text-xs text-gray-600 text-left">
          Defaults: {habit.fineAmount > 0 && <span className="text-red-600 font-semibold">fine ₹{habit.fineAmount}</span>}
          {habit.fineAmount > 0 && habit.rewardAmount > 0 && " · "}
          {habit.rewardAmount > 0 && <span className="text-green-600 font-semibold">reward ₹{habit.rewardAmount}</span>}
        </p>
      )}

      {habit.alertEmails && habit.alertEmails.length > 0 && (
        <p className="mt-1 text-xs text-gray-600 text-left">
          Default recipients: {habit.alertEmails.join(", ")}
        </p>
      )}

      {habit.allowedOutOfControlMisses > 0 && (
        <p className="mt-2 text-sm text-gray-600">Allowed Out-of-Control Misses (Yearly): {habit.allowedOutOfControlMisses}</p>
      )}

      {habit.oocMissTriggersEmail && (
        <p className="mt-1 text-sm text-red-600 text-left">
          Out-of-control miss: ₹{habit.oocMissFineAmount} + email
        </p>
      )}

      {(habit.yearlyGoal && habit.yearlyGoal.count > 0) && (
        <div className="mt-2 text-sm text-gray-600">
          <h4 className="font-semibold mb-1">Yearly Goal: {habit.yearlyGoal.count}</h4>
          {(habit.yearlyGoal.contributingValues && habit.yearlyGoal.contributingValues.length > 0) && (
            <>
              <p className="mt-1">Contributing Values:</p>
              <ul className="list-disc list-inside">
                {habit.yearlyGoal.contributingValues.map((value, index) => (
                  <li key={index}>{value}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={() => onEdit(habit)}>Edit</Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete(habit.id, habit.name)}>Delete</Button>
      </div>
    </div>
  );
};

export default HabitCard;