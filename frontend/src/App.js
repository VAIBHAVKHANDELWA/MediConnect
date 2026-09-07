// App.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import HospitalRegistration from "./pages/HospitalRegistration";

import HospitalNetwork from "./pages/HospitalNetwork";
import SendReferral from "./pages/SendReferral";
import ReferralDetails from "./pages/ReferralDetails";
import ReferralNotifications from "./pages/ReferralNotifications";
import ResourceManagement from "./pages/ResourceManagement";

import AnalyticsDashboard from "./pages/AnalyticsDashboard";
import BloodExpiryTracking from "./pages/BloodExpiryTracking";
import DashboardOverview from "./pages/DashboardOverview";
import HelpSupport1 from "./pages/HelpSupport1";
import HospitalNetworkWithDistance from "./pages/HospitalNetworkWithDistance";
import InspectionTracking from "./pages/InspectionTracking";
import NotificationCenter from "./pages/NotificationCenter";
import PartialResourceLocking from "./pages/PartialResourceLocking";
import ProfileSetting from "./pages/ProfileSetting";
import SmartAlertSystem from "./pages/SmartAlertSystem";

function App() {
  return (
    <>
      <Toaster position="top-center" reverseOrder={false} />

      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Dashboard */}
        <Route path="/dashboard/:hospitalId" element={<Dashboard />} />

        {/* Registration */}
        <Route path="/HospitalRegistration" element={<HospitalRegistration />} />

        {/* Network */}
        <Route path="/hospital-network" element={<HospitalNetwork />} />

        {/* Send Referral */}
        <Route path="/refer-patient/:hospitalId" element={<SendReferral />} />

        {/* Referral Details */}
        <Route
          path="/dashboard/:hospitalId/referrals/:referralId"
          element={<ReferralDetails />}
        />

        {/* Notification list */}
        <Route
          path="/referral-notifications"
          element={<ReferralNotifications />}
        />

        {/* Resources & Analytics */}
        <Route
          path="/resource-management/:hospitalId"
          element={<ResourceManagement />}
        />
         {/* Additional Pages */}
      <Route path="/analytics-dashboard" element={<AnalyticsDashboard />} />
<Route path="/blood-expiry-tracking" element={<BloodExpiryTracking />} />
<Route path="/dashboard-overview" element={<DashboardOverview />} />
<Route path="/help-support" element={<HelpSupport1 />} />
<Route path="/hospital-network-distance" element={<HospitalNetworkWithDistance />} />
<Route path="/inspection-tracking" element={<InspectionTracking />} />
<Route path="/notification-center" element={<NotificationCenter />} />
<Route path="/partial-resource-locking" element={<PartialResourceLocking />} />
<Route path="/profile-setting" element={<ProfileSetting />} />
<Route path="/smart-alert-system" element={<SmartAlertSystem />} />

        {/* GLOBAL CATCH-ALL ROUTE */}
        <Route
          path="*"
          element={
            localStorage.getItem("hospitalID") ? (
              <Navigate
                to={`/dashboard/${localStorage.getItem("hospitalID")}`}
                replace
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </>
  );
}   

export default App;
