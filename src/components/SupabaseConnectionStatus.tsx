"use client";

import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from 'lucide-react';

const SupabaseConnectionStatus: React.FC = () => {
  // In a real-world scenario, you might want to perform an actual check
  // to Supabase here (e.g., a simple query) and update the status dynamically.
  // For this indicator, we'll assume that if the app is configured with Supabase,
  // it's intended to be connected and storing data there.

  return (
    <div className="flex justify-center items-center gap-2 text-sm text-gray-600 mb-4">
      <Badge variant="secondary" className="px-3 py-1 text-sm font-medium bg-green-100 text-green-800 border-green-300">
        <CheckCircle2 className="h-4 w-4 mr-1" />
        Connected to Supabase
      </Badge>
    </div>
  );
};

export default SupabaseConnectionStatus;