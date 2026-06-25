import { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import {
  BarChart2,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  Download,
} from "lucide-react";

// ─── Simple Bar Chart (pure CSS/SVG - no external chart lib needed) ────────────
function MiniBarChart({ data, color = "#3b82f6", height = 60 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full rounded-t transition-all"
            style={{
              height: `${Math.max(4, (d.value / max) * (height - 16))}px`,
              backgroundColor: color,
              opacity: 0.7 + (i / data.length) * 0.3,
            }}
            title={`${d.label}: ${d.value}`}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, trend, trendValue, color = "blue", icon: Icon }) {
  const colorMap = {
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    red: "text-red-600 bg-red-50",
    orange: "text-orange-600 bg-orange-50",
    purple: "text-purple-600 bg-purple-50",
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        {Icon && (
          <div className={`p-2 rounded-lg ${colorMap[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
      {trend && (
        <div
          className={`flex items-center gap-1 mt-2 text-xs font-medium ${
            trend === "up" ? "text-green-600" : trend === "down" ? "text-red-500" : "text-gray-400"
          }`}
        >
          {trend === "up" ? <ArrowUp className="w-3 h-3" /> : trend === "down" ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {trendValue}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AnalyticsDashboard({ hospitalId }) {
  const [resources, setResources] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const hid = hospitalId || localStorage.getItem("hospitalID");

  const fetchData = async () => {
    if (!hid) return;
    try {
      // Resources
      const resRef = doc(db, "hospitals", hid, "resources", "resourceInfo");
      const resSnap = await getDoc(resRef);
      if (resSnap.exists()) setResources(resSnap.data());

      // Referrals (outgoing + incoming from mirror collection)
      const refCol = collection(db, "hospitals", hid, "referrals");
      const refSnap = await getDocs(refCol);
      const list = refSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setReferrals(list);
    } catch (e) {
      console.error("Analytics fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hid]);

  const refresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const beds = resources?.beds || { total: 0, occupied: 0 };
  const icuBeds = resources?.icuBeds || { total: 0, occupied: 0 };
  const vents = resources?.ventilators || { total: 0, occupied: 0 };
  const bloodBank = resources?.bloodBank || {};
  const ambulances = resources?.ambulances || { total: 0, active: 0, maintenance: 0 };

  const oxyVal =
    typeof resources?.oxygenCylinders === "number"
      ? resources.oxygenCylinders
      : resources?.oxygenCylinders?.available || 0;

  const bedOccupancyPct = beds.total > 0 ? Math.round((beds.occupied / beds.total) * 100) : 0;
  const icuOccupancyPct = icuBeds.total > 0 ? Math.round((icuBeds.occupied / icuBeds.total) * 100) : 0;
  const ventOccupancyPct = vents.total > 0 ? Math.round((vents.occupied / vents.total) * 100) : 0;

  const totalBlood = Object.values(bloodBank).reduce((a, b) => a + (b || 0), 0);
  const criticalBloodGroups = Object.entries(bloodBank).filter(([, v]) => v < 15).map(([g]) => g);

  const outgoing = referrals.filter((r) => r.direction === "outgoing");
  const incoming = referrals.filter((r) => r.direction === "incoming");
  const accepted = referrals.filter((r) => r.status === "accepted");
  const rejected = referrals.filter((r) => r.status === "rejected");
  const pending = referrals.filter((r) => r.status === "pending");
  const acceptRate = referrals.length > 0 ? Math.round((accepted.length / referrals.length) * 100) : 0;

  // Build blood chart data
  const bloodChartData = Object.entries(bloodBank).map(([group, units]) => ({
    label: group,
    value: units || 0,
  }));

  // Build referral status chart
  const referralChartData = [
    { label: "Accepted", value: accepted.length },
    { label: "Rejected", value: rejected.length },
    { label: "Pending", value: pending.length },
  ];

  // Build occupancy chart data
  const occupancyData = [
    { label: "Beds", value: bedOccupancyPct },
    { label: "ICU", value: icuOccupancyPct },
    { label: "Vents", value: ventOccupancyPct },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-blue-600" />
            Analytics Dashboard
          </h2>
          <p className="text-gray-500 text-sm mt-1">Comprehensive reporting and trend analysis</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={() => {
              const data = {
                resources: { beds, icuBeds, ventilators: vents, oxygenCylinders: oxyVal, ambulances, bloodBank },
                referrals: { total: referrals.length, accepted: accepted.length, rejected: rejected.length, pending: pending.length, acceptRate },
                generatedAt: new Date().toISOString(),
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `hospital-analytics-${new Date().toLocaleDateString().replace(/\//g, "-")}.json`;
              a.click();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* ── Tab Nav ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {["overview", "resources", "referrals", "blood"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
              activeTab === tab ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Bed Occupancy"
              value={`${bedOccupancyPct}%`}
              sub={`${beds.occupied} / ${beds.total} beds`}
              trend={bedOccupancyPct > 80 ? "up" : "down"}
              trendValue={bedOccupancyPct > 80 ? "High occupancy" : "Normal range"}
              color={bedOccupancyPct > 80 ? "red" : "green"}
              icon={Activity}
            />
            <StatCard
              label="ICU Occupancy"
              value={`${icuOccupancyPct}%`}
              sub={`${icuBeds.occupied} / ${icuBeds.total} beds`}
              trend={icuOccupancyPct > 75 ? "up" : "down"}
              trendValue={icuOccupancyPct > 75 ? "Near capacity" : "Safe range"}
              color={icuOccupancyPct > 75 ? "orange" : "blue"}
              icon={TrendingUp}
            />
            <StatCard
              label="Referral Accept Rate"
              value={`${acceptRate}%`}
              sub={`${accepted.length} accepted of ${referrals.length}`}
              color="purple"
              icon={TrendingUp}
            />
            <StatCard
              label="Total Blood Units"
              value={totalBlood}
              sub={`${criticalBloodGroups.length} groups critical`}
              trend={criticalBloodGroups.length > 0 ? "down" : "up"}
              trendValue={criticalBloodGroups.length > 0 ? `${criticalBloodGroups.join(", ")} low` : "All adequate"}
              color={criticalBloodGroups.length > 0 ? "red" : "green"}
              icon={Activity}
            />
          </div>

          {/* Mini charts row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Occupancy Rates (%)</h4>
              <MiniBarChart data={occupancyData} color="#3b82f6" height={80} />
              <div className="flex justify-between mt-2">
                {occupancyData.map((d) => (
                  <div key={d.label} className="text-center">
                    <div className="text-xs font-bold text-gray-700">{d.value}%</div>
                    <div className="text-xs text-gray-400">{d.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Referral Outcomes</h4>
              <MiniBarChart
                data={referralChartData}
                color="#10b981"
                height={80}
              />
              <div className="flex justify-between mt-2">
                {referralChartData.map((d) => (
                  <div key={d.label} className="text-center">
                    <div className="text-xs font-bold text-gray-700">{d.value}</div>
                    <div className="text-xs text-gray-400">{d.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Blood Bank (units)</h4>
              <MiniBarChart data={bloodChartData} color="#ef4444" height={80} />
              <div className="text-xs text-gray-400 mt-2">{bloodChartData.length} blood groups tracked</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Resources Tab ── */}
      {activeTab === "resources" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Occupancy bars */}
            {[
              { label: "General Beds", occupied: beds.occupied, total: beds.total, color: "blue" },
              { label: "ICU Beds", occupied: icuBeds.occupied, total: icuBeds.total, color: "purple" },
              { label: "Ventilators", occupied: vents.occupied, total: vents.total, color: "orange" },
            ].map((r) => {
              const pct = r.total > 0 ? Math.round((r.occupied / r.total) * 100) : 0;
              return (
                <div key={r.label} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-800">{r.label}</span>
                    <span className={`text-sm font-bold ${pct > 80 ? "text-red-600" : "text-green-600"}`}>{pct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                    <div
                      className={`h-3 rounded-full transition-all ${pct > 80 ? "bg-red-500" : pct > 60 ? "bg-orange-400" : "bg-green-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{r.occupied} occupied</span>
                    <span>{r.total - r.occupied} available</span>
                    <span>{r.total} total</span>
                  </div>
                </div>
              );
            })}

            {/* Oxygen & Ambulances */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-800 mb-3">Equipment Status</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Oxygen Cylinders</span>
                  <span className="font-bold text-blue-600">{oxyVal} available</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ambulances (Active)</span>
                  <span className="font-bold text-green-600">{ambulances.active} / {ambulances.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ambulances (Maintenance)</span>
                  <span className="font-bold text-orange-500">{ambulances.maintenance}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Referrals Tab ── */}
      {activeTab === "referrals" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Referrals" value={referrals.length} color="blue" icon={Activity} />
            <StatCard label="Accepted" value={accepted.length} color="green" icon={TrendingUp} />
            <StatCard label="Rejected" value={rejected.length} color="red" icon={TrendingDown} />
            <StatCard label="Pending" value={pending.length} color="orange" icon={Minus} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h4 className="font-semibold text-gray-800">Recent Referrals</h4>
            </div>
            <div className="divide-y divide-gray-50">
              {referrals.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-8">No referrals yet.</p>
              )}
              {referrals.slice(0, 10).map((r) => (
                <div key={r.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {r.direction === "outgoing" ? `→ ${r.toHospitalName}` : `← ${r.fromHospitalName}`}
                    </div>
                    <div className="text-xs text-gray-400">
                      {r.direction} · {r.requiredSpecialist || "General"}
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      r.status === "accepted"
                        ? "bg-green-100 text-green-700"
                        : r.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Blood Tab ── */}
      {activeTab === "blood" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(bloodBank).map(([group, units]) => {
              const status = units === 0 ? "Critical" : units < 15 ? "Low" : units < 30 ? "Moderate" : "Good";
              const colors = {
                Critical: "border-red-400 bg-red-50 text-red-700",
                Low: "border-orange-400 bg-orange-50 text-orange-700",
                Moderate: "border-yellow-400 bg-yellow-50 text-yellow-700",
                Good: "border-green-400 bg-green-50 text-green-700",
              };
              return (
                <div key={group} className={`rounded-xl border-2 p-4 text-center ${colors[status]}`}>
                  <div className="text-2xl font-black">{group}</div>
                  <div className="text-4xl font-bold my-2">{units}</div>
                  <div className="text-xs font-semibold uppercase">{status}</div>
                  <div className="mt-2 text-xs opacity-70">units available</div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h4 className="font-semibold text-gray-800 mb-4">Blood Bank Summary</h4>
            <MiniBarChart data={bloodChartData} color="#ef4444" height={100} />
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {bloodChartData.map((d) => (
                <div key={d.label} className="text-center min-w-[40px]">
                  <div className="text-xs font-bold text-gray-700">{d.value}</div>
                  <div className="text-xs text-gray-400">{d.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
