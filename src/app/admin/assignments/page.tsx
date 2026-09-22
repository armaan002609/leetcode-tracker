"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, BookOpen, Trash2, Users, Download, Edit2, X } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AssignmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
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
      const res = await fetch("/api/admin/assignments");
      if (res.ok) {
        setAssignments(await res.json());
      }
    } catch (e) {
      console.error(e);
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
          <Link href="/" className="icon-btn" style={{background: 'transparent', textDecoration: 'none', color: 'inherit'}}>
            <ArrowLeft size={20} />
          </Link>
          <div className="topnav-brand-icon">L</div>
          <span>Assignments</span>
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
              <div className="card-header">
                <h3 className="card-title">All Assignments</h3>
              </div>
              {assignments.length === 0 ? (
                <div className="p-8 text-center text-muted">No assignments created yet.</div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{padding: '12px 16px'}}>Question</th>
                      <th style={{padding: '12px 16px'}}>Target</th>
                      <th style={{padding: '12px 16px'}}>Completion</th>
                      <th style={{padding: '12px 16px', textAlign: 'right'}}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(a => (
                      <React.Fragment key={a.id}>
                        <tr onClick={() => handleToggleExpand(a.id)} style={{ cursor: 'pointer', borderBottom: expandedAssignmentId === a.id ? 'none' : '1px solid var(--surface-border)' }}>
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
                            <td colSpan={4} style={{ padding: '0 16px 24px 16px', background: 'var(--surface)' }}>
                              <div style={{ border: '1px solid var(--surface-border)', borderRadius: '8px', overflow: 'hidden' }}>
                                {loadingDetails ? (
                                  <div style={{ padding: '24px' }}>
                                    <div className="skeleton-row" style={{ width: '100%', marginBottom: '12px' }}></div>
                                    <div className="skeleton-row" style={{ width: '80%', marginBottom: '12px' }}></div>
                                    <div className="skeleton-row" style={{ width: '90%' }}></div>
                                  </div>
                                ) : assignmentDetails ? (
                                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    <table className="data-table" style={{ margin: 0 }}>
                                      <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--background)' }}>
                                        <tr>
                                          <th style={{padding: '8px 16px'}}>Roll Number</th>
                                          <th style={{padding: '8px 16px'}}>Name</th>
                                          <th style={{padding: '8px 16px'}}>Section</th>
                                          <th style={{padding: '8px 16px'}}>Status</th>
                                          <th style={{padding: '8px 16px'}}>Completed At</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {assignmentDetails.studentAssignments.map((sa: any) => (
                                          <tr key={sa.student.id}>
                                            <td style={{padding: '8px 16px'}}>{sa.student.rollNumber}</td>
                                            <td style={{padding: '8px 16px'}}>{sa.student.name}</td>
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
                                ) : (
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
    </div>
  );
}

