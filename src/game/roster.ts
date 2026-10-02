export type MarblePattern = "solid" | "ring" | "speck" | "band" | "swirl";

export type MarbleDef = {
  id: string;
  name: string;
  color: string;
  highlight: string;
  mass: number;
  bounce: number;
  pattern: MarblePattern;
};

export const ROSTER: MarbleDef[] = [
  { id: "pip", name: "Pip", color: "#ff8a3d", highlight: "#ffe1c4", mass: 1, bounce: 0.28, pattern: "speck" },
  { id: "bubble", name: "Bubble", color: "#3ecbff", highlight: "#ffffff", mass: 0.78, bounce: 0.42, pattern: "ring" },
  { id: "inky", name: "Inky", color: "#3d4bdb", highlight: "#d5dcff", mass: 1.18, bounce: 0.18, pattern: "band" },
  { id: "clover", name: "Clover", color: "#2fce62", highlight: "#d9ffe6", mass: 0.96, bounce: 0.3, pattern: "speck" },
  { id: "rosie", name: "Rosie", color: "#ff5d8f", highlight: "#ffd4e4", mass: 0.88, bounce: 0.36, pattern: "swirl" },
  { id: "sunny", name: "Sunny", color: "#ffcc33", highlight: "#fff4c4", mass: 1.06, bounce: 0.24, pattern: "band" },
  { id: "grape", name: "Grape", color: "#b06bff", highlight: "#f0ddff", mass: 0.84, bounce: 0.4, pattern: "swirl" },
  { id: "cherry", name: "Cherry", color: "#ff4d4d", highlight: "#ffd0d0", mass: 0.98, bounce: 0.32, pattern: "speck" },
];

export function defById(id: string) {
  return ROSTER.find((m) => m.id === id) ?? ROSTER[0]!;
}

export function raceField() {
  return ROSTER.slice();
}
