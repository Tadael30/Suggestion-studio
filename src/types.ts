export interface Brand {
  palette: string[];   // company colors, hex
  selected: string[];  // colors chosen for this idea; first = primary, second = secondary
  font: string;
  fontSize: number;    // body size in pt
}
export interface Step { id: string; text: string }
export interface Asset { id: string; name: string; dataUrl: string }

export interface Suggestion {
  title: string;
  problem: string;
  solution: string;
  steps: Step[];
  assets: Asset[];
  brand: Brand;
}

/** What the AI (or the local fallback) returns. A backend must return this exact shape. */
export interface Generated {
  summary: string;
  problemPoints: string[];
  solutionPoints: string[];
  steps: string[];
  benefits: string[];
  nextSteps: string[];
}
