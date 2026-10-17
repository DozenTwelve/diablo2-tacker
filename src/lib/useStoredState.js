import { useEffect, useState } from "react";

// useState mirrored to localStorage; storage can be unavailable (private mode) or full.
// The third value is true while the current value could not be stored (it is lost on reload).
export function useStoredState(key, initial) {
  const [failed, setFailed] = useState(false);
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
      setFailed(false);
    } catch {
      setFailed(true); // keep working in memory
    }
  }, [key, value]);
  return [value, setValue, failed];
}
