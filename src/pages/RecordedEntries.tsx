"use client";

import React from "react";

const RecordedEntries: React.FC = () => {
  return (
    <div id="recorded" className="tab-content">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Recorded Entries</h2>
      <p className="text-gray-600">This section will show a history of all your past journal entries and habit tracking records.</p>
    </div>
  );
};

export default RecordedEntries;