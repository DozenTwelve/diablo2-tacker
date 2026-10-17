import { useEffect, useState } from "react";

// useState mirrored to localStorage; storage can be unavailable (private mode) or full.
export function useStoredState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // keep working in memory
    }
  }, [key, value]);
  return [value, setValue];
}
