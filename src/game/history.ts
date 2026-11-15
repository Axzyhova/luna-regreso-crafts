import data from "@/data/historia.json";

/**
 * Educational layer: real NASA expeditions (successes, failures and failures that were overcome),
 * what each one taught, and how it connects to what the player is doing. The Selene-7 mission
 * and its crew are fiction.
 */
export type Tipo = "exito" | "fallo" | "mixto";
export interface Expedicion {
  id: string; nombre: string; fecha: string; tipo: Tipo; tripulacion: string[]; agencia: string;
  resumen: string; leccion: string; juego: string; dato: string;
}
export interface Tripulante { id: string; nombre: string; rol: string; agencia: string; nota: string }

export const EXPEDICIONES = data.expediciones as Expedicion[];
export const MISION = data.mision;
export const TRIPULACION = data.mision.tripulacion as Tripulante[];
export const DATOS = data.datos as string[];

export const TIPO_LABEL: Record<Tipo, string> = { exito: "SUCCESS", fallo: "FAILURE", mixto: "SAVED" };
export const TIPO_ICON: Record<Tipo, string> = { exito: "✔", fallo: "✖", mixto: "◐" };
export const TIPO_LONG: Record<Tipo, string> = { exito: "Success", fallo: "Failure", mixto: "Failure that was overcome" };

export const expedicion = (id: string | undefined): Expedicion | undefined => EXPEDICIONES.find((e) => e.id === id);
export const countByTipo = (t: Tipo) => EXPEDICIONES.filter((e) => e.tipo === t).length;
