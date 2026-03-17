// viewer.js
const SLICE_COUNT = 480;
const PAD = 3;
const EXT = "png";

let patients = [];
let latestRequestId = 0;

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

function pad(n, digits) {
  return String(n).padStart(digits, "0");
}

function buildUrl(patientFolder, dir, sliceIndex0Based) {
  return `scan/${patientFolder}/${dir}/slice_${pad(sliceIndex0Based, PAD)}.${EXT}`;
}

function setStatus(msg) {
  els.status.textContent = msg || "";
}

function getStateFromUrl() {
  const p = new URLSearchParams(location.search);
  return {
    patientKey: p.get("p"),
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

function updateLabel() {
  const p = getSelectedPatient();
  const s = els.slice.value;
  const dir = els.dir.value;
  els.label.textContent = `${p?.id ?? "—"} • ${dir} • slice ${s}/${SLICE_COUNT - 1}`;
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
  const requestId = ++latestRequestId;

  updateLabel();
  renderClinicalFeatures(p);
  setUrlFromState();

  setStatus(`Loading: ${url}`);
  const im = new Image();
  im.onload = () => {
    if (requestId !== latestRequestId) return;
    els.img.src = url;
    setStatus("");
  };
  im.onerror = () => {
    if (requestId !== latestRequestId) return;
    setStatus(`Failed to load: ${url}`);
  };
  im.src = url;
}

const debouncedLoadSlice = debounce(loadSlice, 120);

function step(delta) {
  const next = Math.max(0, Math.min(SLICE_COUNT - 1, parseInt(els.slice.value, 10) + delta));
  els.slice.value = String(next);
  updateLabel();
  loadSlice();
}

async function initPatients() {
  const res = await fetch("patients.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not read patients.json (${res.status})`);
  const data = await res.json();

  patients = Array.isArray(data.patients) ? data.patients : [];
  if (!patients.length) throw new Error("patients.json has no patients.");

  els.patient.innerHTML = "";
  patients.forEach((p, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = p.id ?? p.folder ?? `patient_${i}`;
    els.patient.appendChild(opt);
  });

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
  updateLabel();
  loadSlice();

  els.patient.addEventListener("change", () => {
    updateLabel();
    loadSlice();
  });

  els.dir.addEventListener("change", () => {
    updateLabel();
    loadSlice();
  });

  els.slice.addEventListener("input", () => {
    updateLabel();
    debouncedLoadSlice();
  });

  els.slice.addEventListener("change", loadSlice);

  els.prev.addEventListener("click", () => step(-1));
  els.next.addEventListener("click", () => step(+1));

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") step(-1);
    if (e.key === "ArrowRight" || e.key === "d") step(+1);
  });

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