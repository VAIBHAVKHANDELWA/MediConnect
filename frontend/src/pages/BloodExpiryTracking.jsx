import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { Droplets, Plus, Trash2, AlertTriangle, CheckCircle, Clock, Calendar, Info } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const BLOOD_SHELF_DAYS = { min: 35, max: 42, default: 42 };
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ─── Status computation ───────────────────────────────────────────────────────
function getExpiryStatus(expiryDate) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { label: "Expired", color: "red", daysLeft, urgent: true };
  if (daysLeft <= 3) return { label: "Critical", color: "red", daysLeft, urgent: true };
  if (daysLeft <= 7) return { label: "Expiring Soon", color: "orange", daysLeft, urgent: true };
  if (daysLeft <= 14) return { label: "Warning", color: "yellow", daysLeft, urgent: false };
  return { label: "Good", color: "green", daysLeft, urgent: false };
}

const STATUS_STYLES = {
  red: { card: "border-red-400 bg-red-50", badge: "bg-red-100 text-red-700", icon: "text-red-500" },
  orange: { card: "border-orange-400 bg-orange-50", badge: "bg-orange-100 text-orange-700", icon: "text-orange-500" },
  yellow: { card: "border-yellow-400 bg-yellow-50", badge: "bg-yellow-100 text-yellow-700", icon: "text-yellow-600" },
  green: { card: "border-green-300 bg-green-50", badge: "bg-green-100 text-green-700", icon: "text-green-500" },
};

