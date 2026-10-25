import { useEffect, useState, type ChangeEvent } from "react";
import type { Generated, Suggestion } from "./types";
import { generate } from "./ai";
import { colors, exportDoc, exportSheet, exportSlides, onColor } from "./export";

const FONTS = ["Inter", "Roboto", "Poppins", "Montserrat", "Arial", "Georgia"];
const SIZES = [{ label: "Small", pt: 12 }, { label: "Medium", pt: 16 }, { label: "Large", pt: 20 }];
const KEY = "suggestion-studio:v1";
const uid = () => crypto.randomUUID();

const initial: Suggestion = {
  title: "",
  problem: "",
  solution: "",
  steps: [{ id: uid(), text: "" }],
  assets: [],
  brand: { palette: ["#0F766E", "#14213D", "#F2A541", "#E6F2F1"], selected: ["#0F766E"], font: "Inter", fontSize: 16 },
};

function load(): Suggestion {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...initial, ...JSON.parse(raw) } : initial;
  } catch {
    return initial;
  }
}

export default function App() {
  const [s, setS] = useState<Suggestion>(load);
  const [gen, setGen] = useState<Generated | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full: images are too large to keep */ }
  }, [s]);

  const { primary, secondary } = colors(s);
  const patch = (p: Partial<Suggestion>) => setS((v) => ({ ...v, ...p }));
  const patchBrand = (p: Partial<Suggestion["brand"]>) => setS((v) => ({ ...v, brand: { ...v.brand, ...p } }));

  const toggleColor = (c: string) => {
    const sel = s.brand.selected;
    if (sel.includes(c)) { if (sel.length > 1) patchBrand({ selected: sel.filter((x) => x !== c) }); }
    else patchBrand({ selected: [...sel, c] });
  };

  const addColor = (e: ChangeEvent<HTMLInputElement>) => {
    const c = e.target.value.toUpperCase();
    if (!s.brand.palette.includes(c)) patchBrand({ palette: [...s.brand.palette, c], selected: [...s.brand.selected, c] });
  };

  const setStep = (id: string, text: string) => patch({ steps: s.steps.map((x) => (x.id === id ? { ...x, text } : x)) });
  const addStep = () => patch({ steps: [...s.steps, { id: uid(), text: "" }] });
  const removeStep = (id: string) => s.steps.length > 1 && patch({ steps: s.steps.filter((x) => x.id !== id) });

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((f) => {
      const r = new FileReader();
      r.onload = () => setS((v) => ({ ...v, assets: [...v.assets, { id: uid(), name: f.name, dataUrl: String(r.result) }] }));
      r.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const run = async () => {
    setBusy(true); setError("");
    try { setGen(await generate(s)); }
    catch (e) { setError(e instanceof Error ? e.message : "Generation failed. Try again."); }
    finally { setBusy(false); }
  };
  const ready = s.problem.trim() && s.solution.trim();

  return (
    <>
    <div className="app" style={{ ["--primary" as string]: primary, ["--on-primary" as string]: onColor(primary), ["--font" as string]: `${s.brand.font}, Arial, sans-serif` }}>
      <header className="top">
        <div>
          <h1>Suggestion Studio</h1>
          <p>Turn a workplace issue into a ready-to-share proposal.</p>
        </div>
        <button className="btn primary" onClick={run} disabled={!ready || busy}>{busy ? "Generating…" : "Generate with AI"}</button>
      </header>

      <main className="grid">
        <section className="card">
          <h2>Brand</h2>
          <p className="muted">Choose the company colors for this idea. The first is primary.</p>
          <div className="swatches" role="group" aria-label="Company colors">
            {s.brand.palette.map((c) => (
              <button key={c} className={"sw" + (s.brand.selected.includes(c) ? " on" : "")} style={{ background: c }}
                aria-pressed={s.brand.selected.includes(c)} aria-label={`Color ${c}`} onClick={() => toggleColor(c)} />
            ))}
            <label className="sw add" title="Add a company color">+<input type="color" onChange={addColor} /></label>
          </div>
          <div className="row">
            <label>Font
              <select value={s.brand.font} onChange={(e) => patchBrand({ font: e.target.value })}>
                {FONTS.map((f) => <option key={f}>{f}</option>)}
              </select>
            </label>
            <label>Font size
              <select value={s.brand.fontSize} onChange={(e) => patchBrand({ fontSize: Number(e.target.value) })}>
                {SIZES.map((z) => <option key={z.pt} value={z.pt}>{z.label} ({z.pt} pt)</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="card">
          <h2>Problem and solution</h2>
          <label>Title<input value={s.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Short name for your idea" /></label>
          <label>Problem or issue identified
            <textarea rows={4} value={s.problem} onChange={(e) => patch({ problem: e.target.value })} placeholder="What did you see, where, how often, and who does it affect?" />
          </label>
          <label>Proposed solution
            <textarea rows={4} value={s.solution} onChange={(e) => patch({ solution: e.target.value })} placeholder="What do you suggest, and what will it improve?" />
          </label>
        </section>

        <section className="card">
          <h2>Process</h2>
          <p className="muted">How the solution works, step by step.</p>
          {s.steps.map((st, i) => (
            <div className="step" key={st.id}>
              <span className="num">{i + 1}</span>
              <input aria-label={`Step ${i + 1}`} value={st.text} onChange={(e) => setStep(st.id, e.target.value)} placeholder="Describe this step" />
              <button className="btn ghost" onClick={() => removeStep(st.id)} disabled={s.steps.length === 1} aria-label={`Remove step ${i + 1}`}>Remove</button>
            </div>
          ))}
          <button className="btn ghost" onClick={addStep}>Add step</button>
        </section>

        <section className="card">
          <h2>Assets</h2>
          <p className="muted">Add pictures that show the issue.</p>
          <label className="drop">Upload images<input type="file" accept="image/*" multiple onChange={onFiles} /></label>
          <div className="thumbs">
            {s.assets.map((a) => (
              <figure key={a.id}>
                <img src={a.dataUrl} alt={a.name} />
                <button className="btn ghost" onClick={() => patch({ assets: s.assets.filter((x) => x.id !== a.id) })}>Remove</button>
              </figure>
            ))}
          </div>
        </section>
      </main>

      {error && <p className="error" role="alert">{error}</p>}

      {gen && (
        <section className="card result">
          <div className="top">
            <h2>Your proposal</h2>
            <div className="actions">
              <button className="btn primary" onClick={() => exportSlides(s, gen)}>Download slides</button>
              <button className="btn" onClick={() => exportDoc(s, gen)}>Download doc</button>
              <button className="btn" onClick={() => exportSheet(s, gen)}>Download sheet</button>
            </div>
          </div>
          <div className="slides">
            <article className="slide title" style={{ background: primary, color: onColor(primary) }}>
              <h3>{s.title || "Suggestion"}</h3><p>{gen.summary}</p>
            </article>
            <article className="slide"><h3 style={{ color: secondary }}>The problem</h3><ul>{gen.problemPoints.map((t, i) => <li key={i}>{t}</li>)}</ul></article>
            <article className="slide"><h3 style={{ color: secondary }}>Proposed solution</h3><ul>{gen.solutionPoints.map((t, i) => <li key={i}>{t}</li>)}</ul></article>
            <article className="slide"><h3 style={{ color: secondary }}>How it works</h3><ol>{gen.steps.map((t, i) => <li key={i}>{t}</li>)}</ol></article>
          </div>
        </section>
      )}
    </div>
    </>
  );
}
