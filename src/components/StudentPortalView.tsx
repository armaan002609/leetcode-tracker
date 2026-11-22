"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  GraduationCap,
  LogOut,
  CheckCircle2,
  Clock,
  ExternalLink,
  Award,
  Target,
  Flame,
  Search,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

import Link from "next/link";

interface StudentAssignmentItem {
  id: string;
  assignmentId: string;
  title: string;
  titleSlug: string;
  status: string;
  completedAt: string | null;
  assignedAt: string;
}

interface SubmissionItem {
  id: string;
  title: string;
  titleSlug: string;
  difficulty: string | null;
  timestamp: string;
}

interface StudentPortalData {
  linked: boolean;
  profile: {
    name: string;
    portalUsername: string;
    enrollmentNo: string;
    rosterRollNumber?: string;
    branch: string | null;
    semester: string | null;
    section: string | null;
    labBatch: string | null;
    mentor: string | null;
    url: string | null;
    email: string | null;
  };
  stats: {
    status: string;
    solvedToday: number;
    totalSolved: number;
    easySolved: number;
    mediumSolved: number;
    hardSolved: number;
    globalRank: number | null;
    badges: number;
    lastScrapedAt: string | null;
  } | null;
  assignments: StudentAssignmentItem[];
  submissions: SubmissionItem[];
}

