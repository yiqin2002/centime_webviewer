const SLICE_COUNT = 480;
const PAD = 3;
const EXT = "png";
const DEFAULT_METHODS = ["method_1", "method_2", "method_3"];

let patients = [];
let latestRequestId = 0;

const els = {
  patient: document.getElementById("patient"),
  dir: document.getElementById("dir"),
  slice: document.getElementById("slice"),
  img1: document.getElementById("img1"),
  img2: document.getElementById("img2"),
  img3: document.getElementById("img3"),
  methodLabel1: document.getElementById("method-label-1"),
  methodLabel2: document.getElementById("method-label-2"),
  methodLabel3: document.getElementById("method-label-3"),
  toggleMethodLabels: document.getElementById("toggle-method-labels"),
  imageRow: document.getElementById("image-row"),
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

function buildUrl(patientFolder, dir, method, sliceIndex0Based) {
  return `scan/${patientFolder}/${dir}/${method}/slice_${pad(sliceIndex0Based, PAD)}.${EXT}`;
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
    showLabels: p.get("labels") === "1",
  };
}

function setUrlFromState() {
  const selected = getSelectedPatient();
  const p = new URLSearchParams();
  p.set("p", selected?.id ?? "");
  p.set("d", els.dir.value);
  p.set("s", String(els.slice.value));
  if (els.toggleMethodLabels.checked) {
    p.set("labels", "1");
  }
  history.replaceState(null, "", `?${p.toString()}`);
}

function getSelectedPatient() {
  const idx = parseInt(els.patient.value, 10);
  return patients[idx] || null;
}

function getPatientMethods(p) {
  if (Array.isArray(p?.methods) && p.methods.length > 0) {
    return p.methods;
  }
  return DEFAULT_METHODS;
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

function updateMethodLabels() {
  const p = getSelectedPatient();
  const methods = getPatientMethods(p);
  const labelEls = [els.methodLabel1, els.methodLabel2, els.methodLabel3];

  for (let i = 0; i < labelEls.length; i++) {
    labelEls[i].textContent = methods[i] ?? "";
  }
}

function applyMethodLabelVisibility() {
  els.imageRow.classList.toggle("show-method-labels", els.toggleMethodLabels.checked);
  setUrlFromState();
}

function clearImages() {
  els.img1.removeAttribute("src");
  els.img2.removeAttribute("src");
  els.img3.removeAttribute("src");
}

function loadImage(url) {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ ok: true, url });
    im.onerror = () => resolve({ ok: false, url });
    im.src = url;
  });
}

async function loadSlice() {
  const p = getSelectedPatient();
  if (!p) {
    setStatus("No patient selected.");
    clearImages();
    updateMethodLabels();
    return;
  }

  const dir = els.dir.value;
  const s = parseInt(els.slice.value, 10);
  const methods = getPatientMethods(p);
  const requestId = ++latestRequestId;

  updateLabel();
  updateMethodLabels();
  renderClinicalFeatures(p);
  setUrlFromState();

  const urls = methods.map((method) => buildUrl(p.folder, dir, method, s));
  setStatus(`Loading slice ${s}...`);

  const results = await Promise.all(urls.map(loadImage));

  if (requestId !== latestRequestId) return;

  const imgEls = [els.img1, els.img2, els.img3];
  imgEls.forEach((imgEl) => imgEl.removeAttribute("src"));

  let failed = 0;
  const maxPanels = Math.min(imgEls.length, results.length);

  for (let i = 0; i < maxPanels; i++) {
    if (results[i].ok) {
      imgEls[i].src = results[i].url;
    } else {
      failed += 1;
    }
  }

  if (failed === 0) {
    setStatus("");
  } else {
    setStatus(`${failed} image(s) failed to load for this slice.`);
  }
}

const debouncedLoadSlice = debounce(loadSlice, 120);

function step(delta) {
  const next = Math.max(
    0,
    Math.min(SLICE_COUNT - 1, parseInt(els.slice.value, 10) + delta)
  );
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
    const idx = patients.findIndex((x) => x.id === st.patientKey);
    if (idx >= 0) els.patient.value = String(idx);
  }
  if (st.dir) els.dir.value = st.dir;
  if (
    Number.isInteger(st.slice) &&
    st.slice >= 0 &&
    st.slice <= SLICE_COUNT - 1
  ) {
    els.slice.value = String(st.slice);
  }
  els.toggleMethodLabels.checked = st.showLabels;
}

async function init() {
  els.slice.min = "0";
  els.slice.max = String(SLICE_COUNT - 1);
  els.slice.step = "1";

  await initPatients();
  applyMethodLabelVisibility();
  updateMethodLabels();
  updateLabel();
  loadSlice();

  els.patient.addEventListener("change", () => {
    updateMethodLabels();
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

  els.toggleMethodLabels.addEventListener("change", () => {
    applyMethodLabelVisibility();
    updateMethodLabels();
  });

  els.prev.addEventListener("click", () => step(-1));
  els.next.addEventListener("click", () => step(+1));

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a") step(-1);
    if (e.key === "ArrowRight" || e.key === "d") step(+1);
  });

  let wheelAccum = 0;
  window.addEventListener(
    "wheel",
    (e) => {
      wheelAccum += e.deltaY;
      if (Math.abs(wheelAccum) > 60) {
        step(wheelAccum > 0 ? 1 : -1);
        wheelAccum = 0;
      }
    },
    { passive: true }
  );
}

init().catch((err) => setStatus(String(err)));