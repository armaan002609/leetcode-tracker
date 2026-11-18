"use client";

import { signIn, getSession } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Loader2, GraduationCap, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [loginMode, setLoginMode] = useState<"student" | "staff">("student");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      username: username.trim(),
      password: password.trim(),
      redirect: false,
    });

    if (res?.error) {
      setError(
        loginMode === "student"
          ? "Invalid Roll Number or Enrollment Number"
          : "Invalid username or password"
      );
      setLoading(false);
    } else {
      const updatedSession = await getSession();
      const role = (updatedSession?.user as any)?.role;
      if (role === "student") {
        router.push("/student");
      } else {
        router.push("/");
      }
      router.refresh();
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: '16px' }}>
      <div className="dashboard-card" style={{ maxWidth: '420px', width: '100%', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: 48, height: 48, background: 'var(--primary)', color: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            {loginMode === "student" ? <GraduationCap size={26} /> : <Lock size={24} />}
          </div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
            {loginMode === "student" ? "Student Portal Login" : "Admin / Mentor Login"}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 6 }}>
            {loginMode === "student"
              ? "Sign in with your Roll Number and Enrollment Number to check your LeetCode progress"
              : "Sign in to access the tracker dashboard"}
          </p>
        </div>

        {/* Mode Switcher */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginBottom: '22px' }}>
          <button
            type="button"
            onClick={() => {
              setLoginMode("student");
              setError("");
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: loginMode === "student" ? 'white' : 'transparent',
              color: loginMode === "student" ? 'var(--primary)' : 'var(--muted)',
              boxShadow: loginMode === "student" ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <GraduationCap size={15} /> Student
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("staff");
              setError("");
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 10px',
              borderRadius: '6px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: loginMode === "staff" ? 'white' : 'transparent',
              color: loginMode === "staff" ? 'var(--primary)' : 'var(--muted)',
              boxShadow: loginMode === "staff" ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <ShieldCheck size={15} /> Admin / Mentor
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
              {loginMode === "student" ? "Roll Number" : "Username"}
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={loginMode === "student" ? "e.g. 2401003013" : "username"}
                style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--background)' }}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
              {loginMode === "student" ? "Enrollment Number (Password)" : "Password"}
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={loginMode === "student" ? "e.g. 2420673" : "password"}
                style={{ width: '100%', padding: '10px 10px 10px 36px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--background)' }}
                required
              />
            </div>
          </div>

          {error && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', background: '#fef2f2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', marginTop: '6px' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Loader2 size={18} className="animate-spin" /> Signing in...
              </span>
            ) : (
              loginMode === "student" ? "Check My Progress" : "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
