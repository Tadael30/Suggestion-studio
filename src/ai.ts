import type { Generated, Suggestion } from "./types";

const sentences = (t: string): string[] =>
  t.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

/** Offline fallback: structures the input without an AI model. */
function localDraft(s: Suggestion): Generated {
  const problem = sentences(s.problem);
  const solution = sentences(s.solution);
  return {
    summary: [problem[0], solution[0]].filter(Boolean).join(" "),
    problemPoints: problem.slice(0, 5),
    solutionPoints: solution.slice(0, 5),
    steps: s.steps.map((x) => x.text.trim()).filter(Boolean),
    benefits: ["[Add the expected benefit and how you will measure it]"],
    nextSteps: ["Share this with your manager", "Agree an owner and a date", "Review the result after the first month"],
  };
}

/** Calls your backend when VITE_AI_ENDPOINT is set, otherwise uses the local draft. */
export async function generate(s: Suggestion): Promise<Generated> {
  const url = import.meta.env.VITE_AI_ENDPOINT as string | undefined;
  if (!url) return localDraft(s);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: s.title,
      problem: s.problem,
      solution: s.solution,
      steps: s.steps.map((x) => x.text),
    }),
  });
  if (!res.ok) throw new Error(`The AI service returned ${res.status}. Check VITE_AI_ENDPOINT.`);
  return (await res.json()) as Generated;
}
