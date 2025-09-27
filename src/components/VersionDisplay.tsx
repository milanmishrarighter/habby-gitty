"use client";

import React from 'react';

interface VersionDisplayProps {
  version: string;
}

const VersionDisplay: React.FC<VersionDisplayProps> = ({ version }) => {
  return (
    <div className="absolute top-4 left-4 text-xs text-gray-400 font-mono">
      v{version}
    </div>
  );
};

export default VersionDisplay;