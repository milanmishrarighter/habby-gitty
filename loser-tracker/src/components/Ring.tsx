import React from "react";

interface RingProps {
  size: number;
  stroke: number;
  /** 0..1; anything above 1 draws a full ring. */
  progress: number;
  color: string;
  track?: string;
  children?: React.ReactNode;
  className?: string;
}

/** A circle with a progress ring around its edge that animates as it changes. */
const Ring: React.FC<RingProps> = ({ size, stroke, progress, color, track = "rgba(255,255,255,0.08)", children, className }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <div className={`relative ${className ?? ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.2,0.8,0.2,1), stroke 0.4s" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

export default Ring;
