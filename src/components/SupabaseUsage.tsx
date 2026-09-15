"use client";

import React from "react";
import { supabase } from "@/lib/supabase";

// The Supabase Free plan caps each project's database at 500 MB.
const FREE_TIER_DATABASE_BYTES = 500 * 1024 * 1024;

const formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** How much of the free-tier database allowance this app has used. */
const SupabaseUsage: React.FC = () => {
  const [usedBytes, setUsedBytes] = React.useState<number | null>(null);

  React.useEffect(() => {
    let mounted = true;
    supabase.rpc("get_database_size_bytes").then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        // Usually means the migration that adds this function hasn't been run.
        console.error("Error reading database size:", error);
        return;
      }
      setUsedBytes(Number(data));
    });
    return () => { mounted = false; };
  }, []);

  if (usedBytes === null) return null;

  const percent = Math.min(100, (usedBytes / FREE_TIER_DATABASE_BYTES) * 100);
  const remaining = Math.max(0, FREE_TIER_DATABASE_BYTES - usedBytes);
  const barColor = percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-500" : "bg-green-500";

  return (
    <div className="w-full max-w-md mx-auto mb-4 text-left">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>Supabase database: {formatMegabytes(usedBytes)} used</span>
        <span>{formatMegabytes(remaining)} left of 500 MB</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

export default SupabaseUsage;
