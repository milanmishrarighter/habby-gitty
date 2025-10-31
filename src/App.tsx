import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import DailyEntries from "./pages/DailyEntries";
import RecordedEntries from "./pages/RecordedEntries";
import Fines from "./pages/Fines";
import HabitSetup from "./pages/HabitSetup";
import YearlyAnalytics from "./pages/YearlyAnalytics";
import Settings from "./pages/Settings"; // Import the new Settings page
import NotFound from "./pages/NotFound";
import { Toaster as Sonner } from "@/components/ui/sonner";
import SupabaseConnectionStatus from "@/components/SupabaseConnectionStatus";
import VersionDisplay from "@/components/VersionDisplay";

const App = () => {
  const [activeTab, setActiveTab] = React.useState("daily");

  return (
    <div className="flex flex-col items-center relative">
      <VersionDisplay version="1.2.0" />
      <Sonner />
      <div className="w-full max-w-4xl p-4 sm:p-6 lg:p-8 bg-white shadow-xl rounded-2xl my-8">
        <SupabaseConnectionStatus />

        <header className="text-center mb-6">
          <h1 className="text-4xl font-extrabold text-gray-800 tracking-tight">Daily Journal and Tracker</h1>
          <p className="text-md text-gray-500 mt-2">Your hub for habits, notes, and progress.</p>
        </header>

        <nav className="flex flex-wrap justify-center mb-6 border-b border-gray-200">
          <button
            data-tab="daily"
            className={`tab-button px-4 py-2 text-sm sm:text-base font-medium rounded-t-lg transition-all duration-300 ease-in-out ${
              activeTab === "daily" ? "text-blue-600 border-blue-500 active" : "text-gray-700 bg-white border-b-2 border-transparent hover:border-blue-500"
            }`}
            onClick={() => setActiveTab("daily")}
          >
            Daily Entries
          </button>
          <button
            data-tab="recorded"
            className={`tab-button px-4 py-2 text-sm sm:text-base font-medium rounded-t-lg transition-all duration-300 ease-in-out ${
              activeTab === "recorded" ? "text-blue-600 border-blue-500 active" : "text-gray-700 bg-white border-b-2 border-transparent hover:border-blue-500"
            }`}
            onClick={() => setActiveTab("recorded")}
          >
            Recorded Entries
          </button>
          <button
            data-tab="fines"
            className={`tab-button px-4 py-2 text-sm sm:text-base font-medium rounded-t-lg transition-all duration-300 ease-in-out ${
              activeTab === "fines" ? "text-blue-600 border-blue-500 active" : "text-gray-700 bg-white border-b-2 border-transparent hover:border-blue-500"
            }`}
            onClick={() => setActiveTab("fines")}
          >
            Fines
          </button>
          <button
            data-tab="setup"
            className={`tab-button px-4 py-2 text-sm sm:text-base font-medium rounded-t-lg transition-all duration-300 ease-in-out ${
              activeTab === "setup" ? "text-blue-600 border-blue-500 active" : "text-gray-700 bg-white border-b-2 border-transparent hover:border-blue-500"
            }`}
            onClick={() => setActiveTab("setup")}
          >
            Habit Setup
          </button>
          <button
            data-tab="yearly-analytics"
            className={`tab-button px-4 py-2 text-sm sm:text-base font-medium rounded-t-lg transition-all duration-300 ease-in-out ${
              activeTab === "yearly-analytics" ? "text-blue-600 border-blue-500 active" : "text-gray-700 bg-white border-b-2 border-transparent hover:border-blue-500"
            }`}
            onClick={() => setActiveTab("yearly-analytics")}
          >
            Yearly Analytics
          </button>
          <button
            data-tab="settings"
            className={`tab-button px-4 py-2 text-sm sm:text-base font-medium rounded-t-lg transition-all duration-300 ease-in-out ${
              activeTab === "settings" ? "text-blue-600 border-blue-500 active" : "text-gray-700 bg-white border-b-2 border-transparent hover:border-blue-500"
            }`}
            onClick={() => setActiveTab("settings")}
          >
            Settings
          </button>
        </nav>

        {activeTab === "daily" && <DailyEntries setActiveTab={setActiveTab} />}
        {activeTab === "recorded" && <RecordedEntries />}
        {activeTab === "fines" && <Fines />}
        {activeTab === "setup" && <HabitSetup />}
        {activeTab === "yearly-analytics" && <YearlyAnalytics />}
        {activeTab === "settings" && <Settings />}
      </div>
    </div>
  );
};

export default App;