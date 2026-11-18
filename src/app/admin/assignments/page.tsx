"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  BookOpen,
  Trash2,
  Download,
  Edit2,
  X,
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AssignmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [targetBranch, setTargetBranch] = useState("");
  const [targetSection, setTargetSection] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const [assignmentDetails, setAssignmentDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editTargetBranch, setEditTargetBranch] = useState("");
  const [editTargetSection, setEditTargetSection] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Assignment list filters
  const [searchQuery, setSearchQuery] = useState("");
  const [completionFilter, setCompletionFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [assignmentBranchFilter, setAssignmentBranchFilter] = useState("all");

  // Opened question filters (Branch, Semester, Section, Status, Search)
  const [expandedStatusFilter, setExpandedStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [expandedBranchFilter, setExpandedBranchFilter] = useState("all");
  const [expandedSemesterFilter, setExpandedSemesterFilter] = useState("all");
  const [expandedSectionFilter, setExpandedSectionFilter] = useState("all");
  const [expandedStudentSearch, setExpandedStudentSearch] = useState("");
  const [defaultDomain, setDefaultDomain] = useState("");
  const [showDomainFallback, setShowDomainFallback] = useState(false);

  // Individual email sending state (strictly 1 student at a time)
  const [sendingStudentId, setSendingStudentId] = useState<string | null>(null);
  const [sentReminders, setSentReminders] = useState<Record<string, boolean>>({});
  const [individualMailFeedback, setIndividualMailFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const [availableBranches, setAvailableBranches] = useState<string[]>([]);

  const [lookupRollNumber, setLookupRollNumber] = useState("");
  const [lookupStudent, setLookupStudent] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const [isReconciling, setIsReconciling] = useState(false);
  const [reconcileMessage, setReconcileMessage] = useState("");

  const handleLookupStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupRollNumber) return;
    setLookupLoading(true);
    setLookupError("");
    setLookupStudent(null);
    try {
      const res = await fetch(`/api/admin/student-lookup?rollNumber=${encodeURIComponent(lookupRollNumber)}`);
      if (res.ok) {
        setLookupStudent(await res.json());
      } else {
        setLookupError("Student not found");
      }
    } catch {
      setLookupError("Error fetching student");
    } finally {
      setLookupLoading(false);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && (session?.user as any)?.role !== 'admin') {
      router.push("/");
    } else if (status === "authenticated") {
      fetchAssignments();
      fetchBranches();
    }
  }, [status, router, session]);

  const fetchBranches = async () => {
    try {
      const res = await fetch("/api/admin/branches");
      if (res.ok) {
        setAvailableBranches(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAssignments = async () => {
    try {
      setFetchError("");
      const res = await fetch("/api/admin/assignments");
      if (res.ok) {
        setAssignments(await res.json());
      } else {
        const data = await res.json().catch(() => null);
        setFetchError(data?.error || `Failed to load assignments (Status ${res.status})`);
      }
    } catch (e: any) {
      console.error(e);
      setFetchError(e.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    try {
      setIsReconciling(true);
      setReconcileMessage("");
      const res = await fetch("/api/admin/assignments/reconcile", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setReconcileMessage(data.message || `Reconciliation complete. Updated ${data.reconciled || 0} assignments.`);
        await fetchAssignments();
        if (expandedAssignmentId) {
          await loadAssignmentDetails(expandedAssignmentId);
        }
        setTimeout(() => setReconcileMessage(""), 6000);
      } else {
        alert(data.error || "Failed to reconcile assignments");
      }
    } catch (e: any) {
      alert(e.message || "Error reconciling assignments");
    } finally {
      setIsReconciling(false);
    }
  };

  const resetExpandedFilters = (initialStatus: 'all' | 'pending' | 'completed' = 'all') => {
    setExpandedStatusFilter(initialStatus);
    setExpandedBranchFilter("all");
    setExpandedSemesterFilter("all");
    setExpandedSectionFilter("all");
    setExpandedStudentSearch("");
    setIndividualMailFeedback(null);
  };

  const loadAssignmentDetails = async (id: string) => {
    setLoadingDetails(true);
    setAssignmentDetails(null);
    try {
      const res = await fetch(`/api/admin/assignments/${id}`);
      if (res.ok) {
        setAssignmentDetails(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleToggleExpand = async (id: string) => {
    if (expandedAssignmentId === id) {
      setExpandedAssignmentId(null);
      setAssignmentDetails(null);
      setIndividualMailFeedback(null);
      return;
    }

    setExpandedAssignmentId(id);
    resetExpandedFilters('all');
    await loadAssignmentDetails(id);
  };

  const handleOpenForEmail = async (id: string) => {
    if (expandedAssignmentId === id) {
      setExpandedStatusFilter('pending');
      return;
    }

    setExpandedAssignmentId(id);
    resetExpandedFilters('pending');
    await loadAssignmentDetails(id);
  };

  const buildGmailComposeUrl = (assignment: any, student: any, targetEmail: string) => {
    const displayTitle =
      assignment.title ||
      (assignment.titleSlug || '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const problemUrl = `https://leetcode.com/problems/${assignment.titleSlug}/`;
    const subject = `Reminder: ${displayTitle} (LeetCode Practice)`;
    const body = [
      `Hi ${student.name} (${student.rollNumber}),`,
      '',
      `This is a quick reminder to complete the pending LeetCode practice question: ${displayTitle}.`,
      '',
      `Problem link: ${problemUrl}`,
      '',
      'If you have already solved this question earlier, please resubmit your solution once on LeetCode using your registered account so your completion gets synced automatically.',
      '',
      'Regards,',
      'LeetCode Mentor Team',
    ].join('\n');

    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSendIndividualReminder = async (assignmentId: string, sa: any) => {
    if (sendingStudentId) return; // Enforce sending to strictly 1 individual at a time

    const student = sa.student;
    setSendingStudentId(student.id);
    setIndividualMailFeedback(null);

    try {
      const res = await fetch(`/api/admin/assignments/${assignmentId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          defaultDomain: defaultDomain.trim(),
        }),
      });
      const data = await res.json();

      if (data.alreadyCompleted) {
        setAssignmentDetails((prev: any) => {
          if (!prev || prev.id !== assignmentId) return prev;
          return {
            ...prev,
            studentAssignments: prev.studentAssignments.map((item: any) =>
              item.student.id === student.id
                ? { ...item, status: 'completed', completedAt: data.completedAt || new Date().toISOString() }
                : item
            ),
          };
        });
        setAssignments((prev) =>
          prev.map((a) =>
            a.id === assignmentId
              ? { ...a, completedCount: Math.min(a.totalAssigned, (a.completedCount || 0) + 1) }
              : a
          )
        );
        setIndividualMailFeedback({
          type: 'info',
          message: data.message || `${student.name} has already solved this question. Marked as Done.`,
        });
        return;
      }

      if (!res.ok) {
        setIndividualMailFeedback({
          type: 'error',
          message: data.error || `Failed to send reminder email to ${student.name}.`,
        });
        return;
      }

      setSentReminders((prev) => ({
        ...prev,
        [`${assignmentId}:${student.id}`]: true,
      }));
      setIndividualMailFeedback({
        type: 'success',
        message: data.message || `Reminder email sent to ${student.name} (${data.email}).`,
      });
    } catch (err: any) {
      setIndividualMailFeedback({
        type: 'error',
        message: err.message || "Network error while sending reminder email.",
      });
    } finally {
      setSendingStudentId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this assignment?")) return;
    try {
      const res = await fetch(`/api/admin/assignments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAssignments();
        if (expandedAssignmentId === id) {
          setExpandedAssignmentId(null);
          setAssignmentDetails(null);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openEditModal = (assignment: any) => {
    setEditingAssignment(assignment);
    setEditUrl(`https://leetcode.com/problems/${assignment.titleSlug}/`);
    setEditTitle(assignment.title || "");
    setEditTargetBranch(assignment.targetBranch || "");
    setEditTargetSection(assignment.targetSection || "");
  };

  const handleUpdateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/assignments/${editingAssignment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: editUrl,
          title: editTitle,
          targetBranch: editTargetBranch,
          targetSection: editTargetSection
        })
      });
      if (res.ok) {
        const updatedId = editingAssignment.id;
        setEditingAssignment(null);
        await fetchAssignments();
        if (expandedAssignmentId === updatedId) {
          await loadAssignmentDetails(updatedId);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredAssignments = assignments.filter(a => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = (a.title && a.title.toLowerCase().includes(q)) ||
        (a.titleSlug && a.titleSlug.toLowerCase().includes(q)) ||
        (a.targetBranch && a.targetBranch.toLowerCase().includes(q));
      if (!matchesSearch) return false;
    }
    if (assignmentBranchFilter !== 'all') {
      if (!a.targetBranch || a.targetBranch.toLowerCase() !== assignmentBranchFilter.toLowerCase()) {
        return false;
      }
    }
    if (completionFilter === 'pending') {
      return a.completedCount < a.totalAssigned;
    }
    if (completionFilter === 'completed') {
      return a.totalAssigned > 0 && a.completedCount === a.totalAssigned;
    }
    return true;
  });

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl,
          title: newTitle,
          targetBranch: targetBranch || null,
          targetSection: targetSection || null
        })
      });

      if (res.ok) {
        setNewUrl("");
        setNewTitle("");
        setTargetBranch("");
        setTargetSection("");
        fetchAssignments();
        alert("Assignment created successfully");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create assignment");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="enterprise-loader-wrapper">
        <div className="pulse-logo">L</div>
        <div className="loader-text">Loading Assignments...</div>
      </div>
    );
  }

  const normalizedFallbackDomain = defaultDomain.trim().replace(/^@/, '');

  return (
    <div className="dashboard-layout">
      <nav className="topnav">
        <div className="topnav-brand">
          <Link href="/" className="icon-btn" style={{ background: 'transparent', textDecoration: 'none', color: 'inherit' }} title="Back to Dashboard">
            <ArrowLeft size={20} />
          </Link>
          <div className="topnav-brand-icon">L</div>
          <span>Assignments</span>
        </div>
        <div className="topnav-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/admin/emails" className="btn btn-outline hide-on-mobile" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 12px' }}>
            <Mail size={15} /> Student Emails
          </Link>
          <Link href="/admin/users" className="btn btn-outline hide-on-mobile" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 12px' }}>
            User Management
          </Link>
          <Link href="/admin/data" className="btn btn-outline hide-on-mobile" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 12px' }}>
            Full Data
          </Link>
        </div>
      </nav>

      <main className="main-content">
        <div className="curved-banner-container">
          <div className="curved-banner"></div>
        </div>
        <div className="profile-banner">
          <div className="profile-avatar">
            <BookOpen size={32} />
          </div>
          <div className="profile-info">
            <h2>Manage Assignments</h2>
            <div style={{ opacity: 0.9, fontSize: '0.9rem', marginTop: 4, maxWidth: '380px', lineHeight: 1.4 }}>
              Assign LeetCode questions, open any question to filter by Branch / Semester / Section, and send reminder emails individually.
            </div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

            <div style={{ flex: '1 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Create Assignment Form */}
              <div className="dashboard-card" style={{ margin: 0, width: '100%' }}>
                <div className="card-header">
                  <h3 className="card-title">Assign Question</h3>
                </div>
                <form onSubmit={handleCreateAssignment} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>LeetCode URL</label>
                    <input
                      type="url"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://leetcode.com/problems/two-sum/"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Custom Title (Optional)</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Two Sum"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Target Branch (Optional)</label>
                      <select
                        value={targetBranch}
                        onChange={(e) => setTargetBranch(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)', backgroundColor: 'var(--background)' }}
                      >
                        <option value="">All Branches</option>
                        {availableBranches.map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Target Section (Optional)</label>
                      <input
                        type="text"
                        value={targetSection}
                        onChange={(e) => setTargetSection(e.target.value)}
                        placeholder="e.g. A"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={isCreating} className="btn btn-primary" style={{ marginTop: '8px' }}>
                    <Plus size={16} /> {isCreating ? "Assigning..." : "Assign Question"}
                  </button>
                </form>
              </div>

              {/* Assignments List */}
              <div className="dashboard-card" style={{ margin: 0 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h3 className="card-title" style={{ margin: 0 }}>All Assignments ({assignments.length})</h3>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                      <input
                        type="text"
                        placeholder="Search questions..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ padding: '6px 10px 6px 30px', borderRadius: '6px', border: '1px solid var(--surface-border)', fontSize: '0.82rem', width: '160px' }}
                      />
                    </div>
                    <select
                      value={completionFilter}
                      onChange={e => setCompletionFilter(e.target.value as any)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--surface-border)', fontSize: '0.82rem', background: 'white', color: 'var(--foreground)', cursor: 'pointer' }}
                    >
                      <option value="all">All Statuses ({assignments.length})</option>
                      <option value="pending">Pending ({assignments.filter(a => a.completedCount < a.totalAssigned).length})</option>
                      <option value="completed">Completed ({assignments.filter(a => a.totalAssigned > 0 && a.completedCount === a.totalAssigned).length})</option>
                    </select>
                    <select
                      value={assignmentBranchFilter}
                      onChange={e => setAssignmentBranchFilter(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--surface-border)', fontSize: '0.82rem', background: 'white', color: 'var(--foreground)', cursor: 'pointer' }}
                    >
                      <option value="all">All Branches</option>
                      {availableBranches.map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleReconcile}
                      disabled={isReconciling}
                      className="btn btn-outline"
                      title="Scan stored submissions and automatically mark completed questions"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.85rem', cursor: isReconciling ? 'not-allowed' : 'pointer' }}
                    >
                      <RefreshCw size={14} className={isReconciling ? "animate-spin" : ""} /> {isReconciling ? "Syncing..." : "Sync Statuses"}
                    </button>
                    <a
                      href="/api/admin/assignments/export-all"
                      download
                      className="btn btn-outline"
                      style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      <Download size={16} /> Export All
                    </a>
                  </div>
                </div>

                {reconcileMessage && (
                  <div style={{
                    padding: '10px 16px', margin: '0 16px 14px 16px',
                    borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0',
                    color: '#065f46', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px'
                  }}>
                    <CheckCircle2 size={16} color="#059669" />
                    <span>{reconcileMessage}</span>
                  </div>
                )}

                {fetchError ? (
                  <div style={{ padding: '32px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--destructive)', marginBottom: '12px', fontSize: '0.9rem' }}>{fetchError}</div>
                    <button onClick={fetchAssignments} className="btn btn-outline" style={{ fontSize: '0.85rem' }}>Retry</button>
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="p-8 text-center text-muted">No assignments created yet.</div>
                ) : (
                  <div className="data-table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ padding: '12px 16px' }}>Question</th>
                          <th style={{ padding: '12px 16px' }}>Target</th>
                          <th style={{ padding: '12px 16px' }}>Completion</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right' }}>Date &amp; Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAssignments.map(a => {
                          const isExpanded = expandedAssignmentId === a.id;
                          return (
                            <React.Fragment key={a.id}>
                              <tr
                                onClick={() => handleToggleExpand(a.id)}
                                style={{
                                  cursor: 'pointer',
                                  borderBottom: isExpanded ? 'none' : '1px solid var(--surface-border)',
                                  background: isExpanded ? '#fdf2f2' : undefined,
                                }}
                              >
                                <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--muted)', display: 'inline-flex', alignItems: 'center' }}>
                                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </span>
                                    <a
                                      href={`https://leetcode.com/problems/${a.titleSlug}/`}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      style={{ color: 'var(--primary)', textDecoration: 'none' }}
                                    >
                                      {a.title}
                                    </a>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                    {a.targetBranch ? `${a.targetBranch} ` : 'All Branches '}
                                    {a.targetSection ? `(${a.targetSection})` : ''}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span>{a.completedCount} / {a.totalAssigned}</span>
                                    <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', background: 'var(--primary)', width: `${a.totalAssigned > 0 ? (a.completedCount / a.totalAssigned) * 100 : 0}%` }}></div>
                                    </div>
                                  </div>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--muted)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                                    <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleOpenForEmail(a.id); }}
                                      className="icon-btn"
                                      title="Open question to filter & send individual reminder emails"
                                      style={{ color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                                    >
                                      <Mail size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); openEditModal(a); }}
                                      className="icon-btn"
                                      title="Edit"
                                      style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                                      className="icon-btn"
                                      title="Delete"
                                      style={{ color: 'var(--destructive)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                    <a
                                      href={`/api/admin/assignments/${a.id}/export`}
                                      download
                                      onClick={e => e.stopPropagation()}
                                      title="Download Report"
                                      className="icon-btn"
                                      style={{ color: 'var(--primary)', textDecoration: 'none', padding: 4 }}
                                    >
                                      <Download size={16} />
                                    </a>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={4} style={{ padding: '0 16px 24px 16px', background: 'var(--surface)' }}>
                                    <div style={{ border: '1px solid var(--surface-border)', borderRadius: '10px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                                      {loadingDetails ? (
                                        <div style={{ padding: '24px' }}>
                                          <div className="skeleton-row" style={{ width: '100%', marginBottom: '12px' }}></div>
                                          <div className="skeleton-row" style={{ width: '80%', marginBottom: '12px' }}></div>
                                          <div className="skeleton-row" style={{ width: '90%' }}></div>
                                        </div>
                                      ) : assignmentDetails ? (() => {
                                        const allStudentAssignments: any[] = assignmentDetails.studentAssignments || [];
                                        const totalPendingAll = allStudentAssignments.filter(sa => sa.status === 'pending').length;

                                        // Cascading unique Branch -> Semester -> Section options
                                        const assignmentBranches = Array.from(
                                          new Set(
                                            allStudentAssignments
                                              .map(sa => sa.student.branch?.trim())
                                              .filter((b): b is string => Boolean(b))
                                          )
                                        ).sort((x, y) => x.localeCompare(y, undefined, { sensitivity: 'base' }));

                                        const afterBranch = allStudentAssignments.filter(sa => {
                                          if (expandedBranchFilter === 'all') return true;
                                          return (sa.student.branch || '').trim().toLowerCase() === expandedBranchFilter.toLowerCase();
                                        });

                                        const assignmentSemesters = Array.from(
                                          new Set(
                                            afterBranch
                                              .map(sa => sa.student.semester?.trim())
                                              .filter((s): s is string => Boolean(s))
                                          )
                                        ).sort((x, y) => x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' }));

                                        const afterSemester = afterBranch.filter(sa => {
                                          if (expandedSemesterFilter === 'all') return true;
                                          return (sa.student.semester || '').trim().toLowerCase() === expandedSemesterFilter.toLowerCase();
                                        });

                                        const assignmentSections = Array.from(
                                          new Set(
                                            afterSemester
                                              .map(sa => sa.student.section?.trim())
                                              .filter((s): s is string => Boolean(s))
                                          )
                                        ).sort((x, y) => x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' }));

                                        const cohortStudents = afterSemester.filter(sa => {
                                          if (
                                            expandedSectionFilter !== 'all' &&
                                            (sa.student.section || '').trim().toLowerCase() !== expandedSectionFilter.toLowerCase()
                                          ) {
                                            return false;
                                          }
                                          if (expandedStudentSearch.trim()) {
                                            const q = expandedStudentSearch.trim().toLowerCase();
                                            const matchRoll = (sa.student.rollNumber || '').toLowerCase().includes(q);
                                            const matchName = (sa.student.name || '').toLowerCase().includes(q);
                                            const matchEmail = (sa.student.email || '').toLowerCase().includes(q);
                                            if (!matchRoll && !matchName && !matchEmail) return false;
                                          }
                                          return true;
                                        });

                                        const cohortPendingCount = cohortStudents.filter(sa => sa.status === 'pending').length;
                                        const cohortCompletedCount = cohortStudents.filter(sa => sa.status === 'completed').length;

                                        const visibleAssignments = cohortStudents.filter(sa => {
                                          if (expandedStatusFilter === 'pending' && sa.status !== 'pending') return false;
                                          if (expandedStatusFilter === 'completed' && sa.status !== 'completed') return false;
                                          return true;
                                        });

                                        const hasActiveFilters =
                                          expandedBranchFilter !== 'all' ||
                                          expandedSemesterFilter !== 'all' ||
                                          expandedSectionFilter !== 'all' ||
                                          expandedStatusFilter !== 'all' ||
                                          expandedStudentSearch.trim() !== '';

                                        const missingEmailCount = visibleAssignments.filter(
                                          sa => sa.status === 'pending' && !sa.student.email?.trim()
                                        ).length;

                                        return (
                                          <div>
                                            {/* Top Summary & Safe Individual Mode Bar */}
                                            <div style={{
                                              padding: '12px 16px',
                                              background: '#f8fafc',
                                              borderBottom: '1px solid var(--surface-border)',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              flexWrap: 'wrap',
                                              gap: '10px',
                                            }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                                <div style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                                                  <strong style={{ color: '#0f172a' }}>{totalPendingAll}</strong> pending / <strong>{allStudentAssignments.length}</strong> total assigned
                                                </div>
                                                <span style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '5px',
                                                  fontSize: '0.75rem',
                                                  fontWeight: 600,
                                                  color: '#065f46',
                                                  background: '#ecfdf5',
                                                  border: '1px solid #a7f3d0',
                                                  padding: '3px 10px',
                                                  borderRadius: '9999px',
                                                }}>
                                                  <Mail size={12} /> Individual Mail Mode (1 student at a time)
                                                </span>
                                              </div>

                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => setShowDomainFallback(prev => !prev)}
                                                  className="btn btn-outline"
                                                  style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                                                  title="Optional fallback domain for students without email in database"
                                                >
                                                  {normalizedFallbackDomain ? `Fallback: @${normalizedFallbackDomain}` : 'Domain Fallback'}
                                                </button>
                                                {hasActiveFilters && (
                                                  <button
                                                    type="button"
                                                    onClick={() => resetExpandedFilters('all')}
                                                    style={{
                                                      background: 'transparent',
                                                      border: 'none',
                                                      color: 'var(--primary)',
                                                      fontSize: '0.78rem',
                                                      fontWeight: 600,
                                                      cursor: 'pointer',
                                                      padding: '4px 6px',
                                                    }}
                                                  >
                                                    Reset Filters
                                                  </button>
                                                )}
                                              </div>
                                            </div>

                                            {/* Filter Bar: Branch, Semester, Section, Status, Search */}
                                            <div style={{
                                              padding: '12px 16px',
                                              background: '#ffffff',
                                              borderBottom: '1px solid var(--surface-border)',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              flexWrap: 'wrap',
                                              gap: '10px',
                                            }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)' }}>
                                                  <Filter size={13} /> Filter:
                                                </span>

                                                {/* Branch Filter */}
                                                <select
                                                  aria-label="Filter by Branch"
                                                  value={expandedBranchFilter}
                                                  onChange={e => {
                                                    setExpandedBranchFilter(e.target.value);
                                                    setExpandedSemesterFilter('all');
                                                    setExpandedSectionFilter('all');
                                                  }}
                                                  style={{
                                                    padding: '6px 10px',
                                                    fontSize: '0.8rem',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--surface-border)',
                                                    background: expandedBranchFilter !== 'all' ? '#fdf2f2' : 'white',
                                                    color: 'var(--foreground)',
                                                    fontWeight: expandedBranchFilter !== 'all' ? 600 : 400,
                                                    cursor: 'pointer',
                                                  }}
                                                >
                                                  <option value="all">All Branches</option>
                                                  {assignmentBranches.map(b => (
                                                    <option key={b} value={b}>{b}</option>
                                                  ))}
                                                </select>

                                                {/* Semester Filter */}
                                                <select
                                                  aria-label="Filter by Semester"
                                                  value={expandedSemesterFilter}
                                                  onChange={e => {
                                                    setExpandedSemesterFilter(e.target.value);
                                                    setExpandedSectionFilter('all');
                                                  }}
                                                  style={{
                                                    padding: '6px 10px',
                                                    fontSize: '0.8rem',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--surface-border)',
                                                    background: expandedSemesterFilter !== 'all' ? '#fdf2f2' : 'white',
                                                    color: 'var(--foreground)',
                                                    fontWeight: expandedSemesterFilter !== 'all' ? 600 : 400,
                                                    cursor: 'pointer',
                                                  }}
                                                >
                                                  <option value="all">All Semesters</option>
                                                  {assignmentSemesters.map(sem => (
                                                    <option key={sem} value={sem}>Sem {sem}</option>
                                                  ))}
                                                </select>

                                                {/* Section Filter */}
                                                <select
                                                  aria-label="Filter by Section"
                                                  value={expandedSectionFilter}
                                                  onChange={e => setExpandedSectionFilter(e.target.value)}
                                                  style={{
                                                    padding: '6px 10px',
                                                    fontSize: '0.8rem',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--surface-border)',
                                                    background: expandedSectionFilter !== 'all' ? '#fdf2f2' : 'white',
                                                    color: 'var(--foreground)',
                                                    fontWeight: expandedSectionFilter !== 'all' ? 600 : 400,
                                                    cursor: 'pointer',
                                                  }}
                                                >
                                                  <option value="all">All Sections</option>
                                                  {assignmentSections.map(s => (
                                                    <option key={s} value={s}>Sec {s}</option>
                                                  ))}
                                                </select>

                                                {/* Student Search */}
                                                <div style={{ position: 'relative' }}>
                                                  <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                                                  <input
                                                    type="text"
                                                    placeholder="Roll no or name..."
                                                    value={expandedStudentSearch}
                                                    onChange={e => setExpandedStudentSearch(e.target.value)}
                                                    style={{
                                                      padding: '6px 10px 6px 28px',
                                                      borderRadius: '6px',
                                                      border: '1px solid var(--surface-border)',
                                                      fontSize: '0.8rem',
                                                      width: '155px',
                                                    }}
                                                  />
                                                </div>
                                              </div>

                                              {/* Status Pills */}
                                              <div style={{ display: 'inline-flex', alignItems: 'center', background: '#e2e8f0', padding: '2px', borderRadius: '6px', gap: '2px' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => setExpandedStatusFilter('all')}
                                                  style={{
                                                    padding: '4px 10px', fontSize: '0.76rem', fontWeight: 600, borderRadius: '4px', border: 'none', cursor: 'pointer',
                                                    background: expandedStatusFilter === 'all' ? 'white' : 'transparent',
                                                    color: expandedStatusFilter === 'all' ? 'var(--primary)' : 'var(--muted)',
                                                    boxShadow: expandedStatusFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                                  }}
                                                >
                                                  All ({cohortStudents.length})
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setExpandedStatusFilter('pending')}
                                                  style={{
                                                    padding: '4px 10px', fontSize: '0.76rem', fontWeight: 600, borderRadius: '4px', border: 'none', cursor: 'pointer',
                                                    background: expandedStatusFilter === 'pending' ? 'white' : 'transparent',
                                                    color: expandedStatusFilter === 'pending' ? '#d97706' : 'var(--muted)',
                                                    boxShadow: expandedStatusFilter === 'pending' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                                  }}
                                                >
                                                  Pending ({cohortPendingCount})
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setExpandedStatusFilter('completed')}
                                                  style={{
                                                    padding: '4px 10px', fontSize: '0.76rem', fontWeight: 600, borderRadius: '4px', border: 'none', cursor: 'pointer',
                                                    background: expandedStatusFilter === 'completed' ? 'white' : 'transparent',
                                                    color: expandedStatusFilter === 'completed' ? '#059669' : 'var(--muted)',
                                                    boxShadow: expandedStatusFilter === 'completed' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                                  }}
                                                >
                                                  Done ({cohortCompletedCount})
                                                </button>
                                              </div>
                                            </div>

                                            {/* Optional College Domain Fallback Bar */}
                                            {showDomainFallback && (
                                              <div style={{
                                                padding: '10px 16px',
                                                background: '#f8fafc',
                                                borderBottom: '1px solid var(--surface-border)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '10px',
                                                fontSize: '0.8rem',
                                              }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                  <label style={{ fontWeight: 600, color: '#334155' }}>College Domain Fallback:</label>
                                                  <input
                                                    type="text"
                                                    value={defaultDomain}
                                                    onChange={e => setDefaultDomain(e.target.value)}
                                                    placeholder="e.g. college.edu"
                                                    style={{
                                                      padding: '5px 10px',
                                                      borderRadius: '6px',
                                                      border: '1px solid var(--surface-border)',
                                                      fontSize: '0.8rem',
                                                      width: '180px',
                                                      background: 'white',
                                                    }}
                                                  />
                                                  <span style={{ color: 'var(--muted)', fontSize: '0.76rem' }}>
                                                    Used as <code>[RollNumber]@domain</code> only when a student has no email saved.
                                                  </span>
                                                </div>
                                                {missingEmailCount > 0 && (
                                                  <Link
                                                    href="/admin/emails"
                                                    style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.78rem', textDecoration: 'underline' }}
                                                  >
                                                    Manage Student Emails &rarr;
                                                  </Link>
                                                )}
                                              </div>
                                            )}

                                            {/* Individual Email Feedback Banner */}
                                            {individualMailFeedback && (
                                              <div style={{
                                                padding: '10px 16px',
                                                borderBottom: '1px solid var(--surface-border)',
                                                background:
                                                  individualMailFeedback.type === 'success'
                                                    ? '#ecfdf5'
                                                    : individualMailFeedback.type === 'error'
                                                      ? '#fef2f2'
                                                      : '#eff6ff',
                                                color:
                                                  individualMailFeedback.type === 'success'
                                                    ? '#065f46'
                                                    : individualMailFeedback.type === 'error'
                                                      ? '#991b1b'
                                                      : '#1e40af',
                                                fontSize: '0.84rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '10px',
                                              }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                  {individualMailFeedback.type === 'error' ? (
                                                    <AlertCircle size={16} />
                                                  ) : (
                                                    <CheckCircle2 size={16} />
                                                  )}
                                                  <span>{individualMailFeedback.message}</span>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => setIndividualMailFeedback(null)}
                                                  style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2 }}
                                                  title="Dismiss"
                                                >
                                                  <X size={15} />
                                                </button>
                                              </div>
                                            )}

                                            {/* Filtered Student Table */}
                                            <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
                                              <table className="data-table" style={{ margin: 0 }}>
                                                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--background)' }}>
                                                  <tr>
                                                    <th style={{ padding: '10px 14px' }}>Roll Number</th>
                                                    <th style={{ padding: '10px 14px' }}>Name</th>
                                                    <th style={{ padding: '10px 14px' }}>Branch</th>
                                                    <th style={{ padding: '10px 14px' }}>Sem</th>
                                                    <th style={{ padding: '10px 14px' }}>Sec</th>
                                                    <th style={{ padding: '10px 14px' }}>Email</th>
                                                    <th style={{ padding: '10px 14px' }}>Status</th>
                                                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Send Mail</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {visibleAssignments.length === 0 ? (
                                                    <tr>
                                                      <td colSpan={8} style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--muted)', fontSize: '0.88rem' }}>
                                                        No students match the selected Branch / Semester / Section filters.
                                                      </td>
                                                    </tr>
                                                  ) : visibleAssignments.map((sa: any) => {
                                                    const student = sa.student;
                                                    const savedEmail = student.email?.trim() || '';
                                                    const effectiveEmail =
                                                      savedEmail ||
                                                      (normalizedFallbackDomain ? `${student.rollNumber}@${normalizedFallbackDomain}` : '');
                                                    const isSendingThis = sendingStudentId === student.id;
                                                    const isAnySending = sendingStudentId !== null;
                                                    const wasSent = Boolean(sentReminders[`${a.id}:${student.id}`]);

                                                    return (
                                                      <tr key={student.id}>
                                                        <td style={{ padding: '9px 14px', fontWeight: 600, fontSize: '0.84rem' }}>{student.rollNumber}</td>
                                                        <td style={{ padding: '9px 14px', fontSize: '0.85rem' }}>{student.name}</td>
                                                        <td style={{ padding: '9px 14px', fontSize: '0.83rem', color: 'var(--muted)' }}>{student.branch || '—'}</td>
                                                        <td style={{ padding: '9px 14px', fontSize: '0.83rem', color: 'var(--muted)' }}>{student.semester || '—'}</td>
                                                        <td style={{ padding: '9px 14px', fontSize: '0.83rem', color: 'var(--muted)' }}>{student.section || '—'}</td>
                                                        <td style={{ padding: '9px 14px', fontSize: '0.82rem' }}>
                                                          {savedEmail ? (
                                                            <span style={{ color: 'var(--primary)' }}>{savedEmail}</span>
                                                          ) : effectiveEmail ? (
                                                            <span style={{ color: 'var(--muted)', fontStyle: 'italic' }} title="Using college domain fallback">
                                                              {effectiveEmail}
                                                            </span>
                                                          ) : (
                                                            <span style={{
                                                              color: '#b45309',
                                                              background: '#fef3c7',
                                                              padding: '2px 7px',
                                                              borderRadius: '4px',
                                                              fontSize: '0.74rem',
                                                              fontWeight: 600,
                                                            }}>
                                                              No Email
                                                            </span>
                                                          )}
                                                        </td>
                                                        <td style={{ padding: '9px 14px' }}>
                                                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <span className={`status-badge ${sa.status === 'completed' ? 'success' : 'pending'}`} style={{ width: 'fit-content' }}>
                                                              {sa.status === 'completed' ? 'Done' : 'Pending'}
                                                            </span>
                                                            {sa.completedAt && (
                                                              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                                                                {new Intl.DateTimeFormat('en-IN', {
                                                                  timeZone: 'Asia/Kolkata',
                                                                  day: '2-digit', month: '2-digit', year: '2-digit',
                                                                  hour: '2-digit', minute: '2-digit',
                                                                  hour12: true
                                                                }).format(new Date(sa.completedAt))}
                                                              </span>
                                                            )}
                                                          </div>
                                                        </td>
                                                        <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                          {sa.status === 'completed' ? (
                                                            <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Completed</span>
                                                          ) : !effectiveEmail ? (
                                                            <Link
                                                              href="/admin/emails"
                                                              style={{
                                                                fontSize: '0.76rem',
                                                                color: 'var(--muted)',
                                                                textDecoration: 'underline',
                                                              }}
                                                              title="Add student email on Student Emails page"
                                                            >
                                                              Add Email
                                                            </Link>
                                                          ) : wasSent ? (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                              <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                fontSize: '0.76rem',
                                                                fontWeight: 600,
                                                                color: '#059669',
                                                                background: '#ecfdf5',
                                                                border: '1px solid #a7f3d0',
                                                                padding: '4px 8px',
                                                                borderRadius: '6px',
                                                              }}>
                                                                <CheckCircle2 size={13} /> Sent
                                                              </span>
                                                              <button
                                                                type="button"
                                                                disabled={isAnySending}
                                                                onClick={() => handleSendIndividualReminder(a.id, sa)}
                                                                className="btn btn-outline"
                                                                style={{
                                                                  padding: '4px 8px',
                                                                  fontSize: '0.74rem',
                                                                  opacity: isAnySending ? 0.5 : 1,
                                                                  cursor: isAnySending ? 'not-allowed' : 'pointer',
                                                                }}
                                                                title={`Send again to ${effectiveEmail}`}
                                                              >
                                                                {isSendingThis ? 'Sending...' : 'Resend'}
                                                              </button>
                                                            </div>
                                                          ) : (
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                              <button
                                                                type="button"
                                                                disabled={isAnySending}
                                                                onClick={() => handleSendIndividualReminder(a.id, sa)}
                                                                className="btn btn-primary"
                                                                style={{
                                                                  display: 'inline-flex',
                                                                  alignItems: 'center',
                                                                  gap: '5px',
                                                                  padding: '5px 10px',
                                                                  fontSize: '0.76rem',
                                                                  opacity: isAnySending && !isSendingThis ? 0.5 : 1,
                                                                  cursor: isAnySending ? 'not-allowed' : 'pointer',
                                                                }}
                                                                title={`Send reminder email via server to ${effectiveEmail}`}
                                                              >
                                                                {isSendingThis ? (
                                                                  <>
                                                                    <RefreshCw size={12} className="animate-spin" />
                                                                    <span>Sending...</span>
                                                                  </>
                                                                ) : (
                                                                  <>
                                                                    <Send size={12} />
                                                                    <span>Send Mail</span>
                                                                  </>
                                                                )}
                                                              </button>
                                                              <a
                                                                href={buildGmailComposeUrl(a, student, effectiveEmail)}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                onClick={() => {
                                                                  setSentReminders((prev) => ({
                                                                    ...prev,
                                                                    [`${a.id}:${student.id}`]: true,
                                                                  }));
                                                                }}
                                                                className="btn btn-outline"
                                                                style={{
                                                                  display: 'inline-flex',
                                                                  alignItems: 'center',
                                                                  gap: '4px',
                                                                  padding: '5px 8px',
                                                                  fontSize: '0.74rem',
                                                                  textDecoration: 'none',
                                                                }}
                                                                title={`Open pre-filled email in Gmail for ${effectiveEmail} (never blocked by SMTP spam filter)`}
                                                              >
                                                                <ExternalLink size={12} />
                                                                <span>Gmail</span>
                                                              </a>
                                                            </div>
                                                          )}
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        );
                                      })() : (
                                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--destructive)' }}>Failed to load details.</div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>

            {/* Student Lookup */}
            <div style={{ flex: '1 1 100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="dashboard-card" style={{ margin: 0 }}>
                <div className="card-header">
                  <h3 className="card-title">Student Lookup</h3>
                </div>
                <div style={{ padding: '24px' }}>
                  <form onSubmit={handleLookupStudent} style={{ display: 'flex', gap: '12px' }}>
                    <input
                      type="text"
                      placeholder="Enter Roll Number..."
                      value={lookupRollNumber}
                      onChange={e => setLookupRollNumber(e.target.value)}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                      required
                    />
                    <button type="submit" disabled={lookupLoading} className="btn btn-primary" style={{ padding: '10px 16px' }}>
                      {lookupLoading ? 'Searching...' : 'Search'}
                    </button>
                  </form>

                  {lookupError && (
                    <div style={{ marginTop: '16px', color: 'var(--destructive)', fontSize: '0.9rem' }}>{lookupError}</div>
                  )}

                  {lookupStudent && (
                    <div style={{ marginTop: '24px' }}>
                      <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem' }}>{lookupStudent.name}</h4>
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                          Roll: {lookupStudent.rollNumber} • {lookupStudent.branch || 'No Branch'} {lookupStudent.section ? `(${lookupStudent.section})` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem' }}>All Submissions</h4>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', background: '#f8fafc', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--primary)' }}>
                          Total: {lookupStudent.submissions?.length || 0}
                        </span>
                      </div>
                      {lookupStudent.submissions && lookupStudent.submissions.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
                          {lookupStudent.submissions.map((sub: any) => (
                            <div key={sub.id} style={{ padding: '12px', border: '1px solid var(--surface-border)', borderRadius: '8px', background: 'var(--background)' }}>
                              <a href={`https://leetcode.com/problems/${sub.titleSlug}/`} target="_blank" rel="noreferrer" style={{ fontWeight: 500, color: 'var(--primary)', textDecoration: 'none', display: 'block', marginBottom: '4px' }}>
                                {sub.title}
                              </a>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted)' }}>
                                <span style={{
                                  color: sub.difficulty === 'Easy' ? 'var(--success)' : sub.difficulty === 'Medium' ? 'var(--warning)' : sub.difficulty === 'Hard' ? 'var(--destructive)' : 'var(--muted)',
                                  fontWeight: 600
                                }}>
                                  {sub.difficulty || 'Unknown'}
                                </span>
                                <span>{new Intl.DateTimeFormat('en-IN', {
                                  timeZone: 'Asia/Kolkata',
                                  day: '2-digit', month: '2-digit', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                                  hour12: true
                                }).format(new Date(sub.timestamp))}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>No recent submissions found.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Edit Modal */}
      {editingAssignment && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow-xl)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Edit Assignment</h3>
              <button onClick={() => setEditingAssignment(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpdateAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>LeetCode URL</label>
                <input
                  type="url"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Target Branch (Optional)</label>
                  <select
                    value={editTargetBranch}
                    onChange={(e) => setEditTargetBranch(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)', backgroundColor: 'var(--background)' }}
                  >
                    <option value="">All Branches</option>
                    {availableBranches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Target Section (Optional)</label>
                  <input
                    type="text"
                    value={editTargetSection}
                    onChange={(e) => setEditTargetSection(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setEditingAssignment(null)} className="btn btn-outline">Cancel</button>
                <button type="submit" disabled={isUpdating} className="btn btn-primary">
                  {isUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
