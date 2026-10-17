// Minimal path router on the History API. The host must serve index.html for every path.
import { useSyncExternalStore } from "react";

const subscribe = (onChange) => {
  addEventListener("popstate", onChange);
  return () => removeEventListener("popstate", onChange);
};

// Path segments, decoded: "/characters/UW-A" -> ["characters", "UW-A"]
export const usePath = () =>
  useSyncExternalStore(subscribe, () => location.pathname)
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

export function navigate(path) {
  history.pushState(null, "", path);
  dispatchEvent(new PopStateEvent("popstate"));
  scrollTo(0, 0);
}

// <a> that navigates in place; modified clicks (new tab...) keep the browser's behavior
export function Link({ to, ...props }) {
  const onClick = (e) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={onClick} {...props} />;
}
