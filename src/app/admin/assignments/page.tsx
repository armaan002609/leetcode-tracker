"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Plus, BookOpen, Trash2, Users } from "lucide-react";
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
            
            {/* Create Assignment Form */}
            <div className="dashboard-card" style={{ margin: 0, alignSelf: 'start' }}>
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
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Target Branch (Optional)</label>
                  <input 
                    type="text" 
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    placeholder="e.g. CSE"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Target Section (Optional)</label>
                  <input 
                    type="text" 
                    value={targetSection}
                    onChange={(e) => setTargetSection(e.target.value)}
                    placeholder="e.g. A"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                  />
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
                      <tr key={a.id}>
                        <td style={{padding: '12px 16px', fontWeight: 500}}>
                          <a href={`https://leetcode.com/problems/${a.titleSlug}/`} target="_blank" rel="noreferrer" style={{color: 'var(--primary)', textDecoration: 'none'}}>
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
                          {new Date(a.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
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
