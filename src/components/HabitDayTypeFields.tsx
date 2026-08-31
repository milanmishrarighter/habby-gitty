"use client";

import React from "react";
import { Switch } from "@/components/ui/switch";
import { DayType, DAY_TYPES, DAY_TYPE_LABELS, DAY_TYPE_HABIT_LABELS } from "@/utils/dayType";

interface HabitDayTypeFieldsProps {
  idSuffix: string;
  dayType: DayType;
  onDayTypeChange: (dayType: DayType) => void;
  allowTemporaryHold: boolean;
  onAllowTemporaryHoldChange: (allowed: boolean) => void;
}

const HabitDayTypeFields: React.FC<HabitDayTypeFieldsProps> = ({
  idSuffix,
  dayType,
  onDayTypeChange,
  allowTemporaryHold,
  onAllowTemporaryHoldChange,
}) => (
  <>
    <div className="w-full text-left">
      <label className="block text-sm font-medium text-gray-700">Day Type</label>
      <div className="mt-2 flex flex-wrap gap-2">
        {DAY_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onDayTypeChange(type)}
            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors duration-200 ${
              dayType === type
                ? "bg-blue-100 border-blue-500 text-blue-800"
                : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {DAY_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-1">{DAY_TYPE_HABIT_LABELS[dayType]}</p>
    </div>

    <div className="w-full flex items-center justify-between gap-4 text-left">
      <label htmlFor={`allow-temporary-hold-${idSuffix}`} className="flex-grow text-sm font-medium text-gray-700 cursor-pointer">
        Allow Temporary Hold
        <p className="text-xs text-gray-500">
          Lets you pause this habit for a day or a date range from the Daily Entries page.
        </p>
      </label>
      <Switch
        id={`allow-temporary-hold-${idSuffix}`}
        checked={allowTemporaryHold}
        onCheckedChange={onAllowTemporaryHoldChange}
      />
    </div>
  </>
);

export default HabitDayTypeFields;
