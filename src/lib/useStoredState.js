import { useEffect, useState } from "react";

// useState mirrored to localStorage; storage can be unavailable (private mode) or full.
// The third value is true while the current value could not be stored (it is lost on reload).
// A stored value of another kind than `initial` (edited by hand, an older version) is ignored.
export function useStoredState(key, initial) {
  const [failed, setFailed] = useState(false);
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      const value = saved ? JSON.parse(saved) : initial;
      const kind = (v) => (Array.isArray(v) ? "array" : typeof v);
      return initial === null || (value !== null && kind(value) === kind(initial)) ? value : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      setFailed(false);
    } catch {
      setFailed(true); // keep working in memory; an older value left stored would come back on reload
      try {
        localStorage.removeItem(key);
      } catch {
        // storage unavailable altogether
      }
    }
  }, [key, value]);
  return [value, setValue, failed];
}