export default function StudentPortalView({ isDemo = false }: { isDemo?: boolean }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<StudentPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const userRole = (session?.user as any)?.role as string | undefined;
  const userId = (session?.user as any)?.id as string | undefined;

  useEffect(() => {
    if (isDemo) return;
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated") {
      if (userRole !== "student") {
        router.replace("/");
      } else {
        fetchPortalData();
      }
    }
  }, [status, userRole, userId, router, isDemo]);

  useEffect(() => {
    if (isDemo) {
      fetchPortalData();
    }
  }, [isDemo]);

  const fetchPortalData = async () => {
    setLoading(true);
    setError("");

    try {
      const endpoint = isDemo ? "/api/demo/student/me" : "/api/student/me";
      const res = await fetch(endpoint);
      if (res.status === 401) {
        if (!isDemo) router.replace("/login");
        return;
      }
      const json = await res.json();
      if (res.status === 403 && json.locked) {
        setError(json.error || "Your student ID is currently locked by the admin.");
        setData(null);
      } else if (!res.ok) {
        setError(json.error || "Failed to load your progress.");
      } else {
        setData(json);
      }
    } catch (e: any) {
      setError(e.message || "Network error loading your progress.");
    } finally {
      setLoading(false);
    }
  };

  const assignments = data?.assignments || [];
  const totalAssigned = assignments.length;
  const completedCount = useMemo(
    () => assignments.filter((a) => a.status === "completed").length,
    [assignments]
  );
  const pendingCount = totalAssigned - completedCount;
  const completionPct = totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      if (statusFilter === "pending" && a.status !== "pending") return false;
      if (statusFilter === "completed" && a.status !== "completed") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = (a.title || "").toLowerCase().includes(q);
        const matchSlug = (a.titleSlug || "").toLowerCase().includes(q);
        if (!matchTitle && !matchSlug) return false;
      }
      return true;
    });
  }, [assignments, statusFilter, searchQuery]);

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date(iso));
    } catch {
      return "—";
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="enterprise-loader-wrapper">
        <div className="pulse-logo">L</div>
        <div className="loader-text">Loading Your Progress...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {isDemo && (
        <div style={{
          background: 'linear-gradient(90deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%)',
          color: '#ffffff',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.86rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              background: '#fef2f2',
              color: '#991b1b',
              fontWeight: 700,
              fontSize: '0.72rem',
              padding: '2px 8px',
              borderRadius: '9999px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Resume Showcase
            </span>
            <span style={{ fontWeight: 600 }}>Student Portal Preview Mode (Read-Only)</span>
            <span style={{ opacity: 0.9, fontSize: '0.82rem' }} className="hide-on-mobile">
              — Student progress, assigned questions, and submission timeline view.
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link
              href="/login"
              className="btn btn-sm"
              style={{
                background: '#ffffff',
                color: '#991b1b',
                fontWeight: 600,
                padding: '4px 12px',
                fontSize: '0.8rem',
                borderRadius: '6px',
                textDecoration: 'none'
              }}
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
      <nav className="topnav">
        <Link href={isDemo ? "/demo" : "/student"} className="topnav-brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="topnav-brand-icon">L</div>
          <span>LeetCode Student Portal</span>
        </Link>
        <div className="topnav-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {data?.profile && (
            <span className="hide-on-mobile" style={{ fontSize: "0.85rem", opacity: 0.95, fontWeight: 500 }}>
              {data.profile.name} ({data.profile.portalUsername})
            </span>
          )}
          {isDemo ? (
            <Link
              href="/demo"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--primary)",
                background: "white",
                textDecoration: "none",
              }}
            >
              ← Back to Dashboard
            </Link>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await signOut({ redirect: false });
                router.push("/login");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--primary)",
                background: "white",
                border: "none",
                cursor: "pointer",
              }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </nav>

      <main className="main-content">
        {error ? (
          <div className="dashboard-card" style={{ padding: "32px", textAlign: "center" }}>
            <AlertCircle size={32} style={{ color: "var(--danger)", margin: "0 auto 12px" }} />
            <div style={{ color: "var(--danger)", marginBottom: "16px", fontWeight: 600 }}>{error}</div>
            <button type="button" onClick={() => fetchPortalData()} className="btn btn-primary">
              Try Again
            </button>
          </div>
        ) : data ? (
          <>
            {/* Profile Hero */}
            <div className="dashboard-hero" style={{ flexWrap: "wrap" }}>
              <div className="hero-left">
                <div className="hero-pill-badge">
                  <GraduationCap size={14} />
                  <span>Student Progress Dashboard</span>
                </div>
                <h1 className="hero-heading">{data.profile.name}</h1>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px", fontSize: "0.84rem", color: "var(--muted)" }}>
                  <span>
                    <strong>Roll No:</strong> {data.profile.portalUsername}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>Enrollment No:</strong> {data.profile.enrollmentNo}
                  </span>
                  {data.profile.branch && (
                    <>
                      <span>•</span>
                      <span>
                        <strong>Stream:</strong> {data.profile.branch}
                      </span>
                    </>
                  )}
                  {data.profile.semester && (
                    <>
                      <span>•</span>
                      <span>
                        <strong>Sem:</strong> {data.profile.semester}
                      </span>
                    </>
                  )}
                  {data.profile.section && (
                    <>
                      <span>•</span>
                      <span>
                        <strong>Sec:</strong> {data.profile.section}
                      </span>
                    </>
                  )}
                  {data.profile.labBatch && (
                    <>
                      <span>•</span>
                      <span>
                        <strong>Lab:</strong> {data.profile.labBatch}
                      </span>
                    </>
                  )}
                  {data.profile.mentor && (
                    <>
                      <span>•</span>
                      <span>
                        <strong>Mentor:</strong> {data.profile.mentor}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {data.profile.url && (
                <div className="hero-right-actions">
                  <a
                    href={data.profile.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline hero-action-btn"
                    style={{ textDecoration: "none" }}
                  >
                    <ExternalLink size={15} />
                    <span>Open My LeetCode Profile</span>
                  </a>
                </div>
              )}
            </div>

            {!data.linked ? (
              <div className="dashboard-card" style={{ padding: "36px 24px", textAlign: "center" }}>
                <BookOpen size={36} style={{ color: "var(--warning)", margin: "0 auto 12px" }} />
                <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem" }}>LeetCode Profile Not Linked Yet</h3>
                <p style={{ color: "var(--muted)", fontSize: "0.9rem", maxWidth: "520px", margin: "0 auto", lineHeight: 1.5 }}>
                  Your login account (Roll No: <strong>{data.profile.portalUsername}</strong>, Enrollment No: <strong>{data.profile.enrollmentNo}</strong>) is active, but your LeetCode profile has not been uploaded to the tracker roster yet. Please contact your mentor or admin.
                </p>
              </div>
            ) : (
              <>
                {/* 4 Progress KPI Cards */}
                <div className="kpi-grid" style={{ marginBottom: "24px" }}>
                  <div className="kpi-card">
                    <div className="kpi-header">
                      <span className="kpi-title">Assigned Questions</span>
                      <div className="kpi-icon-pill" style={{ background: "rgba(164, 14, 25, 0.08)", color: "var(--primary)" }}>
                        <Target size={20} />
                      </div>
                    </div>
                    <div className="kpi-value">
                      {completedCount} / {totalAssigned}
                    </div>
                    <div className="kpi-footer">
                      <div className="kpi-subtext">
                        <strong>{completionPct}%</strong> completed
                      </div>
                      <div className="kpi-ratio-bar">
                        <div
                          className="kpi-ratio-fill emerald"
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="kpi-header">
                      <span className="kpi-title">Pending Questions</span>
                      <div
                        className="kpi-icon-pill"
                        style={{
                          background: pendingCount > 0 ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.1)",
                          color: pendingCount > 0 ? "#d97706" : "#059669",
                        }}
                      >
                        {pendingCount > 0 ? <Clock size={20} /> : <CheckCircle2 size={20} />}
                      </div>
                    </div>
                    <div className="kpi-value" style={{ color: pendingCount > 0 ? "#d97706" : "#059669" }}>
                      {pendingCount}
                    </div>
                    <div className="kpi-footer">
                      <div className="kpi-subtext">
                        {pendingCount > 0 ? "Needs submission on LeetCode" : "All assigned questions completed!"}
                      </div>
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="kpi-header">
                      <span className="kpi-title">Total LeetCode Solved</span>
                      <div className="kpi-icon-pill" style={{ background: "rgba(16, 185, 129, 0.08)", color: "#10b981" }}>
                        <Award size={20} />
                      </div>
                    </div>
                    <div className="kpi-value">{data.stats?.totalSolved ?? 0}</div>
                    <div className="kpi-footer">
                      <div className="kpi-subtext" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ color: "#059669", fontWeight: 600 }}>E: {data.stats?.easySolved ?? 0}</span>
                        <span style={{ color: "#d97706", fontWeight: 600 }}>M: {data.stats?.mediumSolved ?? 0}</span>
                        <span style={{ color: "#dc2626", fontWeight: 600 }}>H: {data.stats?.hardSolved ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="kpi-card">
                    <div className="kpi-header">
                      <span className="kpi-title">Solved Today</span>
                      <div className="kpi-icon-pill" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}>
                        <Flame size={20} />
                      </div>
                    </div>
                    <div className="kpi-value">{data.stats?.solvedToday ?? 0}</div>
                    <div className="kpi-footer">
                      <div className="kpi-subtext">
                        Last sync: {formatDateTime(data.stats?.lastScrapedAt ?? null)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Questions Progress Table */}
                <div className="dashboard-card" style={{ marginBottom: "24px" }}>
                  <div
                    className="card-header"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <h3 className="card-title" style={{ margin: 0 }}>
                        My Assigned Questions ({totalAssigned})
                      </h3>
                      <div style={{ display: "inline-flex", background: "#e2e8f0", padding: "2px", borderRadius: "6px", gap: "2px" }}>
                        <button
                          type="button"
                          onClick={() => setStatusFilter("all")}
                          style={{
                            padding: "4px 10px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            borderRadius: "4px",
                            border: "none",
                            cursor: "pointer",
                            background: statusFilter === "all" ? "white" : "transparent",
                            color: statusFilter === "all" ? "var(--primary)" : "var(--muted)",
                          }}
                        >
                          All ({totalAssigned})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter("pending")}
                          style={{
                            padding: "4px 10px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            borderRadius: "4px",
                            border: "none",
                            cursor: "pointer",
                            background: statusFilter === "pending" ? "white" : "transparent",
                            color: statusFilter === "pending" ? "#d97706" : "var(--muted)",
                          }}
                        >
                          Pending ({pendingCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusFilter("completed")}
                          style={{
                            padding: "4px 10px",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            borderRadius: "4px",
                            border: "none",
                            cursor: "pointer",
                            background: statusFilter === "completed" ? "white" : "transparent",
                            color: statusFilter === "completed" ? "#059669" : "var(--muted)",
                          }}
                        >
                          Completed ({completedCount})
                        </button>
                      </div>
                    </div>

                    <div style={{ position: "relative" }}>
                      <Search
                        size={14}
                        style={{
                          position: "absolute",
                          left: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--muted)",
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Search question..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          padding: "6px 10px 6px 30px",
                          borderRadius: "6px",
                          border: "1px solid var(--surface-border)",
                          fontSize: "0.82rem",
                          width: "190px",
                        }}
                      />
                    </div>
                  </div>

                  {pendingCount > 0 && (
                    <div
                      style={{
                        padding: "10px 18px",
                        background: "#fffbeb",
                        borderBottom: "1px solid #fde68a",
                        color: "#92400e",
                        fontSize: "0.82rem",
                      }}
                    >
                      <strong>Tip:</strong> If you already solved a pending question in the past, resubmit your solution once on LeetCode using your registered account so the tracker marks it completed on the next sync.
                    </div>
                  )}

                  {filteredAssignments.length === 0 ? (
                    <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>
                      {totalAssigned === 0
                        ? "No questions have been assigned to you yet."
                        : "No questions match the selected filter."}
                    </div>
                  ) : (
                    <div className="data-table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ padding: "12px 16px", width: "52px" }}>#</th>
                            <th style={{ padding: "12px 16px" }}>Question</th>
                            <th style={{ padding: "12px 16px" }}>Status</th>
                            <th style={{ padding: "12px 16px" }}>Assigned On</th>
                            <th style={{ padding: "12px 16px" }}>Completed At</th>
                            <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAssignments.map((item, idx) => {
                            const displayTitle = (item.title || item.titleSlug)
                              .replace(/-/g, " ")
                              .replace(/\b\w/g, (c) => c.toUpperCase());
                            const leetcodeUrl = `https://leetcode.com/problems/${item.titleSlug}/`;

                            return (
                              <tr key={item.id}>
                                <td style={{ padding: "12px 16px", color: "var(--muted)", fontSize: "0.84rem" }}>
                                  {idx + 1}
                                </td>
                                <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                                  <a
                                    href={leetcodeUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: "var(--primary)", textDecoration: "none" }}
                                  >
                                    {displayTitle}
                                  </a>
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                  <span
                                    className={`status-badge ${
                                      item.status === "completed" ? "success" : "pending"
                                    }`}
                                  >
                                    {item.status === "completed" ? "Completed" : "Pending"}
                                  </span>
                                </td>
                                <td style={{ padding: "12px 16px", fontSize: "0.84rem", color: "var(--muted)" }}>
                                  {new Date(item.assignedAt).toLocaleDateString()}
                                </td>
                                <td style={{ padding: "12px 16px", fontSize: "0.84rem", color: "var(--muted)" }}>
                                  {formatDateTime(item.completedAt)}
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right" }}>
                                  <a
                                    href={leetcodeUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={item.status === "completed" ? "btn btn-outline" : "btn btn-primary"}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      fontSize: "0.78rem",
                                      padding: "5px 11px",
                                      textDecoration: "none",
                                    }}
                                  >
                                    <span>{item.status === "completed" ? "View" : "Solve"}</span>
                                    <ExternalLink size={12} />
                                  </a>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Recent Submissions */}
                <div className="dashboard-card">
                  <div className="card-header">
                    <h3 className="card-title" style={{ margin: 0 }}>
                      Recent Synced Submissions ({data.submissions.length})
                    </h3>
                  </div>
                  {data.submissions.length === 0 ? (
                    <div style={{ padding: "28px", textAlign: "center", color: "var(--muted)", fontSize: "0.9rem" }}>
                      No synced submissions recorded yet.
                    </div>
                  ) : (
                    <div className="data-table-wrapper" style={{ maxHeight: "380px", overflowY: "auto" }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th style={{ padding: "10px 16px" }}>Problem</th>
                            <th style={{ padding: "10px 16px" }}>Difficulty</th>
                            <th style={{ padding: "10px 16px", textAlign: "right" }}>Submitted At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.submissions.map((sub) => (
                            <tr key={sub.id}>
                              <td style={{ padding: "10px 16px", fontWeight: 500 }}>
                                <a
                                  href={`https://leetcode.com/problems/${sub.titleSlug}/`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: "var(--primary)", textDecoration: "none" }}
                                >
                                  {sub.title}
                                </a>
                              </td>
                              <td style={{ padding: "10px 16px", fontSize: "0.84rem", fontWeight: 600 }}>
                                <span
                                  style={{
                                    color:
                                      sub.difficulty === "Easy"
                                        ? "#059669"
                                        : sub.difficulty === "Medium"
                                          ? "#d97706"
                                          : sub.difficulty === "Hard"
                                            ? "#dc2626"
                                            : "var(--muted)",
                                  }}
                                >
                                  {sub.difficulty || "—"}
                                </span>
                              </td>
                              <td style={{ padding: "10px 16px", textAlign: "right", fontSize: "0.83rem", color: "var(--muted)" }}>
                                {formatDateTime(sub.timestamp)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
