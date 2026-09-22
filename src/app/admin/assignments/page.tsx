"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, BookOpen, Trash2, Users, Download } from "lucide-react";
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && (session?.user as any)?.role !== 'admin') {
      router.push("/");
    } else if (status === "authenticated") {
      fetchAssignments();
    }
  }, [status, router, session]);

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
    return <div className="p-8 text-center">Loading...</div>;
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
            <div style={{opacity: 0.9, fontSize: '0.9rem', marginTop: 4}}>
              Assign LeetCode questions to students and track progress
            </div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Create Assignment Form */}
            <div className="dashboard-card" style={{ margin: 0, alignSelf: 'start', width: '100%', maxWidth: '600px' }}>
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
                    <input 
                      type="text" 
                      value={targetBranch}
                      onChange={(e) => setTargetBranch(e.target.value)}
                      placeholder="e.g. CSE"
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                    />
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
                              <a 
                                href={`/api/admin/assignments/${a.id}/export`}
                                download
                                onClick={e => e.stopPropagation()}
                                title="Download Report"
                                className="icon-btn"
                                style={{ color: 'var(--primary)', textDecoration: 'none' }}
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
                                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>Loading students...</div>
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
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

