const SLICE_COUNT = 480;      // fixed per direction
const PAD = 3;               // slice_001.png => 3 digits
const EXT = "png";           // slice_001.png

const els = {
  patient: document.getElementById("patient"),
  dir: document.getElementById("dir"),
  slice: document.getElementById("slice"),
  img: document.getElementById("img"),
  status: document.getElementById("status"),
  label: document.getElementById("label"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
};

function pad(n, digits) {
  return String(n).padStart(digits, "0");
}

function buildUrl(patientId, dir, sliceIndex1Based) {
  // pid_001/slice_x/slice_001.png
  return `${patientId}/${dir}/slice_${pad(sliceIndex1Based - 1, PAD)}.${EXT}`;
}

function setStatus(msg) {
  els.status.textContent = msg || "";
}

function getStateFromUrl() {
  const p = new URLSearchParams(location.search);
  return {
    patient: p.get("p"),
    dir: p.get("d"),
    slice: p.get("s") ? parseInt(p.get("s"), 10) : null,
  };
}

function setUrlFromState() {
  const p = new URLSearchParams();
  p.set("p", els.patient.value);
  p.set("d", els.dir.value);
  p.set("s", String(els.slice.value));
  history.replaceState(null, "", `?${p.toString()}`);
}

function loadSlice() {
  const patientId = els.patient.value;
  const dir = els.dir.value;
  const s = parseInt(els.slice.value, 10);

  const url = buildUrl(patientId, dir, s);
  els.label.textContent = `${patientId} • ${dir} • slices ${s}/${SLICE_COUNT}`;
  setUrlFromState();

  // preload so missing files don't break the main <img>
  setStatus(`Loading: ${url}`);
  const im = new Image();
  im.onload = () => {
    els.img.src = url;
    setStatus("");
    // Preload neighbors for smoother stepping
    preloadNeighbor(patientId, dir, s - 1);
    preloadNeighbor(patientId, dir, s + 1);
  };
  im.onerror = () => setStatus(`Failed to load: ${url}`);
  im.src = url;
}

function preloadNeighbor(patientId, dir, s) {
  if (s < 1 || s > SLICE_COUNT) return;
  const url = buildUrl(patientId, dir, s);
  const im = new Image();
  im.src = url;
}

function step(delta) {
  const next = Math.max(1, Math.min(SLICE_COUNT, parseInt(els.slice.value, 10) + delta));
  els.slice.value = String(next);
  loadSlice();
}

async function initPatients() {
  const res = await fetch("patients.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not read patients.json (${res.status})`);
  const data = await res.json();

  const list = data.patients || [];
  if (!list.length) throw new Error("patients.json has no patients.");

  els.patient.innerHTML = "";
  for (const pid of list) {
    const opt = document.createElement("option");
    opt.value = pid;
    opt.textContent = pid;
    els.patient.appendChild(opt);
  }

  // Apply state from URL if present
  const st = getStateFromUrl();
  if (st.patient && list.includes(st.patient)) els.patient.value = st.patient;
  if (st.dir) els.dir.value = st.dir;
  if (st.slice && st.slice >= 1 && st.slice <= SLICE_COUNT) els.slice.value = String(st.slice);
}

async function init() {
  els.slice.min = "1";
  els.slice.max = String(SLICE_COUNT);
  els.slice.step = "1";

  await initPatients();
  loadSlice();

  els.patient.addEventListener("change", loadSlice);
  els.dir.addEventListener("change", loadSlice);
  els.slice.addEventListener("input", loadSlice);
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
