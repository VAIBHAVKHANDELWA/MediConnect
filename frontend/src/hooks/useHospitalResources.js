import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const defaultData = {
  beds: { total: 0, occupied: 0 },
  icuBeds: { total: 0, occupied: 0 },
  ventilators: { total: 0, occupied: 0 },
  oxygenCylinders: { available: 0 },
  ambulances: { total: 0, active: 0, maintenance: 0 },
  bloodBank: {
    "O+": 0, "O-": 0,
    "A+": 0, "A-": 0,
    "B+": 0, "B-": 0,
    "AB+": 0, "AB-": 0,
  }
};

export default function useHospitalResources(hospitalId) {
  const [resources, setResources] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hospitalId) {
      console.log("hospitalId is missing!");
      return;
    }

    const ref = doc(db, "hospitals", hospitalId, "resources", "resourceInfo");

    const load = async () => {
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        await setDoc(ref, defaultData, { merge: true });
        setResources(defaultData);
      } else {
        setResources(snap.data());
      }

      setLoading(false);
    };

    load();

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setResources(snap.data());
      }
    });

    return () => unsub();
  }, [hospitalId]); 

  return { resources, loading };
}