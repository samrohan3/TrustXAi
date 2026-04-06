import { useState, useEffect, useRef } from "react";

export function useAnimatedCounter(target: number, duration = 1500, delay = 0) {
  const [count, setCount] = useState(0);
  const startTime = useRef<number | null>(null);
  const animFrame = useRef<number>(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const animate = (ts: number) => {
        if (!startTime.current) startTime.current = ts;
        const elapsed = ts - startTime.current;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.floor(eased * target));
        if (progress < 1) animFrame.current = requestAnimationFrame(animate);
      };
      animFrame.current = requestAnimationFrame(animate);
    }, delay);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(animFrame.current);
    };
  }, [target, duration, delay]);

  return count;
}
