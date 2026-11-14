import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useGame } from "@/game/store";
import { Intro, Rechazo, ModeSelect, Cinematic, Fuentes } from "@/components/game/Screens";
import { GameCanvas } from "@/components/game/GameCanvas";
import { HUD, Overlays } from "@/components/game/HUD";
import { TouchControls } from "@/components/game/TouchControls";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VARADOS — Supervivencia lunar 8-bit" },
      { name: "description", content: "Sobrevive en el polo sur de la Luna, fabrica combustible con hielo y regresa a la Tierra." },
      { property: "og:title", content: "VARADOS — Supervivencia lunar 8-bit" },
      { property: "og:description", content: "Juego 2D de supervivencia y crafteo en la Luna: hielo, electrólisis, fugas y despegue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const screen = useGame((s) => s.screen);
  return (
    <main className="h-[100dvh] w-screen select-none overflow-hidden bg-background font-pixel text-foreground">
      {screen === "intro" && <Intro />}
      {screen === "rechazo" && <Rechazo />}
      {screen === "modo" && <ModeSelect />}
      {screen === "cinematica" && <Cinematic />}
      {screen === "fuentes" && <Fuentes />}
      {screen === "juego" && (
        <div className="relative h-full w-full">
          <ClientOnly fallback={null}><GameCanvas /></ClientOnly>
          <HUD />
          <TouchControls />
          <Overlays />
        </div>
      )}
    </main>
  );
}
