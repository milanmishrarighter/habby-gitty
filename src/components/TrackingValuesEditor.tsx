"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore } from "lucide-react";

interface TrackingValuesEditorProps {
  idSuffix: string;
  values: string[];
  archivedValues: string[];
  onChange: (values: string[], archivedValues: string[]) => void;
}

const TrackingValuesEditor: React.FC<TrackingValuesEditorProps> = ({
  idSuffix,
  values,
  archivedValues,
  onChange,
}) => {
  const [input, setInput] = React.useState("");

  const activeValues = values.filter(v => !archivedValues.includes(v));

  const addValue = () => {
    const value = input.trim();
    if (value === "") return;
    if (values.includes(value)) {
      // Re-adding an archived value simply brings it back.
      onChange(values, archivedValues.filter(v => v !== value));
      setInput("");
      return;
    }
    onChange([...values, value], archivedValues);
    setInput("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addValue();
    }
  };

  const archiveValue = (value: string) => {
    if (archivedValues.includes(value)) return;
    onChange(values, [...archivedValues, value]);
  };

  const restoreValue = (value: string) => {
    onChange(values, archivedValues.filter(v => v !== value));
  };

  const deleteValue = (value: string) => {
    onChange(values.filter(v => v !== value), archivedValues.filter(v => v !== value));
  };

  return (
    <div className="w-full text-left">
      <label htmlFor={`tracking-values-${idSuffix}`} className="block text-sm font-medium text-gray-700">Tracking Values</label>
      <div className="flex gap-2 mt-1">
        <input
          type="text"
          id={`tracking-values-${idSuffix}`}
          placeholder="e.g., Water, 8 glasses"
          className="p-2 border-2 border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button type="button" onClick={addValue} className="shrink-0" disabled={!input.trim()}>
          Add
        </Button>
      </div>
      <p className="text-xs text-gray-500 mt-1">Press Enter or click 'Add' to save a value.</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {activeValues.map((value) => (
          <span key={value} className="bg-blue-200 text-blue-800 text-sm font-medium pl-2.5 pr-1 py-0.5 rounded-full flex items-center gap-1">
            {value}
            <button
              type="button"
              onClick={() => archiveValue(value)}
              className="p-1 text-blue-800 hover:text-blue-900 focus:outline-none"
              title="Archive this value — keeps it in past entries, hides it from new ones"
              aria-label={`Archive ${value}`}
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => deleteValue(value)}
              className="px-1 text-blue-800 hover:text-red-700 focus:outline-none"
              title="Delete this value entirely"
              aria-label={`Delete ${value}`}
            >
              &times;
            </button>
          </span>
        ))}
      </div>

      {archivedValues.length > 0 && (
        <div className="mt-3 p-2 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-xs font-semibold text-gray-600">Archived</p>
          <p className="text-xs text-gray-500 mb-2">
            Hidden from new entries and from condition dropdowns. Past entries still show them.
          </p>
          <div className="flex flex-wrap gap-2">
            {archivedValues.map((value) => (
              <span key={value} className="bg-gray-200 text-gray-600 text-sm font-medium pl-2.5 pr-1 py-0.5 rounded-full flex items-center gap-1 line-through">
                {value}
                <button
                  type="button"
                  onClick={() => restoreValue(value)}
                  className="p-1 text-gray-600 hover:text-green-700 focus:outline-none no-underline"
                  title="Restore this value"
                  aria-label={`Restore ${value}`}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackingValuesEditor;
