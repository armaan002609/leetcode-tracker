"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Plus, BookOpen, Trash2, Users, Download, Edit2, X, Mail, Send, CheckCircle2, AlertTriangle, AlertCircle, Search, CheckSquare, Square } from "lucide-react";
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

  // Email Notification & Multi-Selection States
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [completionFilter, setCompletionFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [expandedStatusFilter, setExpandedStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [targetAssignmentIds, setTargetAssignmentIds] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [loadingBulkPreview, setLoadingBulkPreview] = useState(false);
  const [bulkPreviewData, setBulkPreviewData] = useState<any>(null);
  const [recipientMode, setRecipientMode] = useState<'bcc' | 'cc'>('bcc');
  const [isSendingNotifications, setIsSendingNotifications] = useState(false);
  const [notificationResult, setNotificationResult] = useState<any>(null);
  const [defaultDomain, setDefaultDomain] = useState("");
  const [notifyError, setNotifyError] = useState("");
  const [testEmailInput, setTestEmailInput] = useState("armaan002609@gmail.com");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState("");

  const [availableBranches, setAvailableBranches] = useState<string[]>([]);

  const [lookupRollNumber, setLookupRollNumber] = useState("");
  const [lookupStudent, setLookupStudent] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");

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
    } catch (e) {
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

  const handleToggleExpand = async (id: string) => {
    if (expandedAssignmentId === id) {
      setExpandedAssignmentId(null);
      setAssignmentDetails(null);
      return;
    }
    
    setExpandedAssignmentId(id);
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

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this assignment?")) return;
    try {
      const res = await fetch(`/api/admin/assignments/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAssignments();
        if (expandedAssignmentId === id) setExpandedAssignmentId(null);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete");
      }
    } catch(e) {
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
        setEditingAssignment(null);
        fetchAssignments();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update");
      }
    } catch(e) {
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
    if (completionFilter === 'pending') {
      return a.completedCount < a.totalAssigned;
    }
    if (completionFilter === 'completed') {
      return a.totalAssigned > 0 && a.completedCount === a.totalAssigned;
    }
    return true;
  });

  const toggleSelectAssignment = (id: string) => {
    setSelectedAssignmentIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = filteredAssignments.map(a => a.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedAssignmentIds.includes(id));
    if (allSelected) {
      setSelectedAssignmentIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedAssignmentIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleOpenBulkModal = async (ids: string[]) => {
    if (ids.length === 0) return;
    setTargetAssignmentIds(ids);
    setBulkModalOpen(true);
    setBulkPreviewData(null);
    setNotificationResult(null);
    setNotifyError("");
    setTestSuccessMessage("");
    setLoadingBulkPreview(true);

    try {
      const res = await fetch("/api/admin/assignments/bulk-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentIds: ids,
          defaultDomain: defaultDomain.trim(),
          previewOnly: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBulkPreviewData(data);
      } else {
        const err = await res.json().catch(() => null);
        setNotifyError(err?.error || "Failed to load preview data.");
      }
    } catch (err: any) {
      console.error("Failed to load preview:", err);
      setNotifyError(err.message || "Failed to load preview data.");
    } finally {
      setLoadingBulkPreview(false);
    }
  };

  const refreshBulkPreview = async (domainToUse: string) => {
    if (targetAssignmentIds.length === 0) return;
    setLoadingBulkPreview(true);
    try {
      const res = await fetch("/api/admin/assignments/bulk-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentIds: targetAssignmentIds,
          defaultDomain: domainToUse.trim(),
          previewOnly: true,
        }),
      });
      if (res.ok) {
        setBulkPreviewData(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBulkPreview(false);
    }
  };

  const handleCloseNotifyModal = () => {
    setBulkModalOpen(false);
    setTargetAssignmentIds([]);
    setBulkPreviewData(null);
    setNotificationResult(null);
    setNotifyError("");
    setTestSuccessMessage("");
    setIsSendingNotifications(false);
  };

  const handleSendBulkNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetAssignmentIds.length === 0) return;
    setIsSendingNotifications(true);
    setNotifyError("");
    setNotificationResult(null);

    try {
      const res = await fetch("/api/admin/assignments/bulk-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentIds: targetAssignmentIds,
          defaultDomain: defaultDomain.trim(),
          recipientMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send notifications.");
      }
      setNotificationResult(data);
    } catch (err: any) {
      setNotifyError(err.message || "Network error sending notifications.");
    } finally {
      setIsSendingNotifications(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (targetAssignmentIds.length === 0 || !testEmailInput) return;
    setIsSendingTest(true);
    setNotifyError("");
    setTestSuccessMessage("");
    try {
      const res = await fetch("/api/admin/assignments/bulk-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentIds: targetAssignmentIds,
          testEmail: testEmailInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotifyError(data.error || "Failed to send test email.");
      } else {
        setTestSuccessMessage(data.message || `Test email successfully sent to ${testEmailInput}! Check your inbox.`);
      }
    } catch (e: any) {
      setNotifyError(e.message || "Failed to send test email.");
    } finally {
      setIsSendingTest(false);
    }
  };

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

  return (
    <div className="dashboard-layout">
      <nav className="topnav">
        <div className="topnav-brand">
          <Link href="/" className="icon-btn" style={{background: 'transparent', textDecoration: 'none', color: 'inherit'}} title="Back to Dashboard">
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
            <div style={{opacity: 0.9, fontSize: '0.9rem', marginTop: 4, maxWidth: '280px', lineHeight: 1.4}}>
              Assign LeetCode questions to students and track progress
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
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedAssignmentIds.length > 0 && (
                    <button
                      onClick={() => handleOpenBulkModal(selectedAssignmentIds)}
                      className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 14px' }}
                    >
                      <Mail size={14} /> Send Reminder ({selectedAssignmentIds.length})
                    </button>
                  )}
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

              {/* Selection Action Banner */}
              {selectedAssignmentIds.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'linear-gradient(135deg, #a40e19 0%, #7d0b13 100%)',
                  color: 'white', padding: '12px 18px', margin: '0 16px 14px 16px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 14px rgba(164, 14, 25, 0.25)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ background: 'rgba(255, 255, 255, 0.2)', color: 'white', border: '1px solid rgba(255, 255, 255, 0.35)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, fontSize: '0.78rem' }}>
                      {selectedAssignmentIds.length} Selected
                    </span>
                    <span style={{ fontSize: '0.85rem' }}>
                      Selected for single-send email reminder (bundled via BCC into <strong>1 single email</strong>).
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button 
                      onClick={() => setSelectedAssignmentIds([])}
                      style={{ background: 'rgba(255, 255, 255, 0.15)', color: 'white', border: '1px solid rgba(255, 255, 255, 0.3)', borderRadius: '6px', fontSize: '0.78rem', padding: '5px 12px', cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => handleOpenBulkModal(selectedAssignmentIds)}
                      style={{ background: 'white', color: 'var(--primary)', border: 'none', borderRadius: '6px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 14px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                    >
                      <Mail size={14} /> Send Reminder ({selectedAssignmentIds.length} {selectedAssignmentIds.length === 1 ? 'Question' : 'Questions'})
                    </button>
                  </div>
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
                      <th style={{ width: '42px', padding: '12px 8px 12px 16px', textAlign: 'center' }}>
                        <input 
                          type="checkbox"
                          checked={filteredAssignments.length > 0 && filteredAssignments.every(a => selectedAssignmentIds.includes(a.id))}
                          onChange={toggleSelectAll}
                          title="Select / Deselect all visible questions"
                          style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--primary)' }}
                        />
                      </th>
                      <th style={{padding: '12px 16px'}}>Question</th>
                      <th style={{padding: '12px 16px'}}>Target</th>
                      <th style={{padding: '12px 16px'}}>Completion</th>
                      <th style={{padding: '12px 16px', textAlign: 'right'}}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssignments.map(a => (
                      <React.Fragment key={a.id}>
                        <tr onClick={() => handleToggleExpand(a.id)} style={{ cursor: 'pointer', borderBottom: expandedAssignmentId === a.id ? 'none' : '1px solid var(--surface-border)' }}>
                          <td style={{ width: '42px', padding: '12px 8px 12px 16px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox"
                              checked={selectedAssignmentIds.includes(a.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleSelectAssignment(a.id);
                              }}
                              style={{ cursor: 'pointer', width: 16, height: 16, accentColor: 'var(--primary)' }}
                            />
                          </td>
                          <td style={{padding: '12px 16px', fontWeight: 500}}>
                            <a href={`https://leetcode.com/problems/${a.titleSlug}/`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{color: 'var(--primary)', textDecoration: 'none'}}>
                              {a.title}
                            </a>
                          </td>
                          <td style={{padding: '12px 16px'}}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                              {a.targetBranch ? `${a.targetBranch} ` : 'All Branches '}
                              {a.targetSection ? `(${a.targetSection})` : ''}
                            </span>
                          </td>
                          <td style={{padding: '12px 16px', color: 'var(--muted)'}}>
                            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                              <span>{a.completedCount} / {a.totalAssigned}</span>
                              <div style={{width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden'}}>
                                <div style={{height: '100%', background: 'var(--primary)', width: `${a.totalAssigned > 0 ? (a.completedCount / a.totalAssigned) * 100 : 0}%`}}></div>
                              </div>
                            </div>
                          </td>
                          <td style={{padding: '12px 16px', textAlign: 'right', fontSize: '0.85rem', color: 'var(--muted)'}}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                              <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleOpenBulkModal([a.id]); }}
                                className="icon-btn"
                                title="Send Email Reminder to Pending Students"
                                style={{ color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                              >
                                <Mail size={16} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); openEditModal(a); }}
                                className="icon-btn"
                                title="Edit"
                                style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 }}
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
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
                        {expandedAssignmentId === a.id && (
                          <tr>
                            <td colSpan={5} style={{ padding: '0 16px 24px 16px', background: 'var(--surface)' }}>
                              <div style={{ border: '1px solid var(--surface-border)', borderRadius: '8px', overflow: 'hidden' }}>
                                {loadingDetails ? (
                                  <div style={{ padding: '24px' }}>
                                    <div className="skeleton-row" style={{ width: '100%', marginBottom: '12px' }}></div>
                                    <div className="skeleton-row" style={{ width: '80%', marginBottom: '12px' }}></div>
                                    <div className="skeleton-row" style={{ width: '90%' }}></div>
                                  </div>
                                ) : assignmentDetails ? (() => {
                                  const pendingCount = assignmentDetails.studentAssignments.filter((sa: any) => sa.status === 'pending').length;
                                  const completedCount = assignmentDetails.studentAssignments.filter((sa: any) => sa.status === 'completed').length;
                                  const visibleAssignments = assignmentDetails.studentAssignments.filter((sa: any) => {
                                    if (expandedStatusFilter === 'pending') return sa.status === 'pending';
                                    if (expandedStatusFilter === 'completed') return sa.status === 'completed';
                                    return true;
                                  });

                                  return (
                                    <div>
                                      <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                          <div style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>
                                            <strong style={{ color: '#0f172a' }}>{pendingCount}</strong> pending / <strong>{assignmentDetails.studentAssignments.length}</strong> total assigned
                                          </div>
                                          <div style={{ display: 'inline-flex', alignItems: 'center', background: '#e2e8f0', padding: '2px', borderRadius: '6px', gap: '2px' }}>
                                            <button
                                              type="button"
                                              onClick={() => setExpandedStatusFilter('all')}
                                              style={{
                                                padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '4px', border: 'none', cursor: 'pointer',
                                                background: expandedStatusFilter === 'all' ? 'white' : 'transparent',
                                                color: expandedStatusFilter === 'all' ? 'var(--primary)' : 'var(--muted)',
                                                boxShadow: expandedStatusFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                              }}
                                            >
                                              All ({assignmentDetails.studentAssignments.length})
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setExpandedStatusFilter('pending')}
                                              style={{
                                                padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '4px', border: 'none', cursor: 'pointer',
                                                background: expandedStatusFilter === 'pending' ? 'white' : 'transparent',
                                                color: expandedStatusFilter === 'pending' ? '#d97706' : 'var(--muted)',
                                                boxShadow: expandedStatusFilter === 'pending' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                              }}
                                            >
                                              Pending ({pendingCount})
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setExpandedStatusFilter('completed')}
                                              style={{
                                                padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, borderRadius: '4px', border: 'none', cursor: 'pointer',
                                                background: expandedStatusFilter === 'completed' ? 'white' : 'transparent',
                                                color: expandedStatusFilter === 'completed' ? '#059669' : 'var(--muted)',
                                                boxShadow: expandedStatusFilter === 'completed' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                                              }}
                                            >
                                              Done ({completedCount})
                                            </button>
                                          </div>
                                        </div>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleOpenBulkModal([a.id]); }}
                                          className="btn btn-primary"
                                          style={{ fontSize: '0.82rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                          <Mail size={14} /> Send Email Reminder ({pendingCount} Pending)
                                        </button>
                                      </div>
                                      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                        <table className="data-table" style={{ margin: 0 }}>
                                          <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--background)' }}>
                                            <tr>
                                              <th style={{padding: '8px 16px'}}>Roll Number</th>
                                              <th style={{padding: '8px 16px'}}>Name</th>
                                              <th style={{padding: '8px 16px'}}>Email</th>
                                              <th style={{padding: '8px 16px'}}>Section</th>
                                              <th style={{padding: '8px 16px'}}>Status</th>
                                              <th style={{padding: '8px 16px'}}>Completed At</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {visibleAssignments.length === 0 ? (
                                              <tr>
                                                <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: '0.88rem' }}>
                                                  No {expandedStatusFilter} students found for this assignment.
                                                </td>
                                              </tr>
                                            ) : visibleAssignments.map((sa: any) => (
                                              <tr key={sa.student.id}>
                                                <td style={{padding: '8px 16px'}}>{sa.student.rollNumber}</td>
                                                <td style={{padding: '8px 16px'}}>{sa.student.name}</td>
                                                <td style={{padding: '8px 16px', color: 'var(--muted)', fontSize: '0.85rem'}}>
                                                  {sa.student.email ? (
                                                    <span style={{ color: 'var(--primary)' }}>{sa.student.email}</span>
                                                  ) : (
                                                    <span style={{ opacity: 0.5 }}>-</span>
                                                  )}
                                                </td>
                                                <td style={{padding: '8px 16px'}}>{sa.student.branch || ''} {sa.student.section || ''}</td>
                                                <td style={{padding: '8px 16px'}}>
                                                  <span className={`status-badge ${sa.status === 'completed' ? 'success' : 'pending'}`}>
                                                    {sa.status === 'completed' ? 'Done' : 'Pending'}
                                                  </span>
                                                </td>
                                                <td style={{padding: '8px 16px', color: 'var(--muted)', fontSize: '0.85rem'}}>
                                                  {sa.completedAt ? new Intl.DateTimeFormat('en-IN', {
                                                    timeZone: 'Asia/Kolkata',
                                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                                                    hour12: true
                                                  }).format(new Date(sa.completedAt)) : '-'}
                                                </td>
                                              </tr>
                                            ))}
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
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
            
            </div>

            {/* Right Column: Student Lookup */}
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
              <button onClick={() => setEditingAssignment(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={20}/></button>
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

      {/* Email Notification Reminder Modal (Multi-Question & Single-Send BCC) */}
      {bulkModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '580px', boxShadow: 'var(--shadow-xl)', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'rgba(164, 14, 25, 0.08)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                    {targetAssignmentIds.length === 1 ? 'Send Email Reminder (1 Question)' : `Send Bulk Reminder (${targetAssignmentIds.length} Questions)`}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>
                    From: <strong style={{ color: '#0f172a' }}>leetcodetrackernotify@gmail.com</strong>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleCloseNotifyModal} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
              >
                <X size={20}/>
              </button>
            </div>

            {/* Single Email / BCC Notice */}
            <div style={{ background: 'rgba(164, 14, 25, 0.04)', border: '1px solid rgba(164, 14, 25, 0.18)', borderRadius: '8px', padding: '12px 14px', marginBottom: '18px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ color: 'var(--primary)', marginTop: '2px' }}><CheckCircle2 size={18} /></div>
              <div style={{ fontSize: '0.82rem', color: '#7d0b13', lineHeight: 1.5 }}>
                <strong>Single Email Dispatch:</strong> All student recipients are bundled into the same email dispatch via <strong>BCC</strong>. This counts as <strong>only 1 email send</strong> towards your daily quota, and ensures complete student email privacy.
              </div>
            </div>

            {/* Selected Questions List */}
            <div style={{ background: '#f8fafc', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', maxHeight: '140px', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '8px' }}>
                Selected Questions ({targetAssignmentIds.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {targetAssignmentIds.map((id, index) => {
                  const a = assignments.find(x => x.id === id);
                  const title = a?.title || a?.titleSlug || id;
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span><strong>#{index + 1}</strong> {title}</span>
                      {a?.titleSlug && (
                        <a href={`https://leetcode.com/problems/${a.titleSlug}/`} target="_blank" rel="noreferrer" style={{ fontSize: '0.78rem', color: 'var(--primary)', textDecoration: 'none' }}>
                          View &rarr;
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {notifyError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} />
                <span>{notifyError}</span>
              </div>
            )}

            {notificationResult ? (
              <div>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontWeight: 700, fontSize: '1rem', marginBottom: '8px' }}>
                    <CheckCircle2 size={20} />
                    <span>Notification Run Completed!</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '12px', textAlign: 'center' }}>
                    <div style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid rgba(164, 14, 25, 0.2)' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>{notificationResult.emailsSent}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Email Sent (Counts as 1)</div>
                    </div>
                    <div style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#059669' }}>{notificationResult.totalRecipients}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Students Reached</div>
                    </div>
                    <div style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid var(--surface-border)' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--muted)' }}>{notificationResult.skippedNoEmail}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>No Email</div>
                    </div>
                  </div>
                </div>

                {notificationResult.skippedNoEmail > 0 && (
                  <div style={{ marginBottom: '20px', fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                    <div style={{ marginBottom: '6px', color: '#0f172a' }}>
                      <strong>Why were {notificationResult.skippedNoEmail} students skipped?</strong>
                    </div>
                    <div>
                      These students do not have an email stored in the database. You can upload an Excel/CSV file with student emails or enter them manually on the Student Emails page.
                    </div>
                    <div style={{ marginTop: '12px' }}>
                      <Link 
                        href="/admin/emails" 
                        className="btn btn-outline" 
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px', textDecoration: 'none' }}
                      >
                        <Mail size={14} /> Open Student Emails Page &rarr;
                      </Link>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button 
                    type="button" 
                    onClick={handleCloseNotifyModal} 
                    className="btn btn-primary"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendBulkNotifications} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Live Preview Stats */}
                {loadingBulkPreview ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                    Calculating unique pending students across selected questions...
                  </div>
                ) : bulkPreviewData ? (
                  <div style={{ background: '#f8fafc', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
                      <div style={{ background: 'white', padding: '10px 8px', borderRadius: '6px', border: '1px solid rgba(164, 14, 25, 0.2)' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>{bulkPreviewData.totalUniquePendingStudents}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Pending Students</div>
                      </div>
                      <div style={{ background: 'white', padding: '10px 8px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#16a34a' }}>{bulkPreviewData.totalRecipientsWithEmail}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>With Email in DB</div>
                      </div>
                      <div style={{ background: 'white', padding: '10px 8px', borderRadius: '6px', border: '1px solid var(--surface-border)' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--muted)' }}>{bulkPreviewData.skippedNoEmailCount}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Missing Email</div>
                      </div>
                    </div>
                    <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#475569', textAlign: 'center' }}>
                      Will be sent in <strong>{bulkPreviewData.estimatedBatches} email message{bulkPreviewData.estimatedBatches > 1 ? 's' : ''}</strong> (counts as only <strong>{bulkPreviewData.estimatedBatches} email send</strong> towards your daily Gmail quota).
                    </div>
                  </div>
                ) : null}

                {/* College Domain Fallback */}
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                    College Domain Fallback (Optional)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      value={defaultDomain}
                      onChange={(e) => setDefaultDomain(e.target.value)}
                      placeholder="e.g. college.edu"
                      style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--surface-border)', fontSize: '0.85rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => refreshBulkPreview(defaultDomain)}
                      className="btn btn-outline"
                      style={{ padding: '8px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    >
                      Apply Fallback
                    </button>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.4 }}>
                    If a student doesn&apos;t have an email in the database, the system will fallback to <code>[RollNumber]@[domain]</code>.
                  </div>
                </div>

                {/* Delivery Mode: BCC vs CC */}
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', fontWeight: 600 }}>
                    Delivery Mode
                  </label>
                  <div style={{ display: 'flex', gap: '20px', fontSize: '0.85rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="recipientMode" 
                        value="bcc" 
                        checked={recipientMode === 'bcc'} 
                        onChange={() => setRecipientMode('bcc')} 
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <span><strong>BCC</strong> (Recommended &bull; Keeps emails private)</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        name="recipientMode" 
                        value="cc" 
                        checked={recipientMode === 'cc'} 
                        onChange={() => setRecipientMode('cc')} 
                        style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <span><strong>CC</strong> (All emails visible)</span>
                    </label>
                  </div>
                </div>

                {/* Send Test Email Section */}
                <div style={{ background: '#f8fafc', border: '1px dashed var(--surface-border)', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Send Test Preview Email to Yourself
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '8px' }}>
                    Verify how the digest email looks in your inbox before sending to students.
                  </div>
                  {testSuccessMessage && (
                    <div style={{ color: '#059669', fontSize: '0.82rem', marginBottom: '8px', fontWeight: 500 }}>
                      ✅ {testSuccessMessage}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="email"
                      value={testEmailInput}
                      onChange={(e) => setTestEmailInput(e.target.value)}
                      placeholder="armaan002609@gmail.com"
                      style={{ flex: 1, padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--surface-border)', fontSize: '0.85rem' }}
                    />
                    <button
                      type="button"
                      disabled={isSendingTest || !testEmailInput}
                      onClick={handleSendTestEmail}
                      className="btn btn-outline"
                      style={{ padding: '8px 12px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
                    >
                      {isSendingTest ? "Sending..." : "Send Test Email"}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '6px' }}>
                  <button 
                    type="button" 
                    onClick={handleCloseNotifyModal} 
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSendingNotifications || (bulkPreviewData && bulkPreviewData.totalRecipientsWithEmail === 0 && !defaultDomain)} 
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {isSendingNotifications ? (
                      <>
                        <div className="animate-spin" style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
                        <span>Sending Single Email via {recipientMode.toUpperCase()}...</span>
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        <span>Send Reminders ({bulkPreviewData?.totalRecipientsWithEmail || 0} Students &bull; 1 Email)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

