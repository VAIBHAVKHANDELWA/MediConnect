import { useState, useEffect, useCallback } from "react";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { AlertTriangle, Bell, BellOff, Settings, CheckCircle, XCircle, Activity } from "lucide-react";

// ─── Default Thresholds ───────────────────────────────────────────────────────
const DEFAULT_THRESHOLDS = {
  beds: 10,
  icuBeds: 5,
  ventilators: 3,
  oxygenCylinders: 20,
  ambulances: 2,
  bloodUnitsPerGroup: 15,
};

// ─── Severity Helper ──────────────────────────────────────────────────────────
function getSeverity(value, threshold) {
  if (value === 0) return "critical";
  if (value <= threshold * 0.5) return "critical";
  if (value <= threshold) return "warning";
  return "ok";
}

const SEVERITY_CONFIG = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-400",
    text: "text-red-700",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
    icon: XCircle,
  },
  warning: {
    bg: "bg-orange-50",
    border: "border-orange-400",
    text: "text-orange-700",
    badge: "bg-orange-100 text-orange-700",
    dot: "bg-orange-400",
    icon: AlertTriangle,
  },
  ok: {
    bg: "bg-green-50",
    border: "border-green-300",
    text: "text-green-700",
    badge: "bg-green-100 text-green-700",
    dot: "bg-green-400",
    icon: CheckCircle,
  },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SmartAlertSystem({ hospitalId }) {
  const [resources, setResources] = useState(null);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [showSettings, setShowSettings] = useState(false);
  const [tempThresholds, setTempThresholds] = useState(DEFAULT_THRESHOLDS);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);
  const [sentAlerts, setSentAlerts] = useState(new Set());

  const hid = hospitalId || localStorage.getItem("hospitalID");

  // ── Live resource listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!hid) return;
    const ref = doc(db, "hospitals", hid, "resources", "resourceInfo");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setResources(snap.data());
        setLastChecked(new Date());
      }
    });
    return () => unsub();
  }, [hid]);

  // ── Load saved thresholds ───────────────────────────────────────────────────
  useEffect(() => {
    if (!hid) return;
    const loadThresholds = async () => {
      const ref = doc(db, "hospitals", hid);
      const snap = await getDoc(ref);
      if (snap.exists() && snap.data().alertThresholds) {
        const saved = snap.data().alertThresholds;
        setThresholds(saved);
        setTempThresholds(saved);
      }
    };
    loadThresholds();
  }, [hid]);

  // ── Compute alerts ──────────────────────────────────────────────────────────
  const computeAlerts = useCallback(() => {
    if (!resources) return [];
    const alerts = [];

    const bedsAvail = (resources.beds?.total || 0) - (resources.beds?.occupied || 0);
    const icuAvail = (resources.icuBeds?.total || 0) - (resources.icuBeds?.occupied || 0);
    const ventAvail = (resources.ventilators?.total || 0) - (resources.ventilators?.occupied || 0);
    const oxyAvail =
      typeof resources.oxygenCylinders === "number"
        ? resources.oxygenCylinders
        : resources.oxygenCylinders?.available || 0;
    const ambAvail = (resources.ambulances?.total || 0) - (resources.ambulances?.maintenance || 0);

    const checks = [
      { key: "beds", label: "Available Beds", value: bedsAvail, threshold: thresholds.beds, unit: "beds" },
      { key: "icuBeds", label: "ICU Beds", value: icuAvail, threshold: thresholds.icuBeds, unit: "beds" },
      { key: "ventilators", label: "Ventilators", value: ventAvail, threshold: thresholds.ventilators, unit: "units" },
      { key: "oxygenCylinders", label: "Oxygen Cylinders", value: oxyAvail, threshold: thresholds.oxygenCylinders, unit: "cylinders" },
      { key: "ambulances", label: "Ambulances", value: ambAvail, threshold: thresholds.ambulances, unit: "vehicles" },
    ];

    checks.forEach(({ key, label, value, threshold, unit }) => {
      const severity = getSeverity(value, threshold);
      if (severity !== "ok") {
        alerts.push({ key, label, value, threshold, severity, unit });
      }
    });

    // Blood bank checks
    const bloodBank = resources.bloodBank || {};
    Object.entries(bloodBank).forEach(([group, units]) => {
      const severity = getSeverity(units, thresholds.bloodUnitsPerGroup);
      if (severity !== "ok") {
        alerts.push({
          key: `blood_${group}`,
          label: `Blood ${group}`,
          value: units,
          threshold: thresholds.bloodUnitsPerGroup,
          severity,
          unit: "units",
        });
      }
    });

    return alerts;
  }, [resources, thresholds]);

  // ── Auto-fire Firestore notifications for new critical alerts ────────────────
  useEffect(() => {
    if (!alertsEnabled || !hid) return;
    const alerts = computeAlerts();
    alerts.forEach(async (alert) => {
      if (alert.severity === "critical" && !sentAlerts.has(alert.key)) {
        setSentAlerts((prev) => new Set([...prev, alert.key]));
        try {
          await addDoc(collection(db, "hospitals", hid, "notifications"), {
            type: "critical",
            title: `🚨 Critical: ${alert.label}`,
            message: `${alert.label} is critically low at ${alert.value} ${alert.unit}. Threshold: ${alert.threshold}.`,
            read: false,
            timestamp: serverTimestamp(),
          });
        } catch (e) {
          console.error("Alert notification error:", e);
        }
      }
      // Reset sent flag when resource recovers
      if (alert.severity === "ok") {
        setSentAlerts((prev) => {
          const next = new Set(prev);
          next.delete(alert.key);
          return next;
        });
      }
    });
  }, [resources, alertsEnabled, hid, computeAlerts, sentAlerts]);

  const saveThresholds = async () => {
    setThresholds(tempThresholds);
    setShowSettings(false);
    if (hid) {
      await updateDoc(doc(db, "hospitals", hid), { alertThresholds: tempThresholds });
    }
  };

  const alerts = computeAlerts();
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  // ── Build full status list (ok + alerts) ────────────────────────────────────
  const buildFullStatus = () => {
    if (!resources) return [];
    const bedsAvail = (resources.beds?.total || 0) - (resources.beds?.occupied || 0);
    const icuAvail = (resources.icuBeds?.total || 0) - (resources.icuBeds?.occupied || 0);
    const ventAvail = (resources.ventilators?.total || 0) - (resources.ventilators?.occupied || 0);
    const oxyAvail =
      typeof resources.oxygenCylinders === "number"
        ? resources.oxygenCylinders
        : resources.oxygenCylinders?.available || 0;
    const ambAvail = (resources.ambulances?.total || 0) - (resources.ambulances?.maintenance || 0);

    const items = [
      { key: "beds", label: "Available Beds", value: bedsAvail, threshold: thresholds.beds, unit: "beds" },
      { key: "icuBeds", label: "ICU Beds", value: icuAvail, threshold: thresholds.icuBeds, unit: "beds" },
      { key: "ventilators", label: "Ventilators", value: ventAvail, threshold: thresholds.ventilators, unit: "units" },
      { key: "oxygenCylinders", label: "Oxygen Cylinders", value: oxyAvail, threshold: thresholds.oxygenCylinders, unit: "cylinders" },
      { key: "ambulances", label: "Ambulances", value: ambAvail, threshold: thresholds.ambulances, unit: "vehicles" },
    ].map((i) => ({ ...i, severity: getSeverity(i.value, i.threshold) }));

    const bloodItems = Object.entries(resources.bloodBank || {}).map(([group, units]) => ({
      key: `blood_${group}`,
      label: `Blood ${group}`,
      value: units,
      threshold: thresholds.bloodUnitsPerGroup,
      unit: "units",
      severity: getSeverity(units, thresholds.bloodUnitsPerGroup),
    }));

    return [...items, ...bloodItems];
  };

  const fullStatus = buildFullStatus();

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" />
            Smart Alert System
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Real-time monitoring of critical resource thresholds
            {lastChecked && (
              <span className="ml-2 text-gray-400">
                · Last updated {lastChecked.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle alerts */}
          <button
            onClick={() => setAlertsEnabled((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              alertsEnabled
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {alertsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            {alertsEnabled ? "Alerts On" : "Alerts Off"}
          </button>

          {/* Settings */}
          <button
            onClick={() => { setShowSettings(true); setTempThresholds(thresholds); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
          >
            <Settings className="w-4 h-4" />
            Thresholds
          </button>
        </div>
      </div>

      {/* ── Summary Badges ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{criticalCount}</div>
          <div className="text-sm text-red-500 mt-1 font-medium">Critical Alerts</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-orange-500">{warningCount}</div>
          <div className="text-sm text-orange-400 mt-1 font-medium">Warnings</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{fullStatus.filter((s) => s.severity === "ok").length}</div>
          <div className="text-sm text-green-500 mt-1 font-medium">OK Status</div>
        </div>
      </div>

      {/* ── Active Alerts Banner ── */}
      {alerts.length > 0 && alertsEnabled && (
        <div className="bg-red-600 text-white rounded-xl p-4 flex items-center gap-3 animate-pulse">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <div>
            <span className="font-bold">{criticalCount} critical</span> and{" "}
            <span className="font-bold">{warningCount} warning</span> alert(s) require your attention.
            Notifications have been sent automatically.
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <span className="text-green-700 font-medium">All resources are within safe thresholds. No alerts active.</span>
        </div>
      )}

      {/* ── Full Status Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {fullStatus.map((item) => {
          const cfg = SEVERITY_CONFIG[item.severity];
          const IconComp = cfg.icon;
          const pct = item.threshold > 0 ? Math.min(100, (item.value / item.threshold) * 100) : 100;

          return (
            <div
              key={item.key}
              className={`rounded-xl border-l-4 p-4 ${cfg.bg} ${cfg.border} transition-all`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800 text-sm">{item.label}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${cfg.badge}`}>
                  {item.severity}
                </span>
              </div>

              <div className={`text-3xl font-bold ${cfg.text} mb-1`}>
                {item.value}
                <span className="text-sm font-normal text-gray-500 ml-1">{item.unit}</span>
              </div>

              <div className="text-xs text-gray-500 mb-2">
                Threshold: {item.threshold} {item.unit}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    item.severity === "critical"
                      ? "bg-red-500"
                      : item.severity === "warning"
                      ? "bg-orange-400"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Threshold Settings Modal ── */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              Configure Alert Thresholds
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Alerts fire when available resources fall at or below these values.
            </p>

            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {[
                { key: "beds", label: "Available Beds" },
                { key: "icuBeds", label: "ICU Beds" },
                { key: "ventilators", label: "Ventilators" },
                { key: "oxygenCylinders", label: "Oxygen Cylinders" },
                { key: "ambulances", label: "Ambulances" },
                { key: "bloodUnitsPerGroup", label: "Blood Units (per group)" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium text-gray-700 flex-1">{label}</label>
                  <input
                    type="number"
                    min="0"
                    value={tempThresholds[key]}
                    onChange={(e) =>
                      setTempThresholds((prev) => ({
                        ...prev,
                        [key]: Math.max(0, Number(e.target.value)),
                      }))
                    }
                    className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveThresholds}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Save Thresholds
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
