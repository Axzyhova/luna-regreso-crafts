import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useGame } from "@/game/store";
import { Intro, Rechazo, ModeSelect, Cinematic, Fuentes, Final } from "@/components/game/Screens";
import { GameCanvas } from "@/components/game/GameCanvas";
import { HUD, HUDTop, HUDBottom, Countdown, Overlays } from "@/components/game/HUD";
import { TouchControls } from "@/components/game/TouchControls";
import { NavCard, DialogBox } from "@/components/game/StoryUI";
import { MobileMenu } from "@/components/game/TouchControls";
import { usePortrait, useTouchDevice } from "@/hooks/use-device";
import { GAME_TITLE } from "@/game/title";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${GAME_TITLE} — Supervivencia lunar 8-bit` },
      { name: "description", content: "Sobrevive en el polo sur de la Luna, fabrica combustible con hielo y regresa a la Tierra." },
      { property: "og:title", content: `${GAME_TITLE} — Supervivencia lunar 8-bit` },
      { property: "og:description", content: "Juego 2D de supervivencia y crafteo en la Luna: hielo, electrólisis, fugas y despegue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Game() {
  const portrait = usePortrait();
  const touch = useTouchDevice();
  if (portrait) {
    // Vertical phone/tablet: HUD on top, game in the middle, controls below.
    return (
      <div className="relative flex h-full w-full flex-col">
        <HUDTop touch={touch} />
        <div className="relative min-h-0 flex-1">
          <ClientOnly fallback={null}><GameCanvas /></ClientOnly>
          <Countdown />
          <NavCard className="absolute left-2 top-2" />
          {touch && <MobileMenu className="absolute right-2 top-2" />}
          <DialogBox />
        </div>
        <HUDBottom touch={touch} />
        {touch && <TouchControls />}
        <Overlays />
      </div>
    );
  }
  return (
    <div className="relative h-full w-full">
      <ClientOnly fallback={null}><GameCanvas /></ClientOnly>
      {touch ? (
        <>
          <HUDTop touch className="absolute inset-x-0 top-0" />
          <Countdown />
          <HUDBottom touch className="absolute inset-x-0 bottom-0" />
          <TouchControls floating />
        </>
      ) : <HUD />}
      <NavCard className="absolute left-2 top-28" />
      {touch && <MobileMenu className="absolute right-2 top-28" />}
      <div className="absolute inset-x-0 bottom-28"><DialogBox /></div>
      <Overlays />
    </div>
  );
}

function Index() {
  const screen = useGame((s) => s.screen);
  return (
    <main className="h-dvh w-screen overflow-hidden overscroll-none bg-background font-pixel text-foreground">
      {screen === "intro" && <Intro />}
      {screen === "rechazo" && <Rechazo />}
      {screen === "modo" && <ModeSelect />}
      {screen === "cinematica" && <Cinematic />}
      {screen === "fuentes" && <Fuentes />}
      {screen === "final" && <Final />}
      {screen === "juego" && <Game />}
    </main>
  );
}
