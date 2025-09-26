"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

interface DailyEntry {
  id: string;
  date: string;
  text: string;
  mood: string;
  timestamp: string;
}

const RecordedEntries: React.FC = () => {
  const [dailyEntries, setDailyEntries] = React.useState<DailyEntry[]>([]);

  // Load entries from localStorage on initial mount
  React.useEffect(() => {
    const storedEntries = localStorage.getItem("dailyJournalEntries");
    if (storedEntries) {
      setDailyEntries(JSON.parse(storedEntries));
    }
  }, []);

  return (
    <div className="p-4 text-center">
      <h2 className="text-3xl font-bold text-gray-800 mb-4">Recorded Entries</h2>
      <p className="text-gray-600 mb-6">
        A complete history of all your journal entries.
      </p>

      {dailyEntries.length === 0 ? (
        <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 italic">
          <p>No recorded entries yet. Start by adding a daily entry!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dailyEntries
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Sort by date, newest first
            .map((entry) => (
              <Card key={entry.id} className="shadow-lg hover:shadow-xl transition-shadow duration-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl font-semibold flex items-center justify-between">
                    <span>{format(new Date(entry.date), "PPP")}</span>
                    <span className="text-3xl">{entry.mood}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 text-sm">{entry.text}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Recorded: {format(new Date(entry.timestamp), "p")}
                  </p>
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
};

export default RecordedEntries;