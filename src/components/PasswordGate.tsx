"use client";

import React from "react";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface PasswordGateProps {
  onUnlock: () => void;
}

const PasswordGate: React.FC<PasswordGateProps> = ({ onUnlock }) => {
  const [appPassword, setAppPassword] = React.useState<string>("password");
  const [enteredPassword, setEnteredPassword] = React.useState<string>("");
  const [loading, setLoading] = React.useState<boolean>(true);
  const [submitting, setSubmitting] = React.useState<boolean>(false);

  React.useEffect(() => {
    const fetchPassword = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching app settings:", error);
        showError("Failed to load app settings.");
      }

      const passwordFromSettings = data?.settings_data?.app_password;
      setAppPassword(passwordFromSettings ? String(passwordFromSettings) : "password");
      setLoading(false);
    };

    fetchPassword();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setSubmitting(true);
    const trimmed = enteredPassword.trim();
    if (trimmed === appPassword) {
      showSuccess("Unlocked");
      onUnlock();
    } else {
      showError("Incorrect password.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Enter App Password</CardTitle>
          <CardDescription>
            This password protects your journal. You must enter it to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="app-password">Password</Label>
              <Input
                id="app-password"
                type="password"
                placeholder="Enter password"
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                disabled={loading || submitting}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading || submitting || enteredPassword.trim() === ""}
            >
              {submitting ? "Unlocking..." : "Unlock"}
            </Button>
            {!loading && appPassword === "password" && (
              <p className="text-xs text-muted-foreground mt-2">
                Tip: You can change this password in Settings.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordGate;