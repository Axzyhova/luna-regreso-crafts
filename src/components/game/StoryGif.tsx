import { useEffect, useState } from "react";
import briefing from "@/assets/story/briefing.gif";
import launch from "@/assets/story/launch.gif";
import coast from "@/assets/story/coast.gif";
import orbit from "@/assets/story/orbit.gif";
import fail from "@/assets/story/fail.gif";
import fall from "@/assets/story/fall.gif";
import land from "@/assets/story/land.gif";
import stranded from "@/assets/story/stranded.gif";
import reentry from "@/assets/story/reentry.gif";
import chutes from "@/assets/story/chutes.gif";
import splash from "@/assets/story/splash.gif";
import rescue from "@/assets/story/rescue.gif";
import ship from "@/assets/story/ship.gif";
import { StoryAnimation } from "./StoryAnimation";
import { ENDING_SCENES, type SceneId } from "./scenes";

/**
 * The eight intro scenes as real looping GIF files (320×160, 12.5 fps, about 3.3 MB in total).
 * They are rendered frame by frame from `drawScene` in StoryAnimation.tsx by tools/bake-story-gifs.tsx,
 * so they look the same as the live canvas version. If a scene's drawing code changes, bake its GIF again
 * (see tools/README.md); until then the canvas version below still works as the fallback.
 */
export const STORY_GIFS: Record<SceneId, string> = { briefing, launch, coast, orbit, fail, fall, land, stranded, reentry, chutes, splash, rescue, ship };
/** Scenes that are shown together (the intro, or the way home), so each chapter only preloads its own GIFs. */
const chapterOf = (scene: SceneId) => ((ENDING_SCENES as SceneId[]).includes(scene) ? (ENDING_SCENES as SceneId[]) : (Object.keys(STORY_GIFS) as SceneId[]).filter((k) => !(ENDING_SCENES as SceneId[]).includes(k)));

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Intro scene shown as a GIF. Falls back to the canvas drawing if the file fails to load, and for
 *  players who asked their system for reduced motion (the canvas then shows a single still frame). */
export function StoryScene({ scene }: { scene: SceneId }) {
  const [broken, setBroken] = useState<SceneId | null>(null);
  // Fetch the chapter's scenes up front so moving to the next panel never shows a blank frame.
  useEffect(() => { for (const k of chapterOf(scene)) new Image().src = STORY_GIFS[k]; }, [scene]);
  if (broken === scene || reducedMotion()) return <StoryAnimation scene={scene} />;
  return (
    <img src={STORY_GIFS[scene]} width={320} height={160} alt={`Animated scene: ${scene}`} decoding="async"
      onError={() => setBroken(scene)}
      className="block aspect-[2/1] w-full rounded-[6px] border-4 border-moon-2 [image-rendering:pixelated]" />
  );
}
