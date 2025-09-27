"use client";

import React from 'react';
import { Button } from "@/components/ui/button"; // Assuming you have a Button component
import { Habit } from "@/types/habit"; // Import the centralized Habit interface

interface HabitCardProps {
  habit: Habit;
  onEdit: (habit: Habit) => void;
  onDelete: (habitId: string, habitName: string) => void;
}

const HabitCard: React.FC<HabitCardProps> = ({ habit, onEdit, onDelete }) => {
  console.log("HabitCard: Rendering with habit:", habit); // Log the habit prop

  return (
    <div className="p-4 rounded-lg shadow-md flex flex-col space-y-2" style={{ backgroundColor: `${habit.color}33` }}>
      <div className="flex items-center justify-between">
        <span className="text-gray-800 font-bold text-lg">{habit.name}</span>
        <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: habit.color }}></div>
      </div>

      {(habit.trackingValues && habit.trackingValues.length > 0) && (
        <div className="flex flex-wrap gap-2 mt-2">
          {habit.trackingValues.map((value, index) => (
            <span key={index} className="bg-gray-200 text-gray-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {value}
            </span>
          ))}
        </div>
      )}

      {(habit.frequencyConditions && habit.frequencyConditions.length > 0) && (
        <div className="mt-2 text-sm text-gray-600">
          <h4 className="font-semibold mb-1">Frequency Conditions:</h4>
          {habit.frequencyConditions.map((condition, index) => (
            <p key={index}>&bull; {condition.trackingValue}: {condition.count} per {condition.frequency}</p>
          ))}
        </div>
      )}

      {habit.fineAmount > 0 && (
        <p className="mt-2 text-sm text-red-600 font-bold">Fine: ₹{habit.fineAmount}</p>
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