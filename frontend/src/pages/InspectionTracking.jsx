import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import {
  Wind,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  Wrench,
  Calendar,
  ClipboardList,
  Info,
  XCircle,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const INSPECTION_INTERVAL_DAYS = 90; // standard quarterly check
const HYDRO_TEST_INTERVAL_DAYS = 365 * 5; // every 5 years

const STATUS_TYPES = {
  operational: { label: "Operational", color: "green", icon: CheckCircle },
  due_inspection: { label: "Inspection Due", color: "orange", icon: Clock },
  under_maintenance: { label: "Under Maintenance", color: "blue", icon: Wrench },
  out_of_service: { label: "Out of Service", color: "red", icon: XCircle },
};

const STATUS_STYLES = {
  green: { card: "border-green-300 bg-green-50", badge: "bg-green-100 text-green-700" },
  orange: { card: "border-orange-400 bg-orange-50", badge: "bg-orange-100 text-orange-700" },
  blue: { card: "border-blue-400 bg-blue-50", badge: "bg-blue-100 text-blue-700" },
  red: { card: "border-red-400 bg-red-50", badge: "bg-red-100 text-red-700" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / 86400000);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function today() {
  return new Date().toISOString().split("T")[0];
}

// ─── Add Cylinder Modal ───────────────────────────────────────────────────────
function AddCylinderModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    serialNumber: "",
    manufacturer: "",
    capacity: "",
    lastInspectionDate: today(),
    lastHydroTestDate: "",
    location: "",
    notes: "",
  });

  const isValid = form.serialNumber.trim() && form.lastInspectionDate;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Wind className="w-6 h-6 text-blue-500" />
          <h3 className="text-xl font-bold text-gray-900">Register Oxygen Cylinder</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-sm font-medium text-gray-700 block mb-1">Serial Number *</label>
            <input
              type="text"
              placeholder="e.g., OX-2025-001"
              value={form.serialNumber}
              onChange={(e) => setForm((p) => ({ ...p, serialNumber: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Manufacturer</label>
            <input
              type="text"
              placeholder="e.g., Linde"
              value={form.manufacturer}
              onChange={(e) => setForm((p) => ({ ...p, manufacturer: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Capacity (L)</label>
            <input
              type="number"
              placeholder="e.g., 40"
              value={form.capacity}
              onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Last Inspection *</label>
            <input
              type="date"
              value={form.lastInspectionDate}
              max={today()}
              onChange={(e) => setForm((p) => ({ ...p, lastInspectionDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Last Hydro Test</label>
            <input
              type="date"
              value={form.lastHydroTestDate}
              max={today()}
              onChange={(e) => setForm((p) => ({ ...p, lastHydroTestDate: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div className="col-span-2">
            <label className="text-sm font-medium text-gray-700 block mb-1">Storage Location</label>
            <input
              type="text"
              placeholder="e.g., Ward 3, Storage Room B"
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div className="col-span-2">
            <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
            <input
              type="text"
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => isValid && onAdd(form)}
            disabled={!isValid}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            Register Cylinder
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Log Inspection Modal ─────────────────────────────────────────────────────
function LogInspectionModal({ cylinder, onClose, onLog }) {
  const [form, setForm] = useState({
    type: "routine",
    date: today(),
    technicianName: "",
    result: "pass",
    notes: "",
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-xl font-bold text-gray-900">
          Log Inspection — <span className="text-blue-600">{cylinder.serialNumber}</span>
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Inspection Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            >
              <option value="routine">Routine Check</option>
              <option value="hydro_test">Hydrostatic Test</option>
              <option value="valve_check">Valve Inspection</option>
              <option value="full_service">Full Service</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              max={today()}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Technician Name</label>
            <input
              type="text"
              placeholder="e.g., John Smith"
              value={form.technicianName}
              onChange={(e) => setForm((p) => ({ ...p, technicianName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Result</label>
            <select
              value={form.result}
              onChange={(e) => setForm((p) => ({ ...p, result: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            >
              <option value="pass">✅ Pass</option>
              <option value="fail">❌ Fail — Needs Service</option>
              <option value="decommission">🚫 Decommission</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Inspection findings..."
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onLog(form)}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Log Inspection
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function InspectionTracking({ hospitalId }) {
  const hid = hospitalId || localStorage.getItem("hospitalID");

  const [cylinders, setCylinders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [logTarget, setLogTarget] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  // ── Live listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hid) return;
    const ref = collection(db, "hospitals", hid, "oxygenCylinders");
    const unsub = onSnapshot(ref, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCylinders(list);
      setLoading(false);
    });
    return () => unsub();
  }, [hid]);

  // ── Derive status for each cylinder ───────────────────────────────────────
  const enrichCylinder = (cyl) => {
    const nextInspection = cyl.lastInspectionDate
      ? addDays(cyl.lastInspectionDate, INSPECTION_INTERVAL_DAYS)
      : null;
    const nextHydro = cyl.lastHydroTestDate
      ? addDays(cyl.lastHydroTestDate, HYDRO_TEST_INTERVAL_DAYS)
      : null;
    const daysToInspect = nextInspection ? daysUntil(nextInspection) : -999;
    const daysToHydro = nextHydro ? daysUntil(nextHydro) : null;

    let computedStatus = cyl.status || "operational";
    if (computedStatus === "operational" && daysToInspect <= 7) {
      computedStatus = "due_inspection";
    }

    return {
      ...cyl,
      nextInspection,
      nextHydro,
      daysToInspect,
      daysToHydro,
      computedStatus,
    };
  };

  const enriched = cylinders.map(enrichCylinder);

  const addCylinder = async (form) => {
    setShowAdd(false);
    const nextInspection = addDays(form.lastInspectionDate, INSPECTION_INTERVAL_DAYS);
    await addDoc(collection(db, "hospitals", hid, "oxygenCylinders"), {
      ...form,
      status: "operational",
      nextInspection,
      inspectionLog: [],
      registeredAt: serverTimestamp(),
    });
  };

  const logInspection = async (form) => {
    if (!logTarget) return;
    setLogTarget(null);

    const isHydro = form.type === "hydro_test";
    const newStatus =
      form.result === "fail" ? "under_maintenance" :
      form.result === "decommission" ? "out_of_service" : "operational";

    const nextInspection = addDays(form.date, INSPECTION_INTERVAL_DAYS);
    const nextHydro = isHydro ? addDays(form.date, HYDRO_TEST_INTERVAL_DAYS) : logTarget.nextHydro;

    const logEntry = {
      type: form.type,
      date: form.date,
      technicianName: form.technicianName,
      result: form.result,
      notes: form.notes,
    };

    const updates = {
      status: newStatus,
      lastInspectionDate: form.date,
      nextInspection,
      inspectionLog: [...(logTarget.inspectionLog || []), logEntry],
    };
    if (isHydro) {
      updates.lastHydroTestDate = form.date;
      updates.nextHydro = nextHydro;
    }

    await updateDoc(doc(db, "hospitals", hid, "oxygenCylinders", logTarget.id), updates);
  };

  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, "hospitals", hid, "oxygenCylinders", id), { status });
  };

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = filterStatus === "all"
    ? enriched
    : enriched.filter((c) => c.computedStatus === filterStatus);

  // ── Summary counts ─────────────────────────────────────────────────────────
  const counts = {
    operational: enriched.filter((c) => c.computedStatus === "operational").length,
    due_inspection: enriched.filter((c) => c.computedStatus === "due_inspection").length,
    under_maintenance: enriched.filter((c) => c.computedStatus === "under_maintenance").length,
    out_of_service: enriched.filter((c) => c.computedStatus === "out_of_service").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wind className="w-7 h-7 text-blue-500" />
            Oxygen Cylinder Inspection Tracking
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Routine inspection every {INSPECTION_INTERVAL_DAYS} days · Hydrostatic test every 5 years
          </p>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Register Cylinder
        </button>
      </div>

      {/* ── Info ── */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          Each oxygen cylinder must undergo a <strong>routine visual inspection every 90 days</strong> and
          a <strong>hydrostatic pressure test every 5 years</strong> per medical gas safety regulations.
          Cylinders due for inspection within 7 days are flagged automatically.
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(STATUS_TYPES).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const styles = STATUS_STYLES[cfg.color];
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(filterStatus === key ? "all" : key)}
              className={`rounded-xl border-2 p-4 text-center transition-all hover:shadow-md ${
                filterStatus === key ? styles.card : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex justify-center mb-1">
                <Icon className={`w-5 h-5 ${filterStatus === key ? "" : "text-gray-400"}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{counts[key]}</div>
              <div className="text-xs text-gray-500 mt-1">{cfg.label}</div>
            </button>
          );
        })}
      </div>

      {/* ── Cylinder List ── */}
      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Wind className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No cylinders registered yet.</p>
          <p className="text-sm text-gray-400 mt-1">Click "Register Cylinder" to add your first one.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((cyl) => {
          const cfg = STATUS_TYPES[cyl.computedStatus];
          const styles = STATUS_STYLES[cfg.color];
          const Icon = cfg.icon;
          const isUrgent = cyl.computedStatus === "due_inspection" || cyl.computedStatus === "out_of_service";

          return (
            <div key={cyl.id} className={`rounded-xl border-2 p-4 transition-all ${styles.card}`}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                {/* Left info */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center border border-gray-200 shadow-sm flex-shrink-0">
                    <Wind className="w-6 h-6 text-blue-500" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-lg">{cyl.serialNumber}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${styles.badge}`}>
                        {cfg.label}
                      </span>
                      {isUrgent && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                    </div>

                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                      {cyl.manufacturer && <span>Manufacturer: <strong>{cyl.manufacturer}</strong></span>}
                      {cyl.capacity && <span>Capacity: <strong>{cyl.capacity}L</strong></span>}
                      {cyl.location && <span>📍 {cyl.location}</span>}
                    </div>

                    <div className="flex flex-wrap gap-4 mt-2 text-xs">
                      <div className={`flex items-center gap-1 ${cyl.daysToInspect <= 7 ? "text-orange-600 font-semibold" : "text-gray-500"}`}>
                        <Calendar className="w-3.5 h-3.5" />
                        Next inspection:{" "}
                        {cyl.nextInspection
                          ? `${new Date(cyl.nextInspection).toLocaleDateString()} (${cyl.daysToInspect}d)`
                          : "N/A"}
                      </div>
                      {cyl.nextHydro && (
                        <div className="flex items-center gap-1 text-gray-500">
                          <Wrench className="w-3.5 h-3.5" />
                          Hydro test:{" "}
                          {new Date(cyl.nextHydro).toLocaleDateString()}{" "}
                          ({cyl.daysToHydro}d)
                        </div>
                      )}
                    </div>

                    {/* Inspection history */}
                    {cyl.inspectionLog?.length > 0 && (
                      <div className="mt-2 text-xs text-gray-400">
                        Last inspected: {cyl.inspectionLog.at(-1).date} by {cyl.inspectionLog.at(-1).technicianName || "—"} ·{" "}
                        Result: <span className={cyl.inspectionLog.at(-1).result === "pass" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                          {cyl.inspectionLog.at(-1).result}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setLogTarget(cyl)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    Log Inspection
                  </button>

                  <select
                    value={cyl.status || "operational"}
                    onChange={(e) => updateStatus(cyl.id, e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:ring-2 focus:ring-blue-300 focus:outline-none"
                  >
                    {Object.entries(STATUS_TYPES).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Days to inspection progress bar */}
              {cyl.nextInspection && (
                <div className="mt-3">
                  <div className="w-full bg-white rounded-full h-1.5 border border-gray-200">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        cyl.daysToInspect <= 0 ? "bg-red-500" :
                        cyl.daysToInspect <= 7 ? "bg-orange-400" :
                        cyl.daysToInspect <= 30 ? "bg-yellow-400" : "bg-green-500"
                      }`}
                      style={{
                        width: `${Math.max(2, Math.min(100, (cyl.daysToInspect / INSPECTION_INTERVAL_DAYS) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {INSPECTION_INTERVAL_DAYS - Math.max(0, cyl.daysToInspect)} days since last inspection
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Modals ── */}
      {showAdd && <AddCylinderModal onClose={() => setShowAdd(false)} onAdd={addCylinder} />}
      {logTarget && (
        <LogInspectionModal
          cylinder={logTarget}
          onClose={() => setLogTarget(null)}
          onLog={logInspection}
        />
      )}
    </div>
  );
}