// ─── Add Batch Modal ──────────────────────────────────────────────────────────
function AddBatchModal({ onClose, onAdd }) {
  const today = new Date().toISOString().split("T")[0];
  const defaultExpiry = new Date(Date.now() + BLOOD_SHELF_DAYS.default * 86400000)
    .toISOString()
    .split("T")[0];

  const [form, setForm] = useState({
    bloodGroup: "O+",
    units: 1,
    donorId: "",
    collectionDate: today,
    expiryDate: defaultExpiry,
    notes: "",
  });

  const handleCollectionChange = (date) => {
    const exp = new Date(new Date(date).getTime() + BLOOD_SHELF_DAYS.default * 86400000)
      .toISOString()
      .split("T")[0];
    setForm((p) => ({ ...p, collectionDate: date, expiryDate: exp }));
  };

  const isValid = form.bloodGroup && form.units > 0 && form.expiryDate;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Droplets className="w-6 h-6 text-red-500" />
          <h3 className="text-xl font-bold text-gray-900">Add Blood Batch</h3>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Blood Group *</label>
            <select
              value={form.bloodGroup}
              onChange={(e) => setForm((p) => ({ ...p, bloodGroup: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
            >
              {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Units *</label>
            <input
              type="number"
              min="1"
              value={form.units}
              onChange={(e) => setForm((p) => ({ ...p, units: Math.max(1, Number(e.target.value)) }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Donor / Batch ID</label>
            <input
              type="text"
              placeholder="e.g., BATCH-2025-001"
              value={form.donorId}
              onChange={(e) => setForm((p) => ({ ...p, donorId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Collection Date</label>
              <input
                type="date"
                value={form.collectionDate}
                max={today}
                onChange={(e) => handleCollectionChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Expiry Date
                <span className="text-gray-400 font-normal ml-1">(35–42 days)</span>
              </label>
              <input
                type="date"
                value={form.expiryDate}
                min={today}
                onChange={(e) => setForm((p) => ({ ...p, expiryDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Notes</label>
            <input
              type="text"
              placeholder="Optional notes..."
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none"
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
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium disabled:opacity-50"
          >
            Add Batch
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BloodExpiryTracking({ hospitalId }) {
  const hid = hospitalId || localStorage.getItem("hospitalID");

  const [batches, setBatches] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [filterGroup, setFilterGroup] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  // ── Live listener on bloodBatches sub-collection ───────────────────────────
  useEffect(() => {
    if (!hid) return;
    const ref = collection(db, "hospitals", hid, "bloodBatches");
    const unsub = onSnapshot(ref, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort by expiry ascending
      list.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
      setBatches(list);
      setLoading(false);
    });
    return () => unsub();
  }, [hid]);

  // ── Auto-notify on page load for urgent batches ────────────────────────────
  useEffect(() => {
    if (!hid || batches.length === 0) return;
    const urgentBatches = batches.filter((b) => getExpiryStatus(b.expiryDate).urgent);
    if (urgentBatches.length === 0) return;

    // Only fire notification once per session
    const sessionKey = `expiry_notif_${hid}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    addDoc(collection(db, "hospitals", hid, "notifications"), {
      type: "warning",
      title: `⚠️ Blood Expiry Alert`,
      message: `${urgentBatches.length} blood batch(es) are expiring soon or have expired. Please review the Blood Expiry Tracker.`,
      read: false,
      timestamp: serverTimestamp(),
    }).catch(console.error);
  }, [batches, hid]);

  const addBatch = async (form) => {
    setShowAdd(false);
    try {
      await addDoc(collection(db, "hospitals", hid, "bloodBatches"), {
        ...form,
        units: Number(form.units),
        addedAt: serverTimestamp(),
        status: "active",
      });

      // Also update bloodBank total in resourceInfo
      const resRef = doc(db, "hospitals", hid, "resources", "resourceInfo");
      const resSnap = await getDoc(resRef);
      if (resSnap.exists()) {
        const current = resSnap.data().bloodBank?.[form.bloodGroup] || 0;
        await updateDoc(resRef, {
          [`bloodBank.${form.bloodGroup}`]: current + Number(form.units),
        });
      }
    } catch (e) {
      console.error("Error adding batch:", e);
    }
  };

  const discardBatch = async (batch) => {
    if (!window.confirm(`Discard ${batch.units} units of ${batch.bloodGroup}? This cannot be undone.`)) return;
    try {
      // Mark as discarded (don't delete so history is preserved)
      await updateDoc(doc(db, "hospitals", hid, "bloodBatches", batch.id), {
        status: "discarded",
        discardedAt: serverTimestamp(),
      });

      // Subtract from bloodBank total
      const resRef = doc(db, "hospitals", hid, "resources", "resourceInfo");
      const resSnap = await getDoc(resRef);
      if (resSnap.exists()) {
        const current = resSnap.data().bloodBank?.[batch.bloodGroup] || 0;
        await updateDoc(resRef, {
          [`bloodBank.${batch.bloodGroup}`]: Math.max(0, current - batch.units),
        });
      }
    } catch (e) {
      console.error("Discard error:", e);
    }
  };

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = batches
    .filter((b) => b.status !== "discarded")
    .filter((b) => filterGroup === "all" || b.bloodGroup === filterGroup)
    .filter((b) => {
      if (filterStatus === "all") return true;
      const { color } = getExpiryStatus(b.expiryDate);
      if (filterStatus === "expired") return color === "red" && getExpiryStatus(b.expiryDate).daysLeft < 0;
      if (filterStatus === "critical") return color === "red";
      if (filterStatus === "warning") return color === "orange" || color === "yellow";
      if (filterStatus === "good") return color === "green";
      return true;
    });

  // ── Summary counts ─────────────────────────────────────────────────────────
  const activeBatches = batches.filter((b) => b.status !== "discarded");
  const expiredCount = activeBatches.filter((b) => getExpiryStatus(b.expiryDate).daysLeft < 0).length;
  const criticalCount = activeBatches.filter((b) => {
    const s = getExpiryStatus(b.expiryDate);
    return s.daysLeft >= 0 && s.daysLeft <= 3;
  }).length;
  const warningCount = activeBatches.filter((b) => {
    const s = getExpiryStatus(b.expiryDate);
    return s.daysLeft > 3 && s.daysLeft <= 14;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Droplets className="w-7 h-7 text-red-500" />
            Blood Expiry Tracking
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Automatic expiry management · Shelf life: {BLOOD_SHELF_DAYS.min}–{BLOOD_SHELF_DAYS.max} days
          </p>
        </div>

        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
        >
          <Plus className="w-4 h-4" />
          Add Blood Batch
        </button>
      </div>

      {/* ── Info Banner ── */}
      <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          Whole blood has a shelf life of <strong>35–42 days</strong> when refrigerated at 1–6°C.
          Critical alerts fire at ≤3 days remaining. Expired batches should be immediately discarded.
          Discarding also automatically deducts from the Blood Bank inventory.
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-gray-800">{activeBatches.length}</div>
          <div className="text-xs text-gray-500 mt-1">Active Batches</div>
        </div>
        <div className={`rounded-xl border p-4 text-center ${expiredCount > 0 ? "bg-red-50 border-red-300" : "bg-white border-gray-200"}`}>
          <div className={`text-3xl font-bold ${expiredCount > 0 ? "text-red-600" : "text-gray-400"}`}>{expiredCount}</div>
          <div className="text-xs text-gray-500 mt-1">Expired</div>
        </div>
        <div className={`rounded-xl border p-4 text-center ${criticalCount > 0 ? "bg-orange-50 border-orange-300" : "bg-white border-gray-200"}`}>
          <div className={`text-3xl font-bold ${criticalCount > 0 ? "text-orange-600" : "text-gray-400"}`}>{criticalCount}</div>
          <div className="text-xs text-gray-500 mt-1">Critical (≤3 days)</div>
        </div>
        <div className={`rounded-xl border p-4 text-center ${warningCount > 0 ? "bg-yellow-50 border-yellow-300" : "bg-white border-gray-200"}`}>
          <div className={`text-3xl font-bold ${warningCount > 0 ? "text-yellow-600" : "text-gray-400"}`}>{warningCount}</div>
          <div className="text-xs text-gray-500 mt-1">Warning (≤14 days)</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-300 focus:outline-none"
        >
          <option value="all">All Groups</option>
          {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-300 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="expired">Expired</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="good">Good</option>
        </select>
      </div>

      {/* ── Batch List ── */}
      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Droplets className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No blood batches found.</p>
          <p className="text-sm text-gray-400 mt-1">Add your first batch using the button above.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((batch) => {
          const status = getExpiryStatus(batch.expiryDate);
          const styles = STATUS_STYLES[status.color];

          return (
            <div
              key={batch.id}
              className={`rounded-xl border-2 p-4 transition-all ${styles.card}`}
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Left: blood group + info */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center shadow-sm border border-gray-200">
                    <span className="text-2xl font-black text-red-600">{batch.bloodGroup}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800">{batch.units} units</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${styles.badge}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      {batch.donorId && (
                        <span className="flex items-center gap-1">
                          <span className="font-medium">Batch:</span> {batch.donorId}
                        </span>
                      )}
                      {batch.collectionDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Collected: {new Date(batch.collectionDate).toLocaleDateString()}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Expires: {new Date(batch.expiryDate).toLocaleDateString()}
                      </span>
                    </div>

                    {batch.notes && (
                      <div className="text-xs text-gray-400 mt-0.5 italic">{batch.notes}</div>
                    )}
                  </div>
                </div>

                {/* Right: days left + actions */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${status.daysLeft < 0 ? "text-red-600" : "text-gray-800"}`}>
                      {status.daysLeft < 0
                        ? `${Math.abs(status.daysLeft)}d`
                        : `${status.daysLeft}d`}
                    </div>
                    <div className="text-xs text-gray-400">
                      {status.daysLeft < 0 ? "overdue" : "remaining"}
                    </div>
                  </div>

                  {(status.urgent || status.daysLeft < 0) && (
                    <AlertTriangle className={`w-5 h-5 ${styles.icon}`} />
                  )}

                  <button
                    onClick={() => discardBatch(batch)}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Discard
                  </button>
                </div>
              </div>

              {/* Expiry progress bar */}
              {status.daysLeft >= 0 && (
                <div className="mt-3">
                  <div className="w-full bg-white rounded-full h-1.5 border border-gray-200">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        status.color === "red" ? "bg-red-500" :
                        status.color === "orange" ? "bg-orange-400" :
                        status.color === "yellow" ? "bg-yellow-400" : "bg-green-500"
                      }`}
                      style={{
                        width: `${Math.max(2, Math.min(100, (status.daysLeft / BLOOD_SHELF_DAYS.max) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add Modal ── */}
      {showAdd && <AddBatchModal onClose={() => setShowAdd(false)} onAdd={addBatch} />}
    </div>
  );
}
