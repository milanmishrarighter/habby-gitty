import React from "react";
import { supabase } from "../lib/supabase";

const LoginScreen: React.FC = () => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-7 safe-top safe-bottom">
      <div className="w-36 h-36 rounded-full bg-ink text-bg flex items-center justify-center mx-auto anim-pop">
        <span className="text-4xl font-light">L</span>
      </div>
      <h1 className="text-center mt-8 text-lg tracking-wide anim-fade-up">loser tracker</h1>
      <p className="text-center text-xs text-mute mt-2 anim-fade-up">Sign in with your Habby account</p>
      <div className="mt-10 space-y-3 anim-fade-up">
        <input className="field" type="email" autoComplete="email" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="field" type="password" autoComplete="current-password" placeholder="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && signIn()} />
        {error && <p className="text-sm text-over">{error}</p>}
        <button className="btn-ink w-full" onClick={signIn} disabled={busy || !email || !password}>{busy ? "Signing in…" : "Sign in"}</button>
      </div>
    </div>
  );
};

export default LoginScreen;
