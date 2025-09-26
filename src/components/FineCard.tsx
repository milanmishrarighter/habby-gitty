"use client";

import React from 'react';
import { format, isSameWeek, isSameMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess } from "@/utils/toast";
import { formatDateRange, getDatesInPeriod } from "@/lib/date-utils";
import { FineDetail, FinesPeriodData } from "@/types/fines";

// Interfaces from existing files (copied for self-containment of FineCard)
interface Habit {
  id: string;
  name: string;
  color: string;
  trackingValues: string[];
  frequencyConditions: { trackingValue: string; frequency: string; count: number }[];
  fineAmount: number;
  yearlyGoal: {
    count: number;
    contributingValues: string[];
  };
  createdAt: string;
}

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
  onUpdateFineStatus: (periodKey: string, updatedFine: FineDetail) => void;
  isCurrentPeriod: boolean; // New prop to indicate if it's the current week/month
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

  React.useEffect(() => {
    const calculateFines = () => {
      const fines: FineDetail[] = [];
      const datesInPeriod = getDatesInPeriod(periodStart, periodEnd);

      habits.forEach(habit => {
        habit.frequencyConditions.forEach(condition => {
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
              fines.push({
                habitId: habit.id,
                habitName: habit.name,
                fineAmount: habit.fineAmount,
                cause: `Tracking value '${condition.trackingValue}' occurred ${actualCount} times, which exceeds the allowed ${condition.count} times.`,
                status: existingFine ? existingFine.status : 'unpaid',
                trackingValue: condition.trackingValue,
                conditionCount: condition.count,
                actualCount: actualCount,
              });
            }
          }
        });
      });
      setFinesForPeriod(fines);
    };

    calculateFines();
  }, [periodStart, periodEnd, periodType, habits, dailyTracking, finesStatus]);

  const handleStatusChange = (fine: FineDetail, newStatus: 'paid' | 'unpaid') => {
    const updatedFine = { ...fine, status: newStatus };
    onUpdateFineStatus(periodKey, updatedFine);
    showSuccess(`Fine for '${fine.habitName}' (${fine.trackingValue}) marked as ${newStatus}.`);
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
        {finesForPeriod.length === 0 ? (
          <p className="text-gray-600 italic">Congratulations! No fines were collected for this {periodType.slice(0, -2)}.</p>
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