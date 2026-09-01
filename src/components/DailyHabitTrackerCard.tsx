"use client";

import React from 'react';
import { format } from 'date-fns';
import { showSuccess, showError } from '@/utils/toast';
import { Habit } from '@/types/habit';
import { YearlyOutOfControlMissCount } from '@/types/tracking';
import { Switch } from "@/components/ui/switch";
import { DAY_TYPE_LABELS, WEEK_OFF, TEMP_HOLD, hasRealTrackedValue } from '@/utils/dayType';
import { evaluateOperator, isSettledEarly, describeValueStatus } from '@/utils/habitConditions';
import { activeTrackingValues } from '@/utils/habitUtils';

export interface TrackingState {
  trackedValues: string[];
  isOutOfControlMiss: boolean;
}

interface DailyHabitTrackerCardProps {
  habit: Habit;
  /** One entry per date being tracked. A single date renders the classic layout. */
  dates: string[];
  trackingByDate: { [date: string]: TrackingState | undefined };
  onUpdateTracking: (
    habitId: string,
    date: string,
    trackedValues: string[],
    yearlyProgress: number,
    isOutOfControlMiss: boolean,
    oldIsOutOfControlMiss: boolean,
  ) => Promise<void>;
  onToggleTemporaryHold: (habit: Habit, dates: string[], hold: boolean) => Promise<void>;
  currentYearlyProgress: number;
  yearlyOutOfControlMissCounts: { [habitId: string]: YearlyOutOfControlMissCount };
  weeklyTrackingCounts: { [trackingValue: string]: number };
  monthlyTrackingCounts: { [trackingValue: string]: number };
}

