import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, MapPin, Phone, Mail, Navigation, SortAsc, Loader } from "lucide-react";

import { db } from "../firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ─── Haversine distance (km) ───────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Geocode a location string via OpenStreetMap Nominatim ───────────────────
async function geocodeLocation(location) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch {
    // silent
  }
  return null;
}

function ResourceCard({ label, value, total }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg text-center">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">of {total || 0}</div>
    </div>
  );
}

function DistanceBadge({ km }) {
  if (km === null || km === undefined) return null;
  const color =
    km < 10 ? "bg-green-100 text-green-700" :
    km < 30 ? "bg-blue-100 text-blue-700" :
    km < 100 ? "bg-orange-100 text-orange-700" :
    "bg-gray-100 text-gray-600";

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      <Navigation className="w-3 h-3" />
      {km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)} km`}
    </span>
  );
}

export default function HospitalNetworkWithDistance({ hospitalId }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterResource, setFilterResource] = useState("all");
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCoords, setUserCoords] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle"); // idle | loading | success | error | manual
  const [manualLocation, setManualLocation] = useState("");
  const [sortByDistance, setSortByDistance] = useState(false);
  const [geocodingHospitals, setGeocodingHospitals] = useState(false);

  const navigate = useNavigate();

  // ── Fetch all hospitals ────────────────────────────────────────────────────
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const col = await getDocs(collection(db, "hospitals"));
        const list = [];

        for (const hospitalDoc of col.docs) {
          const otherId = hospitalDoc.id;
          if (otherId === hospitalId) continue;

          const hData = hospitalDoc.data();
          const resolvedName =
            hData.name || hData.hospitalName || hData.HospitalName || hData.Name || "Unnamed Hospital";

          const resourceRef = doc(db, "hospitals", otherId, "resources", "resourceInfo");
          const resourceSnap = await getDoc(resourceRef);

          const defaultResources = {
            beds: { total: 0, occupied: 0 },
            icuBeds: { total: 0, occupied: 0 },
            ventilators: { total: 0, occupied: 0 },
            oxygenCylinders: { available: 0 },
            ambulances: { total: 0, active: 0, maintenance: 0 },
            bloodBank: {},
          };

          const resources = resourceSnap.exists()
            ? { ...defaultResources, ...resourceSnap.data() }
            : defaultResources;

          // Compute locked adjustments
          const locks = resources.locks || {};

          list.push({
            id: otherId,
            name: resolvedName,
            location: hData.location || "",
            contact: hData.contact || "N/A",
            email: hData.email || "N/A",
            resources,
            locks,
            coords: null, // will geocode lazily
          });
        }

        setHospitals(list);
      } catch (err) {
        console.error("Error loading hospitals:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHospitals();
  }, [hospitalId]);

  // ── Browser geolocation ────────────────────────────────────────────────────
  const requestBrowserLocation = useCallback(() => {
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationStatus("success");
        setSortByDistance(true);
      },
      () => {
        setLocationStatus("error");
      },
      { timeout: 8000 }
    );
  }, []);

  // ── Manual geocode ──────────────────────────────────────────────────────────
  const handleManualGeocode = async () => {
    if (!manualLocation.trim()) return;
    setLocationStatus("loading");
    const coords = await geocodeLocation(manualLocation);
    if (coords) {
      setUserCoords(coords);
      setLocationStatus("success");
      setSortByDistance(true);
    } else {
      setLocationStatus("error");
    }
  };

  // ── Geocode hospital locations on demand ───────────────────────────────────
  const geocodeHospitals = useCallback(async () => {
    setGeocodingHospitals(true);
    const updated = await Promise.all(
      hospitals.map(async (h) => {
        if (h.coords || !h.location) return h;
        const coords = await geocodeLocation(h.location);
        return { ...h, coords };
      })
    );
    setHospitals(updated);
    setGeocodingHospitals(false);
  }, [hospitals]);

  useEffect(() => {
    if (sortByDistance && userCoords && hospitals.some((h) => !h.coords)) {
      geocodeHospitals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortByDistance, userCoords]);

  // ── Compute distance for each hospital ────────────────────────────────────
  const hospitalsWithDistance = hospitals.map((h) => ({
    ...h,
    distanceKm:
      userCoords && h.coords
        ? haversineKm(userCoords.lat, userCoords.lon, h.coords.lat, h.coords.lon)
        : null,
  }));

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = hospitalsWithDistance.filter((hospital) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      hospital.name?.toLowerCase().includes(term) ||
      hospital.location?.toLowerCase().includes(term);

    const r = hospital.resources;
    const locks = hospital.locks || {};

    // Locked oxygen check
    const oxyBase =
      typeof r.oxygenCylinders === "number"
        ? r.oxygenCylinders
        : r.oxygenCylinders?.available || 0;
    const oxyLocked = locks.oxygenCylinders?.enabled ? locks.oxygenCylinders.locked : 0;
    const oxyFree = Math.max(0, oxyBase - oxyLocked);

    const bedsAvailable = (r.beds.total || 0) - (r.beds.occupied || 0);
    const icuAvailable = (r.icuBeds.total || 0) - (r.icuBeds.occupied || 0);
    const ventAvailable = (r.ventilators.total || 0) - (r.ventilators.occupied || 0);
    const ambAvailable = (r.ambulances.total || 0) - (r.ambulances.maintenance || 0);

    const matchesFilter =
      filterResource === "all" ||
      (filterResource === "beds" && bedsAvailable > 0) ||
      (filterResource === "icu" && icuAvailable > 0) ||
      (filterResource === "ventilators" && ventAvailable > 0) ||
      (filterResource === "oxygen" && oxyFree > 0) ||
      (filterResource === "ambulances" && ambAvailable > 0);

    return matchesSearch && matchesFilter;
  });

  // ── Sort ───────────────────────────────────────────────────────────────────
  const sorted = sortByDistance
    ? [...filtered].sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null) return 0;
        if (a.distanceKm === null) return 1;
        if (b.distanceKm === null) return -1;
        return a.distanceKm - b.distanceKm;
      })
    : filtered;

  if (loading) {
    return (
      <div className="text-center py-10 text-gray-400 text-lg">
        Loading hospital data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Hospital Network</h1>
      <p className="text-gray-600">View and refer patients to nearby hospitals</p>

      {/* ── Location & Sort Controls ── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-col gap-4">
            {/* Location detection row */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-blue-600" />
                Your Location:
              </span>

              {locationStatus === "success" && (
                <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                  ✓ Location set
                </span>
              )}
              {locationStatus === "loading" && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Loader className="w-3 h-3 animate-spin" /> Detecting...
                </span>
              )}
              {locationStatus === "error" && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                  Location failed — try manual entry below
                </span>
              )}

              <button
                onClick={requestBrowserLocation}
                disabled={locationStatus === "loading"}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Navigation className="w-3 h-3" />
                Use My Location
              </button>

              <span className="text-xs text-gray-400">or</span>

              <div className="flex gap-2 flex-1 min-w-[200px]">
                <input
                  type="text"
                  placeholder="Enter city / address..."
                  value={manualLocation}
                  onChange={(e) => setManualLocation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualGeocode()}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
                />
                <button
                  onClick={handleManualGeocode}
                  className="px-3 py-1.5 bg-gray-700 text-white rounded-lg text-xs font-medium hover:bg-gray-800"
                >
                  Go
                </button>
              </div>
            </div>

            {/* Sort toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortByDistance((v) => !v)}
                disabled={!userCoords}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  sortByDistance
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                } disabled:opacity-40`}
              >
                <SortAsc className="w-4 h-4" />
                Sort by Distance
              </button>

              {geocodingHospitals && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Loader className="w-3 h-3 animate-spin" /> Geocoding hospitals...
                </span>
              )}
            </div>

            {/* Search + filter row */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Search hospital or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                value={filterResource}
                onChange={(e) => setFilterResource(e.target.value)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                <option value="all">All Resources</option>
                <option value="beds">Available Beds</option>
                <option value="icu">ICU Beds</option>
                <option value="ventilators">Ventilators</option>
                <option value="oxygen">Oxygen Cylinders</option>
                <option value="ambulances">Ambulances</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Hospital List ── */}
      <div className="grid grid-cols-1 gap-4">
        {sorted.length === 0 && (
          <p className="text-center text-gray-400 py-10">No hospitals found matching your criteria.</p>
        )}

        {sorted.map((hospital, idx) => {
          const r = hospital.resources;
          const locks = hospital.locks || {};

          const oxyBase =
            typeof r.oxygenCylinders === "number"
              ? r.oxygenCylinders
              : r.oxygenCylinders?.available || 0;
          const oxyLocked = locks.oxygenCylinders?.enabled ? locks.oxygenCylinders.locked : 0;
          const oxyFree = Math.max(0, oxyBase - oxyLocked);

          const bedsAvailable = (r.beds.total || 0) - (r.beds.occupied || 0);
          const icuAvailable = (r.icuBeds.total || 0) - (r.icuBeds.occupied || 0);
          const ventAvailable = (r.ventilators.total || 0) - (r.ventilators.occupied || 0);
          const ambAvailable = (r.ambulances.total || 0) - (r.ambulances.maintenance || 0);

          return (
            <Card key={hospital.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Info */}
                  <div>
                    <div className="flex items-start gap-2 flex-wrap mb-1">
                      <h3 className="text-lg font-bold">{hospital.name}</h3>
                      {sortByDistance && (
                        <DistanceBadge km={hospital.distanceKm} />
                      )}
                      {sortByDistance && idx === 0 && hospital.distanceKm !== null && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-semibold">
                          Nearest
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 mt-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        {hospital.location || "No location"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        {hospital.contact}
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        {hospital.email}
                      </div>
                    </div>
                  </div>

                  {/* Resources */}
                  <div className="grid grid-cols-3 gap-3">
                    <ResourceCard label="Beds" value={bedsAvailable} total={r.beds.total} />
                    <ResourceCard label="ICU" value={icuAvailable} total={r.icuBeds.total} />
                    <ResourceCard label="Ventilators" value={ventAvailable} total={r.ventilators.total} />
                    <ResourceCard label="Oxygen" value={oxyFree} total={oxyBase} />
                    <ResourceCard label="Ambulances" value={ambAvailable} total={r.ambulances.total} />

                    {bloodGroups.map((group) => {
                      const raw = r.bloodBank[group] || 0;
                      const bLock = locks[`blood_${group}`];
                      const bFree = bLock?.enabled ? Math.max(0, raw - bLock.locked) : raw;
                      return (
                        <ResourceCard key={group} label={`Blood ${group}`} value={bFree} total={raw} />
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col justify-center gap-2">
                    <Button
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => navigate(`/refer-patient/${hospital.id}`)}
                    >
                      Refer Patient
                    </Button>
                    {hospital.distanceKm !== null && sortByDistance && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${hospital.coords?.lat},${hospital.coords?.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-all"
                      >
                        <Navigation className="w-4 h-4" />
                        Get Directions
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
