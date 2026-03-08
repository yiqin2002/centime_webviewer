// viewer.js
const SLICE_COUNT = 480; // fixed per direction
const PAD = 3;           // slice_000.png => 3 digits
const EXT = "png";       // slice_000.png

/**
 * patients.json format (example):
 * {
 *   "patients": [
 *     {
 *       "id": "P00123",
 *       "folder": "Case_12A__P00123",
 *       "censored": true,
 *       "time_to_event": 184,
 *       "time_unit": "days"
 *     }
 *   ]
 * }
 */
let patients = []; // array of patient objects

const els = {
  patient: document.getElementById("patient"),
  dir: document.getElementById("dir"),
  slice: document.getElementById("slice"),
  img: document.getElementById("img"),
  status: document.getElementById("status"),
  label: document.getElementById("label"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  featId: document.getElementById("feat-id"),
  featCensored: document.getElementById("feat-censored"),
  featTTI: document.getElementById("feat-tti"),
};

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

const debouncedLoadSlice = debounce(loadSlice, 120);

function pad(n, digits) {
  return String(n).padStart(digits, "0");
}

function buildUrl(patientFolder, dir, sliceIndex0Based) {
  // <folder>/slices_x/slice_000.png
  return `scan/${patientFolder}/${dir}/slice_${pad(sliceIndex0Based, PAD)}.${EXT}`;
}

function setStatus(msg) {
  els.status.textContent = msg || "";
}

function getStateFromUrl() {
  const p = new URLSearchParams(location.search);
  return {
    patientKey: p.get("p"), // we'll store patient "id" in URL
    dir: p.get("d"),
    slice: p.get("s") ? parseInt(p.get("s"), 10) : null,
  };
}

function setUrlFromState() {
  const selected = getSelectedPatient();
  const p = new URLSearchParams();
  p.set("p", selected?.id ?? "");
  p.set("d", els.dir.value);
  p.set("s", String(els.slice.value));
  history.replaceState(null, "", `?${p.toString()}`);
}

function getSelectedPatient() {
  const idx = parseInt(els.patient.value, 10);
  return patients[idx] || null;
}

function renderClinicalFeatures(p) {
  if (!p) {
    els.featId.textContent = "—";
    els.featCensored.textContent = "—";
    els.featTTI.textContent = "—";
    return;
  }

  els.featId.textContent = p.id ?? "(no id)";
  els.featCensored.textContent =
    p.censored === true ? "Yes" :
    p.censored === false ? "No" : "—";

  if (p.time_to_event === null || p.time_to_event === undefined || p.time_to_event === "") {
    els.featTTI.textContent = "—";
  } else {
    const unit = p.time_unit ? ` ${p.time_unit}` : "";
    els.featTTI.textContent = `${p.time_to_event}${unit}`;
  }
}

function preloadNeighbor(patientFolder, dir, s) {
  if (s < 0 || s > SLICE_COUNT - 1) return;
  const url = buildUrl(patientFolder, dir, s);
  const im = new Image();
  im.src = url;
}

function loadSlice() {
  const p = getSelectedPatient();
  if (!p) {
    setStatus("No patient selected.");
    return;
  }

  const dir = els.dir.value;
  const s = parseInt(els.slice.value, 10);

  const url = buildUrl(p.folder, dir, s);
  els.label.textContent = `${p.id} • ${dir} • slice ${s}/${SLICE_COUNT - 1}`;
  renderClinicalFeatures(p);
  setUrlFromState();

  setStatus(`Loading: ${url}`);
  const im = new Image();
  im.onload = () => {
    els.img.src = url;
    setStatus("");
    // preloadNeighbor(p.folder, dir, s - 1);
    // preloadNeighbor(p.folder, dir, s + 1);
  };
  im.onerror = () => setStatus(`Failed to load: ${url}`);
  im.src = url;
}

function step(delta) {
  const next = Math.max(0, Math.min(SLICE_COUNT - 1, parseInt(els.slice.value, 10) + delta));
  els.slice.value = String(next);
  loadSlice();
}

async function initPatients() {
  const res = await fetch("patients.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not read patients.json (${res.status})`);
  const data = await res.json();

  patients = Array.isArray(data.patients) ? data.patients : [];
  if (!patients.length) throw new Error("patients.json has no patients.");

  // Populate dropdown (value is index; label shows patient id)
  els.patient.innerHTML = "";
  patients.forEach((p, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = p.id ?? p.folder ?? `patient_${i}`;
    els.patient.appendChild(opt);
  });

  // Apply state from URL if present (p = patient id)
  const st = getStateFromUrl();
  if (st.patientKey) {
    const idx = patients.findIndex(x => x.id === st.patientKey);
    if (idx >= 0) els.patient.value = String(idx);
  }
  if (st.dir) els.dir.value = st.dir;
  if (Number.isInteger(st.slice) && st.slice >= 0 && st.slice <= SLICE_COUNT - 1) {
    els.slice.value = String(st.slice);
  }
}

async function init() {
  els.slice.min = "0";
  els.slice.max = String(SLICE_COUNT - 1);
  els.slice.step = "1";

  await initPatients();
  loadSlice();

  els.patient.addEventListener("change", loadSlice);
  els.dir.addEventListener("change", loadSlice);
  els.slice.addEventListener("input", debouncedLoadSlice);
  els.slice.addEventListener("change", loadSlice);
  els.slice.addEventListener("input", () => {
    const s = els.slice.value;
    els.label.textContent = `slice ${s}/${SLICE_COUNT - 1}`;
  });
  els.prev.addEventListener("click", () => step(-1));
  els.next.addEventListener("click", () => step(+1));

  // keyboard
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") step(-1);
    if (e.key === "ArrowRight" || e.key === "d") step(+1);
  });

  // mouse wheel scroll through slices
  let wheelAccum = 0;
  window.addEventListener("wheel", (e) => {
    wheelAccum += e.deltaY;
    if (Math.abs(wheelAccum) > 60) {
      step(wheelAccum > 0 ? 1 : -1);
      wheelAccum = 0;
    }
  }, { passive: true });
}

init().catch(err => setStatus(String(err)));