import { useEffect, useState } from "react";
import launch from "@/assets/story/launch.gif";
import fail from "@/assets/story/fail.gif";
import fall from "@/assets/story/fall.gif";
import land from "@/assets/story/land.gif";
import { StoryAnimation, type SceneId } from "./StoryAnimation";

/**
 * The four intro scenes as real looping GIF files (320×160, 12.5 fps, ~2.4 MB in total).
 * They were rendered frame by frame from `drawScene` in StoryAnimation.tsx, so they look the
 * same as the live canvas version. If a scene's drawing code changes, re-bake its GIF; until
 * then the canvas version below still works as the fallback.
 */
export const STORY_GIFS: Record<SceneId, string> = { launch, fail, fall, land };

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Intro scene shown as a GIF. Falls back to the canvas drawing if the file fails to load, and for
 *  players who asked their system for reduced motion (the canvas then shows a single still frame). */
export function StoryScene({ scene }: { scene: SceneId }) {
  const [broken, setBroken] = useState<SceneId | null>(null);
  // Fetch all four up front so moving to the next panel never shows a blank frame.
  useEffect(() => { for (const url of Object.values(STORY_GIFS)) new Image().src = url; }, []);
  if (broken === scene || reducedMotion()) return <StoryAnimation scene={scene} />;
  return (
    <img src={STORY_GIFS[scene]} width={320} height={160} alt={`Animated scene: ${scene}`} decoding="async"
      onError={() => setBroken(scene)}
      className="block aspect-[2/1] w-full rounded-[6px] border-4 border-moon-2 [image-rendering:pixelated]" />
  );
}