const DailyHabitTrackerCard: React.FC<DailyHabitTrackerCardProps> = ({
  habit,
  dates,
  trackingByDate,
  onUpdateTracking,
  onToggleTemporaryHold,
  currentYearlyProgress,
  yearlyOutOfControlMissCounts,
  weeklyTrackingCounts,
  monthlyTrackingCounts,
}) => {
  const [isHoldLoading, setIsHoldLoading] = React.useState(false);

  const habitMissCount = yearlyOutOfControlMissCounts[habit.id];
  const usedMisses = habitMissCount?.used_count || 0;
  const allowedMisses = habit.allowedOutOfControlMisses || 0;
  const remainingMisses = allowedMisses - usedMisses;

  const isMultiDate = dates.length > 1;
  const valuesFor = (date: string) => trackingByDate[date]?.trackedValues || [];
  const isWeekOff = (date: string) => valuesFor(date).includes(WEEK_OFF);
  const isHeld = (date: string) => valuesFor(date).includes(TEMP_HOLD);
  const selectedValueFor = (date: string) => {
    const values = valuesFor(date);
    return hasRealTrackedValue(values) ? values[0] : null;
  };

  const allWeekOff = dates.every(isWeekOff);
  const allHeld = dates.length > 0 && dates.every(isHeld);
  const anyHeld = dates.some(isHeld);

  // Fine/warning message for the habit as a whole, based on the period counts.
  const fineOrWarningMessage = React.useMemo(() => {
    // Tracker-only habits are never judged, so there is nothing to warn about.
    if (habit.isTrackerOnly || allWeekOff || allHeld) return null;

    const warnings: string[] = [];
    const fines: string[] = [];
    const rewards: string[] = [];

    // Live preview only covers the periods this card already has counts for.
    // Daily and yearly conditions are still evaluated for real when you save.
    (habit.frequencyConditions || []).forEach(condition => {
      if (condition.frequency !== 'weekly' && condition.frequency !== 'monthly') return;

      const periodCounts = condition.frequency === 'weekly' ? weeklyTrackingCounts : monthlyTrackingCounts;
      const actualCount = periodCounts[condition.trackingValue] || 0;
      const period = condition.frequency === 'weekly' ? 'week' : 'month';

      if (!evaluateOperator(actualCount, condition.operator, condition.count)) return;
      // A temporary hold exempts the period from fines entirely.
      if (condition.outcome === 'fine' && anyHeld) return;

      const detail =
        `'${condition.trackingValue}' is at ${actualCount} this ${period} ` +
        `(condition: ${condition.operator} ${condition.count})`;

      // "Fewer than / at most / exactly" isn't decided until the period ends,
      // so flag it as a trajectory rather than as something already incurred.
      if (!isSettledEarly(condition.operator)) {
        warnings.push(
          `On track: ${detail}. If the ${period} ends here that's a ` +
          `${condition.outcome} of ₹${(condition.outcome === 'reward' ? habit.rewardAmount : habit.fineAmount) || 0}.`
        );
        return;
      }

      if (condition.outcome === 'reward') {
        rewards.push(`Reward: ${detail}. Worth ₹${habit.rewardAmount || 0} on save.`);
      } else {
        fines.push(`Fine: ${detail}. Worth ₹${habit.fineAmount || 0} on save.`);
      }
    });

    if (allowedMisses > 0) {
      if (usedMisses > allowedMisses) {
        fines.push(`Fine: You have exceeded your ${allowedMisses} allowed out-of-control misses for '${habit.name}' this year.`);
      } else if (usedMisses === allowedMisses) {
        warnings.push(`Alert: You have used all ${allowedMisses} allowed out-of-control misses for '${habit.name}' this year. Future misses will count towards fines.`);
      } else if (usedMisses === allowedMisses - 1) {
        warnings.push(`Heads up: You have 1 out-of-control miss remaining for '${habit.name}' this year.`);
      }
    }

    return fines[0] || rewards[0] || warnings[0] || null;
  }, [habit, weeklyTrackingCounts, monthlyTrackingCounts, allowedMisses, usedMisses, allWeekOff, allHeld, anyHeld]);

  const handleValueClick = async (date: string, value: string) => {
    if (isWeekOff(date)) {
      showError("This day is part of a 'Week Off'. Individual habit tracking is disabled.");
      return;
    }
    if (isHeld(date)) {
      showError(`'${habit.name}' is on temporary hold for ${date}. Release the hold to track it.`);
      return;
    }

    const selectedTrackingValue = selectedValueFor(date);
    const oldIsOutOfControlMiss = trackingByDate[date]?.isOutOfControlMiss || false;
    const contributingValues = habit.yearlyGoal?.contributingValues || [];

    let newSelectedValue: string | null;
    let newYearlyProgress = currentYearlyProgress;

    if (selectedTrackingValue === value) {
      // Untracking the current value
      newSelectedValue = null;
      if (contributingValues.includes(value)) {
        newYearlyProgress = Math.max(0, newYearlyProgress - 1);
      }
    } else {
      newSelectedValue = value;
      if (selectedTrackingValue && contributingValues.includes(selectedTrackingValue)) {
        newYearlyProgress = Math.max(0, newYearlyProgress - 1);
      }
      if (contributingValues.includes(value)) {
        newYearlyProgress += 1;
      }
    }

    await onUpdateTracking(
      habit.id,
      date,
      newSelectedValue ? [newSelectedValue] : [],
      newYearlyProgress,
      // A tracked value clears any out-of-control miss for that day.
      newSelectedValue === null && oldIsOutOfControlMiss,
      oldIsOutOfControlMiss,
    );
    showSuccess(`Habit '${habit.name}' updated for ${date}!`);
  };

  const handleOutOfControlMissToggle = async (date: string, checked: boolean) => {
    if (isWeekOff(date)) {
      showError("This day is part of a 'Week Off'. Individual habit tracking is disabled.");
      return;
    }
    if (selectedValueFor(date) !== null) {
      showError("Cannot mark as 'Out-of-Control Miss' if a value is already tracked.");
      return;
    }
    if (checked && remainingMisses <= 0) {
      showError(`You have used all ${allowedMisses} allowed out-of-control misses for '${habit.name}' this year.`);
      return;
    }

    const oldIsOutOfControlMiss = trackingByDate[date]?.isOutOfControlMiss || false;
    await onUpdateTracking(habit.id, date, [], currentYearlyProgress, checked, oldIsOutOfControlMiss);
    showSuccess(`Habit '${habit.name}' marked as out-of-control miss for ${date}.`);
  };

  const handleHoldToggle = async (checked: boolean) => {
    setIsHoldLoading(true);
    await onToggleTemporaryHold(habit, dates, checked);
    setIsHoldLoading(false);
  };

  const renderDateBlock = (date: string) => {
    const selectedTrackingValue = selectedValueFor(date);
    const isOutOfControlMiss = trackingByDate[date]?.isOutOfControlMiss || false;
    const held = isHeld(date);

    return (
      <div
        key={date}
        className={isMultiDate ? "rounded-lg bg-white/60 p-3 border border-white" : ""}
      >
        {isMultiDate && (
          <p className="text-sm font-semibold text-gray-700 text-left mb-2">
            {format(new Date(date), 'EEE, d MMM')}
          </p>
        )}

        {held ? (
          <p className="text-sm text-gray-600 italic text-left">On temporary hold — not counted.</p>
        ) : (
          <>
            {activeTrackingValues(habit).length > 0 && (
              <>
                {!isMultiDate && <p className="font-medium mb-1 text-left">Track for today:</p>}
                <div className="flex flex-wrap gap-2">
                  {activeTrackingValues(habit).map((value) => {
                    const statuses = habit.isTrackerOnly ? [] : describeValueStatus(
                      habit.frequencyConditions || [],
                      value,
                      weeklyTrackingCounts[value] || 0,
                      monthlyTrackingCounts[value] || 0,
                    );

                    return (
                      <div
                        key={value}
                        className={`cursor-pointer px-4 py-2 rounded-lg border-2 transition-all duration-200
                          ${selectedTrackingValue === value
                            ? `bg-blue-100 border-blue-500 text-blue-800`
                            : `bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200`
                          }`}
                        onClick={() => handleValueClick(date, value)}
                      >
                        <span>{value}</span>
                        {statuses.length > 0 && (
                          <span className="block mt-0.5 text-xs leading-tight">
                            {statuses.map((status, i) => (
                              <span
                                key={i}
                                className={`block ${
                                  status.tone === 'reward' ? 'text-green-700'
                                    : status.tone === 'fine' ? 'text-red-700'
                                      : 'text-gray-500'
                                }`}
                              >
                                {status.text}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Out-of-Control Miss Toggle */}
            {selectedTrackingValue === null && allowedMisses > 0 && !habit.isTrackerOnly && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                <label htmlFor={`out-of-control-miss-${habit.id}-${date}`} className="flex-grow text-sm font-medium text-gray-700 text-left cursor-pointer">
                  Mark as Out-of-Control Miss
                  <p className="text-xs text-gray-500">({remainingMisses} / {allowedMisses} remaining this year)</p>
                </label>
                <Switch
                  id={`out-of-control-miss-${habit.id}-${date}`}
                  checked={isOutOfControlMiss}
                  onCheckedChange={(checked) => handleOutOfControlMissToggle(date, checked)}
                  disabled={!isOutOfControlMiss && remainingMisses <= 0}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 rounded-lg shadow-md flex flex-col space-y-3" style={{ backgroundColor: `${habit.color}33` }}>
      <div className="flex items-center justify-between">
        <span className="text-gray-800 font-bold text-lg text-left">{habit.name}</span>
        <div className="flex items-center gap-2">
          {habit.yearlyGoal && habit.yearlyGoal.count > 0 && (
            <span className="text-sm font-semibold text-gray-600">
              {currentYearlyProgress} / {habit.yearlyGoal.count}
            </span>
          )}
          <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: habit.color }}></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 -mt-1">
        <span className="bg-white/70 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
          {DAY_TYPE_LABELS[habit.dayType]}
        </span>
        {isMultiDate && (
          <span className="bg-white/70 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {dates.length} days
          </span>
        )}
      </div>

      {habit.hintText && (
        <p className="text-sm text-gray-600 italic text-left">{habit.hintText}</p>
      )}

      {allWeekOff ? (
        <div className="dotted-border-container py-6">
          <p className="text-lg font-semibold text-blue-700">Week Off!</p>
          <p className="text-sm text-gray-600">This week is marked off for habit tracking.</p>
        </div>
      ) : (
        <>
          {/* Temporary Hold Toggle — only for habits configured to allow it */}
          {habit.allowTemporaryHold && (
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/60">
              <label htmlFor={`temporary-hold-${habit.id}`} className="flex-grow text-sm font-medium text-gray-700 text-left cursor-pointer">
                Temporary hold
                <p className="text-xs text-gray-500">
                  {isMultiDate ? `Skips this habit for all ${dates.length} days.` : "Skips this habit for this day."}
                </p>
              </label>
              <Switch
                id={`temporary-hold-${habit.id}`}
                checked={allHeld}
                onCheckedChange={handleHoldToggle}
                disabled={isHoldLoading}
              />
            </div>
          )}

          <div className={isMultiDate ? "flex flex-col gap-3" : ""}>
            {dates.map(renderDateBlock)}
          </div>

          {fineOrWarningMessage && (
            <div className={`mt-3 p-2 rounded-md text-sm text-left ${
              fineOrWarningMessage.startsWith('Fine:')
                ? 'bg-red-100 text-red-800 border border-red-300'
                : fineOrWarningMessage.startsWith('Reward:')
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
            }`}>
              {fineOrWarningMessage}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DailyHabitTrackerCard;
