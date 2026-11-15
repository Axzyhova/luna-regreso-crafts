/** Story scene ids and the panels of the way home (shared by the animations, the GIFs and the screens). */

/** The story in order: briefing → launch → coast to the Moon → lunar orbit → tank failure → descent → landing → stranded. */
export type IntroSceneId = "briefing" | "launch" | "coast" | "orbit" | "fail" | "fall" | "land" | "stranded";
/** The way home after liftoff: reentry → parachutes → splashdown off Chiapas → rescue team → recovery ship. */
export type EndingSceneId = "reentry" | "chutes" | "splash" | "rescue" | "ship";
export type SceneId = IntroSceneId | EndingSceneId;
export const INTRO_SCENES: IntroSceneId[] = ["briefing", "launch", "coast", "orbit", "fail", "fall", "land", "stranded"];
export const ENDING_SCENES: EndingSceneId[] = ["reentry", "chutes", "splash", "rescue", "ship"];

/** The way home after liftoff: reentry, parachutes, splashdown off Chiapas and the recovery. Mission and crew are fiction. */
export const ENDING_PANELS: { text: string; art: EndingSceneId }[] = [
  { text: "Liftoff from the south pole! In lunar orbit you dock with Weber and Tanaka, and three days later the capsule hits Earth's atmosphere at about 11 km/s. The heat shield glows at about 2,700 °C and the radio goes silent in the plasma.", art: "reentry" },
  { text: "Houston hears you again! Two drogue chutes, then three main parachutes, slow the capsule from about 480 km/h to under 30 km/h above the Pacific Ocean, off the coast of Chiapas, Mexico.", art: "chutes" },
  { text: "Splashdown! The capsule lands in the Pacific in front of Arriaga and Tonalá, Chiapas (about 15.8° N, 93.9° W). Bags inflate to keep it upright and a recovery beacon starts flashing.", art: "splash" },
  { text: "A specialized recovery ship sends its rescue team. Boats and divers fit a flotation collar, check the air around the hatch and help the crew out of the capsule.", art: "rescue" },
  { text: "The capsule is pulled into the ship's flooded well deck while the sun sets over the coast of Chiapas. Welcome home, Commander.", art: "ship" },
];
