"use client";

import React from "react";
import { Switch } from "@/components/ui/switch";

interface TemporaryHoldFieldProps {
  idSuffix: string;
  allowTemporaryHold: boolean;
  onAllowTemporaryHoldChange: (allowed: boolean) => void;
}

const TemporaryHoldField: React.FC<TemporaryHoldFieldProps> = ({
  idSuffix,
  allowTemporaryHold,
  onAllowTemporaryHoldChange,
}) => (
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
);

export default TemporaryHoldField;
