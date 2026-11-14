# Luna Regreso Crafts

Crea un videojuego web 2D de supervivencia y crafteo con estética 8-bit, en español, llamado "VARADOS" (título provisional).

STACK: React + TypeScript + Vite + Tailwind para menús y HUD. El mundo de juego se renderiza con Phaser 3 (phaser@3.80.1) dentro de un componente React. Estado global con Zustand. Datos del juego en archivos JSON en /src/data/. Guardado en localStorage (envuelto en try/catch). Fuente "Press Start 2P" de Google Fonts. Resolución interna 320x180 escalada con pixel-art nítido (image-rendering: pixelated). Paleta limitada de 16 colores (grises lunares, azul del traje, naranja de alertas, verde de OK, morado para aliens). Sonidos chiptune simples con WebAudio. No uses logos ni marcas de NASA; NASA solo se menciona como fuente en la pantalla de Fuentes.

HISTORIA: el jugador viaja al espacio, su cohete sufre un accidente y aterriza de emergencia en el polo sur de la Luna sin combustible. Debe sobrevivir, recolectar hielo y regolito, producir combustible (electrólisis del agua → hidrógeno y oxígeno, luego licuarlos), reparar el cohete, tapar fugas, mantener su base y despegar en una ventana de regreso para volver a la Tierra.

FLUJO DE PANTALLAS:
1) Presentación: texto "Bienvenido a la experiencia… ¿estás preparado para vivir una historia en el espacio?" con botones ACEPTAR y RECHAZAR (rechazar muestra "Hasta la próxima, astronauta" y vuelve al inicio).
2) Elegir experiencia: REALISTA (sin aliens, solo peligros reales), FANTÁSTICO (aliens moderados), TERRORÍFICO (aliens agresivos, noche más oscura, menos recursos). Además, dificultad Fácil/Normal/Difícil.
3) Cinemática del accidente: 4 viñetas pixel con texto.
4) Juego con HUD.
5) Inventario/crafteo (Tab). 6) Panel de base (B). 7) Checklist del cohete. 8) Diseñador de CubeSat relé. 9) Ventana de lanzamiento y cuenta regresiva. 10) Bitácora (L) con entradas automáticas fechadas. 11) Reporte final con estrellas, logros y explicación de por qué se ganó o perdió. 12) Fuentes y créditos (lee /src/data/fuentes.json).

HUD: arriba O2 del traje, salud, temperatura, reloj día/noche; segunda fila energía (entrada/salida), LH2 %, LOX % y medidor de "relación de mezcla" O2:H2 (objetivo ~6:1). Abajo, barra rápida 1-5 y la meta actual del acto. Alertas parpadeantes cuando hay una fuga.

CONTROLES: WASD/flechas mover, E interactuar (mantener para reparar), clic/espacio usar herramienta, 1-5 barra rápida, Tab inventario, B base, L bitácora, Esc pausa.

MECÁNICAS:
- Ciclo día (6 min) / noche (4 min). De día los paneles generan energía; de noche solo baterías, baja la temperatura y aumenta el boil-off del hidrógeno líquido.
- Recursos: energía, hielo, agua, O2, H2, regolito, chatarra, metal, kits de reparación.
- Módulos construibles con durabilidad y consumo de energía: hábitat, paneles, baterías, taladro de hielo, planta de electrólisis (agua+energía → H2 y O2 en proporción de masa 1:8), licuefactor/criotanques, horno de regolito (regolito+energía → O2+metal), antena, taller, torres de luz.
- FUGAS: aparecen al azar y tras ataques en el hábitat (pierde O2) y en los tanques del cohete (pierden combustible). Se tapan acercándose y manteniendo E hasta llenar un anillo de progreso; cuesta 1 kit. Si no se tapan, crecen cada 30 s.
- MANTENIMIENTO: la durabilidad de los módulos baja con el tiempo; al 0% dejan de funcionar.
- COHETE: 6 subsistemas (Propulsión, Energía, Térmico, Comunicaciones, Control de actitud, Estructura) con % de estado. Despegar requiere los 6 en verde, tanques llenos y estar dentro de una ventana de regreso; si falta algo, el botón explica qué.
- CUBESAT RELÉ: minijuego de cuadrícula 3U donde se colocan piezas tipo Tetris (panel, batería, radio, computadora, estructura) con masa, energía y espacio desde /src/data/piezas_cubesat.json. Si es viable (masa bajo el límite y energía neta positiva) se lanza y desbloquea las ventanas de regreso.
- VENTANAS DE REGRESO desde /src/data/ventanas_regreso.json (incluye combustible requerido por ventana; marca los valores como provisionales).
- ALIENS (solo en Fantástico y Terrorífico): Abductor (barra de abducción de noche; se contrarresta con luz o refugiándose), Rastreador (atraído por módulos encendidos), Saboteador (causa fugas), jefe Nodriza que ataca durante la cuenta regresiva final. Combate simple con la herramienta. Las defensas gastan energía.
- 4 ACTOS: 1 Sobrevivir, 2 Evaluar recursos, 3 Plan de regreso (CubeSat relé), 4 Diseño final y despegue. Cada acto tiene una meta visible.
- Dificultad dinámica: si el jugador muere 2 veces en un acto, reducir eventos 20% y mostrar una pista.
- Logros: "Primer litro de LH2", "Cero fugas en una noche", "Mezcla perfecta 6:1", "Contacto con la Tierra", "Regreso a casa".

CRAFTEO (recetas en /src/data/recetas.json): kit de reparación, pala mejorada, taladro, planta de electrólisis, criotanque, aislamiento, batería, panel solar, torre de luz, pieza de motor.

ALCANCE DE ESTA PRIMERA VERSIÓN: pantallas 1-4 funcionando, un mapa pequeño (cráter + base + cohete), movimiento, recolección de hielo, regolito y chatarra, ciclo día/noche, HUD completo, fugas con minijuego de reparación y el modo REALISTA jugable. Deja los aliens, el CubeSat y el final para siguientes iteraciones, pero con la estructura de datos lista.

Inicia la primera versión funcional, empezando por la escena lunar 2D en Phaser 3.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://luna-regreso-crafts.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2b8ff3e7-35d2-4573-907c-823628d7686d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
