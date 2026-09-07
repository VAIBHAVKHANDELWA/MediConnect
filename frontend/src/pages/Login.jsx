import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  // AUTO REDIRECT IF ALREADY LOGGED IN
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        const savedHospitalId = localStorage.getItem("hospitalID");
        if (savedHospitalId) {
          navigate(`/dashboard/${savedHospitalId}`, { replace: true });
        }
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // LOGIN HANDLER
  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter valid credentials");
      return;
    }

    try {
  setLoading(true);

  // Step 1 — Apply persistence based on checkbox
  await setPersistence(
    auth,
    keepLoggedIn ? browserLocalPersistence : browserSessionPersistence
  );

  // Step 2 — Authenticate user with Firebase Auth
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const uid = userCredential.user.uid;

  // Step 3 — Look up this user's linked hospital by UID (set during Hospital Registration)
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists() || !userSnap.data().hospitalId) {
    alert("No hospital registered for this account yet. Please complete registration.");
    navigate("/HospitalRegistration");
    return;
  }

  // Step 4 — Fetch hospital ID
  const hospitalId = userSnap.data().hospitalId;
  localStorage.setItem("hospitalID", hospitalId);

  // Step 5 — Redirect to Dashboard
  navigate(`/dashboard/${hospitalId}`, { replace: true });

} catch (error) {
  if (error.code === "auth/invalid-credential") {
    alert("Incorrect password. Please try again.");
  } else {
    alert("Login error: " + error.message);
  }
} finally {
  setLoading(false);
}
  };

  // PASSWORD RESET
  const handleForgotPassword = async () => {
    const userEmail = prompt("Enter your registered email:");
    if (!userEmail) return;

    try {
      await sendPasswordResetEmail(auth, userEmail);
      alert("Password reset link sent! Check your email.");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-gray-900 font-[Poppins]">
  <div className="absolute inset-0 bg-black opacity-50"></div>

  <nav className="absolute top-0 left-0 w-full flex items-center justify-between p-6 bg-transparent z-10">
    <h1 className="text-2xl font-bold cursor-pointer">
      <span className="!text-blue-200">Medi</span>
      <span className="!text-blue-400">Connect</span>
    </h1>
  </nav>


      <div className="relative z-10 bg-gray-800 bg-opacity-90 p-10 rounded-2xl shadow-2xl w-96 text-center">
        <div className="text-5xl mb-6">⚕</div>
        <h2 className="text-2xl font-semibold mb-6">Hospital Login Portal</h2>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Hospital Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 rounded-md border border-gray-600 bg-gray-900 text-white"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-3 rounded-md border border-gray-600 bg-gray-900 text-white"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className={`mt-3 ${
              loading ? "bg-gray-600" : "bg-blue-600 hover:bg-blue-700"
            } transition-all text-white font-semibold py-3 rounded-md`}
          >
            {loading ? "Logging in..." : "Login to Portal"}
          </button>

          <div className="flex justify-between text-sm text-blue-300 mt-3">
            <button onClick={handleForgotPassword} className="hover:underline">
              Forgot Password?
            </button>

            <label className="flex items-center gap-2 cursor-pointer text-gray-300">
              <input
                type="checkbox"
                className="accent-blue-500"
                checked={keepLoggedIn}
                onChange={(e) => setKeepLoggedIn(e.target.checked)}
              />
              Keep me logged in
            </label>
          </div>
        </form>

        <div className="mt-6 text-sm text-gray-300">
          <button
            onClick={() => navigate("/signup")}
            className="block w-full text-blue-400 hover:underline"
          >
            Signup
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
