// Minimal path router on the History API. The host must serve index.html for every path.
import { useSyncExternalStore } from "react";

const subscribe = (onChange) => {
  addEventListener("popstate", onChange);
  return () => removeEventListener("popstate", onChange);
};

// A path segment that isn't valid percent-encoding ("50%") stays as typed
const decode = (segment) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

// Path segments, decoded: "/characters/UW-A" -> ["characters", "UW-A"]
export const usePath = () => useSyncExternalStore(subscribe, () => location.pathname).split("/").filter(Boolean).map(decode);

function navigate(path) {
  if (path !== location.pathname) {
    history.pushState(null, "", path);
    dispatchEvent(new PopStateEvent("popstate"));
  }
  scrollTo(0, 0);
}

// <a> that navigates in place; modified clicks (new tab...) keep the browser's behavior.
// onClick runs before navigating, not on modified clicks.
export function Link({ to, onClick: before, ...props }) {
  const onClick = (e) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    before?.(e);
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={onClick} {...props} />;
}
