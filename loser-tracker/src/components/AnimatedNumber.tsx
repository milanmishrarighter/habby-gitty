import React from "react";

/** Counts smoothly from the previous value to the new one. */
const AnimatedNumber: React.FC<{ value: number; format?: (n: number) => string; duration?: number }> = ({
  value,
  format = n => Math.round(n).toLocaleString("en-IN"),
  duration = 650,
}) => {
  const [shown, setShown] = React.useState(value);
  const fromRef = React.useRef(value);

  React.useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (value - from) * eased;
      setShown(current);
      fromRef.current = current;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{format(shown)}</>;
};

export default AnimatedNumber;
