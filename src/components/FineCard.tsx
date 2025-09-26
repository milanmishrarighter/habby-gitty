"use client";

import React from 'react';
import { format, isSameWeek, isSameMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess } from "@/utils/toast";
import { formatDateRange, getDatesInPeriod } from "@/lib/date-utils";
import { FineDetail, FinesPeriodData } from "@/types/fines";
import { Habit } from "@/types/habit";
import { supabase } from "@/lib/supabase"; // Import Supabase client

interface DailyTrackingRecord {
  [date: string]: {
    [habitId: string]: string[];
  };
}

interface FineCardProps {
  periodStart: Date;
  periodEnd: Date;
  periodKey: string;
  periodLabel: string;
  periodType: 'weekly' | 'monthly';
  habits: Habit[];
  dailyTracking: DailyTrackingRecord;
  finesStatus: FinesPeriodData;
  onUpdateFineStatus: (periodKey: string, updatedFine: FineDetail) => Promise<void>; // Now returns a Promise
  isCurrentPeriod: boolean;
}

const FineCard: React.FC<FineCardProps> = ({
  periodStart,
  periodEnd,
  periodKey,
  periodLabel,
  periodType,
  habits,
  dailyTracking,
  finesStatus,
  onUpdateFineStatus,
  isCurrentPeriod,
}) => {
  const [finesForPeriod, setFinesForPeriod] = React.useState<FineDetail[]>([]);
  const [warnings, setWarnings] = React.useState<string[]>([]);

  React.useEffect(() => {
    const calculateFinesAndWarnings = () => {
      const currentFines: FineDetail[] = [];
      const currentWarnings: string[] = [];
      const datesInPeriod = getDatesInPeriod(periodStart, periodEnd);

      habits.forEach(habit => {
        // Defensive check for frequencyConditions
        (habit.frequencyConditions || []).forEach(condition => {
          if (condition.frequency === periodType) {
            let actualCount = 0;
            datesInPeriod.forEach(date => {
              const trackedValuesForDay = dailyTracking[date]?.[habit.id] || [];
              if (trackedValuesForDay.includes(condition.trackingValue)) {
                actualCount++;
              }
            });

            // Fine logic: if actual count EXCEEDS the condition count
            if (actualCount > condition.count) {
              const existingFine = finesStatus[periodKey]?.[habit.id]?.find(
                f => f.trackingValue === condition.trackingValue
              );
              currentFines.push({
                id: existingFine?.id || '', // Use existing ID or empty string for new fines
                habitId: habit.id,
                habitName: habit.name,
                fineAmount: habit.fineAmount,
                cause: `Tracking value '${condition.trackingValue}' occurred ${actualCount} times, which exceeds the allowed ${condition.count} times.`,
                status: existingFine ? existingFine.status : 'unpaid',
                trackingValue: condition.trackingValue,
                conditionCount: condition.count,
                actualCount: actualCount,
                created_at: existingFine?.created_at || new Date().toISOString(), // Use existing or new timestamp
              });
            }

            // Warning logic for current period
            if (isCurrentPeriod) {
              if (actualCount === condition.count && condition.count > 0) {
                currentWarnings.push(
                  `Warning: You have already tracked '${condition.trackingValue}' ${actualCount} times for '${habit.name}' this ${periodType.slice(0, -2)}. Any further tracking of this value will incur a fine.`
                );
              } else if (actualCount === condition.count - 1 && condition.count > 0) {
                currentWarnings.push(
                  `Heads up: You have tracked '${condition.trackingValue}' ${actualCount} times for '${habit.name}' this ${periodType.slice(0, -2)}. One more tracking of this value will incur a fine.`
                );
              }
            }
          }
        });
      });
      setFinesForPeriod(currentFines);
      setWarnings(currentWarnings);
    };

    calculateFinesAndWarnings();
  }, [periodStart, periodEnd, periodType, habits, dailyTracking, finesStatus, isCurrentPeriod]);

  const handleStatusChange = async (fine: FineDetail, newStatus: 'paid' | 'unpaid') => { // Made async
    const updatedFine = { ...fine, status: newStatus, created_at: new Date().toISOString() }; // Update timestamp on status change
    await onUpdateFineStatus(periodKey, updatedFine);
  };

  const totalFineAmount = finesForPeriod.reduce((sum, fine) => sum + fine.fineAmount, 0);
  const allPaid = finesForPeriod.length > 0 && finesForPeriod.every(fine => fine.status === 'paid');

  return (
    <Card className={`flex flex-col ${isCurrentPeriod ? 'bg-blue-50 border-blue-300' : (allPaid ? 'bg-green-50 border-green-300' : 'bg-white border-gray-200')}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">
          {periodLabel}
        </CardTitle>
        <p className="text-sm text-gray-500">{formatDateRange(periodStart, periodEnd)}</p>
      </CardHeader>
      <CardContent className="flex-grow">
        {isCurrentPeriod && warnings.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md text-sm text-yellow-800 text-left">
            <p className="font-bold mb-1">Potential Fines Ahead:</p>
            <ul className="list-disc list-inside space-y-1">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {finesForPeriod.length === 0 ? (
          isCurrentPeriod ? (
            <p className="text-gray-600 italic">Fines are being calculated for this {periodType.slice(0, -2)}.</p>
          ) : (
            <p className="text-gray-600 italic">Congratulations! No fines were collected for this {periodType.slice(0, -2)}.</p>
          )
        ) : (
          <div className="space-y-3">
            {finesForPeriod.map((fine, index) => (
              <div key={`${fine.habitId}-${fine.trackingValue}-${index}`} className="border-b pb-2 last:border-b-0 last:pb-0">
                <p className="font-medium text-gray-800">{fine.habitName}</p>
                <p className="text-sm text-red-600">Fine: ₹{fine.fineAmount}</p>
                <p className="text-xs text-gray-700">{fine.cause}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-600">Status:</span>
                  <Select
                    value={fine.status}
                    onValueChange={(value: 'paid' | 'unpaid') => handleStatusChange(fine, value)}
                  >
                    <SelectTrigger className="w-[120px] h-8 text-sm">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            {totalFineAmount > 0 && (
              <p className="font-bold text-lg mt-4 pt-2 border-t border-gray-200">
                Total Fines: ₹{totalFineAmount}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FineCard;