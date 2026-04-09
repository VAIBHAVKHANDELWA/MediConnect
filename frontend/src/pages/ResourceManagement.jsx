import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Plus, Minus } from "lucide-react";

/* ------------------ DEFAULT DATA (outside component) ------------------ */
const defaultResources = {
  beds: { total: 0, occupied: 0 },
  icuBeds: { total: 0, occupied: 0 },
  ventilators: { total: 0, occupied: 0 },
  oxygenCylinders: { available: 0 },
  ambulances: { total: 0, active: 0, maintenance: 0 },
};

const defaultBloodBank = {
  "O+": 0, "O-": 0,
  "A+": 0, "A-": 0,
  "B+": 0, "B-": 0,
  "AB+": 0, "AB-": 0,
};

/* ------------------ Counter Component ------------------ */
const Counter = ({ label, value, onChange }) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{label}</label>

      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        className="w-full"
        min={0}
      />

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex-1"
        >
          <Minus className="w-4 h-4" />
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => onChange(Math.max(0, value + 1))}
          className="flex-1"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default function ResourceManagement({ hospitalId }) {
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState(defaultResources);
  const [bloodBank, setBloodBank] = useState(defaultBloodBank);

  /* ---------------- Load Data ---------------- */
  useEffect(() => {
    if (!hospitalId) return;

    const fetchData = async () => {
      try {
        const ref = doc(db, "hospitals", hospitalId, "resources", "resourceInfo");
        const snapshot = await getDoc(ref);

        if (snapshot.exists()) {
          const data = snapshot.data();

          setResources({
            beds: data.beds ?? defaultResources.beds,
            icuBeds: data.icuBeds ?? defaultResources.icuBeds,
            ventilators: data.ventilators ?? defaultResources.ventilators,
            oxygenCylinders: data.oxygenCylinders ?? defaultResources.oxygenCylinders,
            ambulances: data.ambulances ?? defaultResources.ambulances,
          });

          setBloodBank(data.bloodBank ?? defaultBloodBank);
        } else {
          await setDoc(ref, {
            ...defaultResources,
            bloodBank: defaultBloodBank,
          });
        }
      } catch (error) {
        console.error("Error fetching resources:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [hospitalId]);

  /* ---------------- Save to Firestore ---------------- */
  const saveToFirestore = async (path, value) => {
    try {
      const ref = doc(db, "hospitals", hospitalId, "resources", "resourceInfo");
      await updateDoc(ref, { [path]: Math.max(0, value) });
    } catch (error) {
      console.error("Error updating resource:", error);
    }
  };

  const updateResource = (section, field, value) => {
    const fixed = Math.max(0, value);

    const updated = {
      ...resources,
      [section]: { ...resources[section], [field]: fixed },
    };

    setResources(updated);
    saveToFirestore(`${section}.${field}`, fixed);
  };

  const updateBlood = (group, value) => {
    const fixed = Math.max(0, value);

    const updated = {
      ...bloodBank,
      [group]: fixed,
    };

    setBloodBank(updated);
    saveToFirestore(`bloodBank.${group}`, fixed);
  };

  const calculateAvailable = (total, used) => Math.max(0, total - used);

  if (loading) {
    return <div className="text-lg font-semibold">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Resource Management</h1>

      {/* -------- Beds -------- */}
      <Card>
        <CardHeader>
          <CardTitle>Bed Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <Counter
              label="Total Beds"
              value={resources.beds.total}
              onChange={(v) => updateResource("beds", "total", v)}
            />
            <Counter
              label="Occupied Beds"
              value={resources.beds.occupied}
              onChange={(v) => updateResource("beds", "occupied", v)}
            />
            <div className="flex flex-col justify-end">
              <label className="text-sm">Available</label>
              <div className="text-3xl font-bold text-green-600">
                {calculateAvailable(resources.beds.total, resources.beds.occupied)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* -------- ICU & Ventilators -------- */}
      <Card>
        <CardHeader>
          <CardTitle>ICU Beds & Ventilators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">

            {/* ICU */}
            <div className="space-y-4">
              <h3 className="font-semibold">ICU Beds</h3>
              <Counter
                label="Total ICU Beds"
                value={resources.icuBeds.total}
                onChange={(v) => updateResource("icuBeds", "total", v)}
              />
              <Counter
                label="Occupied ICU Beds"
                value={resources.icuBeds.occupied}
                onChange={(v) => updateResource("icuBeds", "occupied", v)}
              />
              <div>
                <label className="text-sm">Available</label>
                <div className="text-2xl font-bold text-green-600">
                  {calculateAvailable(resources.icuBeds.total, resources.icuBeds.occupied)}
                </div>
              </div>
            </div>

            {/* Ventilators */}
            <div className="space-y-4">
              <h3 className="font-semibold">Ventilators</h3>
              <Counter
                label="Total Ventilators"
                value={resources.ventilators.total}
                onChange={(v) => updateResource("ventilators", "total", v)}
              />
              <Counter
                label="Occupied Ventilators"
                value={resources.ventilators.occupied}
                onChange={(v) => updateResource("ventilators", "occupied", v)}
              />
              <div>
                <label className="text-sm">Available</label>
                <div className="text-2xl font-bold text-green-600">
                  {calculateAvailable(resources.ventilators.total, resources.ventilators.occupied)}
                </div>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* -------- Oxygen -------- */}
      <Card>
        <CardHeader>
          <CardTitle>Oxygen Cylinders</CardTitle>
        </CardHeader>
        <CardContent>
          <Counter
            label="Available Oxygen Cylinders"
            value={resources.oxygenCylinders.available}
            onChange={(v) => updateResource("oxygenCylinders", "available", v)}
          />
        </CardContent>
      </Card>

      {/* -------- Ambulances -------- */}
      <Card>
        <CardHeader>
          <CardTitle>Ambulances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            <Counter
              label="Total Ambulances"
              value={resources.ambulances.total}
              onChange={(v) => updateResource("ambulances", "total", v)}
            />
            <Counter
              label="Active"
              value={resources.ambulances.active}
              onChange={(v) => updateResource("ambulances", "active", v)}
            />
            <Counter
              label="Under Maintenance"
              value={resources.ambulances.maintenance}
              onChange={(v) => updateResource("ambulances", "maintenance", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* -------- Blood Bank -------- */}
      <Card>
        <CardHeader>
          <CardTitle>Blood Bank</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(bloodBank).map(([group, units]) => (
              <div key={group} className="p-4 bg-gray-50 rounded-lg border">
                <div className="text-lg font-bold text-blue-600 mb-2">{group}</div>
                <div className="text-3xl font-bold">{units}</div>

                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => updateBlood(group, units - 1)}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => updateBlood(group, units + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}