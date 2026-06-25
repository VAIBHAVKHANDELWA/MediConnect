import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";
import { Lock, Unlock, Droplets, Wind, AlertCircle, CheckCircle, Info } from "lucide-react";

// ─── Lock Slider ──────────────────────────────────────────────────────────────
function LockSlider({ available, locked, onLockChange, color }) {
  const max = available + locked;
  const pct = max > 0 ? (locked / max) * 100 : 0;

  return (
    <div className="space-y-2">
      <input
        type="range"
        min={0}
        max={max}
        value={locked}
        onChange={(e) => onLockChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>0</span>
        <span className="font-medium" style={{ color }}>
          Locked: {locked}
        </span>
        <span>{max}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Resource Lock Card ───────────────────────────────────────────────────────
function LockCard({ title, icon: Icon, iconColor, children, isLocked, onToggleLock }) {
  return (
    <div className={`bg-white rounded-xl border-2 transition-all ${isLocked ? "border-blue-400 shadow-blue-100 shadow-md" : "border-gray-200"}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
          <h3 className="font-semibold text-gray-800">{title}</h3>
        </div>
        <button
          onClick={onToggleLock}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isLocked
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          {isLocked ? "Locked" : "Unlocked"}
        </button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PartialResourceLocking({ hospitalId }) {
  const hid = hospitalId || localStorage.getItem("hospitalID");

  const [resources, setResources] = useState(null);
  const [locks, setLocks] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Live listener for resources
  useEffect(() => {
    if (!hid) return;
    const ref = doc(db, "hospitals", hid, "resources", "resourceInfo");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setResources(data);

        // Initialize locks from saved data if present
        if (data.locks && Object.keys(locks).length === 0) {
          setLocks(data.locks);
        }
        setLoading(false);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hid]);

  const getLock = (key) =>
    locks[key] ?? { locked: 0, enabled: false, reason: "" };

  const setLockField = (key, field, value) => {
    setLocks((prev) => ({
      ...prev,
      [key]: { ...getLock(key), [field]: value },
    }));
  };

  const toggleLock = (key) => {
    const current = getLock(key);
    setLocks((prev) => ({
      ...prev,
      [key]: { ...current, enabled: !current.enabled, locked: !current.enabled ? current.locked : 0 },
    }));
  };

  const saveLocks = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "hospitals", hid, "resources", "resourceInfo"), {
        locks,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error("Save locks error:", e);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!resources) {
    return <p className="text-gray-500 text-center py-10">No resource data found.</p>;
  }

  // ── Compute available values ──────────────────────────────────────────────
  const oxyTotal =
    typeof resources.oxygenCylinders === "number"
      ? resources.oxygenCylinders
      : resources.oxygenCylinders?.available || 0;

  const oxyLock = getLock("oxygenCylinders");
  const oxyFree = Math.max(0, oxyTotal - oxyLock.locked);

  const bloodGroups = Object.entries(resources.bloodBank || {});

  // Total locked blood units
  const totalLockedBlood = bloodGroups.reduce((sum, [group]) => {
    const l = getLock(`blood_${group}`);
    return sum + (l.enabled ? l.locked : 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lock className="w-7 h-7 text-blue-600" />
            Partial Resource Locking
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Reserve and lock specific blood and oxygen units for priority use
          </p>
        </div>

        <button
          onClick={saveLocks}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            saved
              ? "bg-green-600 text-white"
              : "bg-blue-600 text-white hover:bg-blue-700"
          } disabled:opacity-60`}
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : saving ? null : <Lock className="w-4 h-4" />}
          {saved ? "Saved!" : saving ? "Saving..." : "Save All Locks"}
        </button>
      </div>

      {/* ── Info Banner ── */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <strong>How locking works:</strong> Locked units are reserved and subtracted from the
          available count shown in Hospital Network. Other hospitals will not see locked units
          as available when sending referrals. This prevents over-allocation of critical resources.
        </div>
      </div>

      {/* ── Summary Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{oxyLock.enabled ? oxyLock.locked : 0}</div>
          <div className="text-xs text-gray-500 mt-1">Oxygen Cylinders Locked</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{totalLockedBlood}</div>
          <div className="text-xs text-gray-500 mt-1">Blood Units Locked</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {Object.values(locks).filter((l) => l.enabled).length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Active Locks</div>
        </div>
      </div>

      {/* ── Oxygen Locking ── */}
      <LockCard
        title="Oxygen Cylinders"
        icon={Wind}
        iconColor="#0ea5e9"
        isLocked={oxyLock.enabled}
        onToggleLock={() => toggleLock("oxygenCylinders")}
      >
        <div className="grid md:grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-800">{oxyTotal}</div>
            <div className="text-xs text-gray-500">Total Available</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{oxyLock.enabled ? oxyLock.locked : 0}</div>
            <div className="text-xs text-blue-400">Locked / Reserved</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{oxyLock.enabled ? oxyFree : oxyTotal}</div>
            <div className="text-xs text-green-400">Freely Available</div>
          </div>
        </div>

        {oxyLock.enabled && (
          <div className="space-y-3">
            <LockSlider
              available={oxyFree}
              locked={oxyLock.locked}
              onLockChange={(v) => setLockField("oxygenCylinders", "locked", v)}
              color="#0ea5e9"
            />
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Reason for locking</label>
              <input
                type="text"
                placeholder="e.g., Reserved for ICU patients"
                value={oxyLock.reason || ""}
                onChange={(e) => setLockField("oxygenCylinders", "reason", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
          </div>
        )}

        {!oxyLock.enabled && (
          <p className="text-sm text-gray-400 italic text-center py-2">
            Enable locking to reserve oxygen cylinders
          </p>
        )}
      </LockCard>

      {/* ── Blood Bank Locking ── */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 p-4 border-b border-gray-100 bg-red-50">
          <Droplets className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-gray-800">Blood Bank — Per Group Locking</h3>
          <span className="ml-auto text-xs text-gray-500">{bloodGroups.length} groups</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 p-4">
          {bloodGroups.map(([group, units]) => {
            const key = `blood_${group}`;
            const lock = getLock(key);
            const free = Math.max(0, units - lock.locked);
            const isCritical = units < 15;

            return (
              <div
                key={group}
                className={`rounded-xl border p-4 transition-all ${
                  lock.enabled
                    ? "border-red-300 bg-red-50"
                    : isCritical
                    ? "border-orange-300 bg-orange-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-red-600">{group}</span>
                    {isCritical && (
                      <AlertCircle className="w-4 h-4 text-orange-500" title="Low stock" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-700">{units} units</span>
                    <button
                      onClick={() => toggleLock(key)}
                      className={`p-1.5 rounded-lg transition-all ${
                        lock.enabled
                          ? "bg-red-500 text-white hover:bg-red-600"
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      }`}
                    >
                      {lock.enabled ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {lock.enabled ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Free: <strong className="text-green-600">{free}</strong></span>
                      <span className="text-gray-500">Locked: <strong className="text-red-600">{lock.locked}</strong></span>
                    </div>
                    <LockSlider
                      available={free}
                      locked={lock.locked}
                      onLockChange={(v) => setLockField(key, "locked", Math.min(v, units))}
                      color="#ef4444"
                    />
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      value={lock.reason || ""}
                      onChange={(e) => setLockField(key, "reason", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-red-300 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic">
                    Click 🔓 to lock units
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Lock Summary Table ── */}
      {Object.values(locks).some((l) => l.enabled) && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h4 className="font-semibold text-gray-800">Active Lock Summary</h4>
          </div>
          <div className="divide-y divide-gray-50">
            {Object.entries(locks)
              .filter(([, l]) => l.enabled && l.locked > 0)
              .map(([key, l]) => (
                <div key={key} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-800">
                      {key === "oxygenCylinders" ? "Oxygen Cylinders" : `Blood ${key.replace("blood_", "")}`}
                    </span>
                    {l.reason && (
                      <div className="text-xs text-gray-400">{l.reason}</div>
                    )}
                  </div>
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
                    {l.locked} locked
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
