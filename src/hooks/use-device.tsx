import { useEffect, useState } from "react";

function useMedia(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatch(mql.matches);
    on();
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, [query]);
  return match;
}

/** Phones and tablets (touch as the main pointer). */
export const useTouchDevice = () => useMedia("(pointer: coarse)");
/** Short screens (phones held sideways): compact layouts. */
export const useShortScreen = () => useMedia("(max-height: 520px)");
/** Taller than wide: stacked layout with controls below the game. */
export const usePortrait = () => useMedia("(orientation: portrait)");
