"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSettings } from "@/types/appSettings";
import { CalorieSettings, EMPTY_CALORIE_SETTINGS } from "@/types/health";
import { readCalorieSettings } from "@/utils/healthUtils";

const Settings: React.FC = () => {
  const [yearlyWeekOffsAllowed, setYearlyWeekOffsAllowed] = React.useState<number | "">(0);
  const [yearlyNothingsAllowed, setYearlyNothingsAllowed] = React.useState<number | "">(0); // New state
  const [settingsId, setSettingsId] = React.useState<string | null>(null);
  const [allSettingsData, setAllSettingsData] = React.useState<Record<string, any>>({}); // To hold all settings from JSONB
  const [isLoading, setIsLoading] = React.useState(true);
  const [appPassword, setAppPassword] = React.useState<string>("password"); // App password state
  const [accountabilityEmails, setAccountabilityEmails] = React.useState<string[]>([]);
  const [emailInput, setEmailInput] = React.useState("");
  const [calorieSettings, setCalorieSettings] = React.useState<CalorieSettings>(EMPTY_CALORIE_SETTINGS);

  React.useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means "no rows found"
        console.error("Error fetching app settings:", error);
        showError("Failed to load app settings.");
      } else if (data) {
        setSettingsId(data.id);
        setAllSettingsData(data.settings_data || {});
        setYearlyWeekOffsAllowed(data.settings_data?.yearly_week_offs_allowed || 0);
        setYearlyNothingsAllowed(data.settings_data?.yearly_nothings_allowed || 0); // Set new field
        setAppPassword(data.settings_data?.app_password ? String(data.settings_data.app_password) : "password"); // Load app password
        setAccountabilityEmails(
          Array.isArray(data.settings_data?.accountability_emails) ? data.settings_data.accountability_emails : []
        );
        setCalorieSettings(readCalorieSettings(data.settings_data));
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, []);

  const handleAddEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError("Please enter a valid email address.");
      return;
    }
    if (accountabilityEmails.includes(email)) {
      showError("That email has already been added.");
      return;
    }
    setAccountabilityEmails(prev => [...prev, email]);
    setEmailInput("");
  };

  const handleEmailKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddEmail();
    }
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setAccountabilityEmails(prev => prev.filter(e => e !== emailToRemove));
  };

  const handleSaveSettings = async () => {
    if (typeof yearlyWeekOffsAllowed !== 'number' || yearlyWeekOffsAllowed < 0) {
      showError("Please enter a valid positive number for Yearly Week Offs Allowed.");
      return;
    }
    if (typeof yearlyNothingsAllowed !== 'number' || yearlyNothingsAllowed < 0) { // New validation
      showError("Please enter a valid positive number for Yearly Nothings Allowed.");
      return;
    }

    setIsLoading(true);

    const updatedSettingsData = {
      ...allSettingsData, // Keep existing settings
      yearly_week_offs_allowed: yearlyWeekOffsAllowed,
      yearly_nothings_allowed: yearlyNothingsAllowed, // Save new field
      app_password: appPassword, // Save app password
      accountability_emails: accountabilityEmails,
      target_calories: calorieSettings.target,
      maintaining_calories: calorieSettings.maintaining,
      cheat_day_calories: calorieSettings.cheatDay,
      over_eating_calories: calorieSettings.overEating,
    };

    let error = null;
    if (settingsId) {
      // Update existing settings
      const { error: updateError } = await supabase
        .from('app_settings')
        .update({ settings_data: updatedSettingsData })
        .eq('id', settingsId);
      error = updateError;
    } else {
      // Insert new settings (first time)
      const { data, error: insertError } = await supabase
        .from('app_settings')
        .insert([{ settings_data: updatedSettingsData }])
        .select();
      error = insertError;
      if (data && data.length > 0) {
        setSettingsId(data[0].id);
      }
    }

    if (error) {
      console.error("Error saving app settings:", error); // Log the full error object
      showError("Failed to save settings.");
    } else {
      setAllSettingsData(updatedSettingsData); // Update local state with new merged data
      showSuccess("Settings saved successfully!");
    }
    setIsLoading(false);
  };

  return (
    <div id="settings" className="tab-content text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">App Settings</h2>
      <p className="text-gray-600 mb-6">Configure universal settings for your application.</p>

      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Yearly Week Offs</CardTitle>
        </CardHeader>
        <CardContent className="text-left">
          <div className="mb-4">
            <Label htmlFor="yearly-week-offs" className="block text-sm font-medium text-gray-700 mb-1">
              Yearly Week Offs Allowed
            </Label>
            <Input
              type="number"
              id="yearly-week-offs"
              placeholder="e.g., 5"
              value={yearlyWeekOffsAllowed}
              onChange={(e) => setYearlyWeekOffsAllowed(e.target.value === "" ? "" : Number(e.target.value))}
              min="0"
              className="w-full"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of weeks you can take off from tracking habits without penalty.
            </p>
          </div>
          <div className="mb-4"> {/* New input field */}
            <Label htmlFor="yearly-nothings-allowed" className="block text-sm font-medium text-gray-700 mb-1">
              Yearly "Nothings" Allowed (for new learning)
            </Label>
            <Input
              type="number"
              id="yearly-nothings-allowed"
              placeholder="e.g., 10"
              value={yearlyNothingsAllowed}
              onChange={(e) => setYearlyNothingsAllowed(e.target.value === "" ? "" : Number(e.target.value))}
              min="0"
              className="w-full"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of times you can record "nothing" for "What's something new you learned today" per year.
            </p>
          </div>
          <div className="mb-4">
            <Label htmlFor="app-password-setting" className="block text-sm font-medium text-gray-700 mb-1">
              App Password
            </Label>
            <Input
              type="password"
              id="app-password-setting"
              placeholder="Set a password (default is 'password')"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
              className="w-full"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              This password is required to unlock the app after login.
            </p>
          </div>
          <Button onClick={handleSaveSettings} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      <Card className="w-full max-w-md mx-auto mt-6">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Calorie Levels</CardTitle>
        </CardHeader>
        <CardContent className="text-left">
          {([
            ["target", "Target Calories", "At or under this earns ₹50 for the day. Allowed 4 days a week."],
            ["maintaining", "Maintaining Calories", "Allowed twice a week on non-cheat days."],
            ["cheatDay", "Cheat Day Calories", "The ceiling on a day marked as a cheat day."],
            ["overEating", "Over-eating Calories", "Anything above this counts as over-eating."],
          ] as const).map(([key, label, hint]) => (
            <div className="mb-4" key={key}>
              <Label htmlFor={`calories-${key}`} className="block text-sm font-medium text-gray-700 mb-1">
                {label}
              </Label>
              <Input
                type="number"
                id={`calories-${key}`}
                placeholder="e.g., 1800"
                value={calorieSettings[key] === 0 ? "" : calorieSettings[key]}
                onChange={(e) => setCalorieSettings(prev => ({
                  ...prev,
                  [key]: e.target.value === "" ? 0 : Number(e.target.value),
                }))}
                min="0"
                className="w-full"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">{hint}</p>
            </div>
          ))}
          <Button onClick={handleSaveSettings} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>

      <Card className="w-full max-w-md mx-auto mt-6">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Accountability Emails</CardTitle>
        </CardHeader>
        <CardContent className="text-left">
          <Label htmlFor="accountability-email" className="block text-sm font-medium text-gray-700 mb-1">
            Add an email address
          </Label>
          <div className="flex gap-2">
            <Input
              type="email"
              id="accountability-email"
              placeholder="friend@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={handleEmailKeyDown}
              className="w-full"
              disabled={isLoading}
            />
            <Button type="button" onClick={handleAddEmail} className="shrink-0" disabled={!emailInput.trim() || isLoading}>
              Add
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            These people can then be picked per habit to be emailed when a fine condition is met.
            Make sure they've agreed to receive these.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {accountabilityEmails.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No accountability emails added yet.</p>
            ) : (
              accountabilityEmails.map((email) => (
                <span key={email} className="bg-blue-200 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded-full flex items-center">
                  {email}
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    className="ml-2 text-blue-800 hover:text-blue-900 focus:outline-none"
                    aria-label={`Remove ${email}`}
                  >
                    &times;
                  </button>
                </span>
              ))
            )}
          </div>

          <Button onClick={handleSaveSettings} disabled={isLoading} className="mt-4">
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;