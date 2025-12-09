"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppSettings } from "@/types/appSettings";

const Settings: React.FC = () => {
  const [yearlyWeekOffsAllowed, setYearlyWeekOffsAllowed] = React.useState<number | "">(0);
  const [yearlyNothingsAllowed, setYearlyNothingsAllowed] = React.useState<number | "">(0); // New state
  const [settingsId, setSettingsId] = React.useState<string | null>(null);
  const [allSettingsData, setAllSettingsData] = React.useState<Record<string, any>>({}); // To hold all settings from JSONB
  const [isLoading, setIsLoading] = React.useState(true);
  const [appPassword, setAppPassword] = React.useState<string>("password"); // App password state

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
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, []);

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
    </div>
  );
};

export default Settings;