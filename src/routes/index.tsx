import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useGame } from "@/game/store";
import { Intro, Rechazo, ModeSelect, Cinematic, Regreso, Fuentes, Final } from "@/components/game/Screens";
import { GameCanvas } from "@/components/game/GameCanvas";
import { HUD, Overlays } from "@/components/game/HUD";
import { DialogBox, TutorialCard } from "@/components/game/StoryUI";
import { MobileGame, RotateNotice } from "@/components/game/MobileLayout";
import { ArchiveScreen } from "@/components/game/ArchivePanel";
import { usePortrait, useTouchDevice } from "@/hooks/use-device";
import { GAME_TITLE } from "@/game/title";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${GAME_TITLE} — 8-bit lunar survival` },
      { name: "description", content: "Survive at the Moon's south pole, make fuel from ice and return to Earth." },
      { property: "og:title", content: `${GAME_TITLE} — 8-bit lunar survival` },
      { property: "og:description", content: "2D survival and crafting game on the Moon: ice, electrolysis, leaks and liftoff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Game() {
  const touch = useTouchDevice();
  // Phones and tablets get a landscape layout with on-screen controls.
  if (touch) return <MobileGame />;
  return (
    <div className="relative h-full w-full">
      <ClientOnly fallback={null}><GameCanvas /></ClientOnly>
      <HUD />
      <TutorialCard className="absolute left-1/2 top-28 -translate-x-1/2" />
      <div className="absolute inset-x-0 bottom-28"><DialogBox /></div>
      <Overlays />
    </div>
  );
}

function Index() {
  const screen = useGame((s) => s.screen);
  const touch = useTouchDevice();
  const portrait = usePortrait();
  if (touch && portrait) return <RotateNotice />;
  return (
    <main className="h-dvh w-screen overflow-hidden overscroll-none bg-background font-pixel text-foreground">
      {screen === "intro" && <Intro />}
      {screen === "rechazo" && <Rechazo />}
      {screen === "modo" && <ModeSelect />}
      {screen === "cinematica" && <Cinematic />}
      {screen === "fuentes" && <Fuentes />}
      {screen === "archivo" && <ArchiveScreen />}
      {screen === "regreso" && <Regreso />}
      {screen === "final" && <Final />}
      {screen === "juego" && <Game />}
    </main>
  );
}
