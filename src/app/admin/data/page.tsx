"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Search, Database, ChevronLeft, Download } from 'lucide-react';
import Link from 'next/link';

export default function DataExplorer() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("All Branches");
  const [section, setSection] = useState("");

  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchBranches = async () => {
    try {
      const res = await fetch('/api/admin/branches');
      if (res.ok) {
        setAvailableBranches(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch branches");
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        search,
        branch,
        section
      });
      const res = await fetch(`/api/admin/data?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.students);
        setTotalPages(json.pagination.totalPages);
        setTotalRecords(json.pagination.total);
      } else {
        setError("Failed to fetch data.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, branch, section]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchBranches();
      fetchData();
    }
  }, [status, fetchData]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  if (status === "loading" || (loading && data.length === 0)) {
    return <div className="loading-spinner" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <nav className="topnav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/admin/assignments" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', textDecoration: 'none', fontWeight: 500 }}>
            <ChevronLeft size={20} /> Back to Dashboard
          </Link>
        </div>
      </nav>

      <main className="main-content">
        <div className="curved-banner-container">
          <div className="curved-banner"></div>
        </div>
        <div className="profile-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="profile-avatar">
              <Database size={32} />
            </div>
            <div className="profile-info">
              <h2>Full Data Explorer</h2>
              <div style={{opacity: 0.9, fontSize: '0.9rem', marginTop: 4}}>
                Browse {totalRecords} total student records and their complete submission history.
              </div>
            </div>
          </div>
          <div style={{ paddingRight: '24px' }}>
            <a href="/api/admin/submissions/export" download className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={18} /> Download CSV
            </a>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          <div className="dashboard-card" style={{ margin: 0, width: '100%' }}>
            
            <div style={{ padding: '24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 300px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Search Name or Roll Number</label>
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                  <input 
                    type="text" 
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search..."
                    style={{ width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                  />
                </div>
              </div>
              
              <div style={{ flex: '0 1 200px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Branch</label>
                <select 
                  value={branch}
                  onChange={e => { setBranch(e.target.value); setPage(1); }}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'var(--surface)' }}
                >
                  <option value="All Branches">All Branches</option>
                  {availableBranches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: '0 1 150px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Section</label>
                <input 
                  type="text" 
                  value={section}
                  onChange={e => { setSection(e.target.value); setPage(1); }}
                  placeholder="e.g. A"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                />
              </div>
            </div>

            {error && <div style={{ padding: '24px', color: 'var(--destructive)' }}>{error}</div>}

            <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto' }}>
              <table className="table" style={{ borderBottom: 'none', width: '100%', tableLayout: 'auto' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface)' }}>
                  <tr>
                    <th style={{ width: '40px', padding: '16px 8px' }}></th>
                    <th style={{ padding: '16px', minWidth: '100px' }}>Roll No</th>
                    <th style={{ padding: '16px', minWidth: '200px' }}>Name</th>
                    <th style={{ padding: '16px', minWidth: '150px' }}>Branch / Sec</th>
                    <th style={{ padding: '16px', minWidth: '150px' }}>LeetCode ID</th>
                    <th style={{ padding: '16px', minWidth: '120px' }}>Total Solved</th>
                    <th style={{ padding: '16px', minWidth: '150px' }}>Difficulty</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((student) => (
                    <React.Fragment key={student.id}>
                      <tr 
                        style={{ cursor: 'pointer', background: expandedRows[student.id] ? 'var(--background)' : 'transparent' }}
                        onClick={() => toggleRow(student.id)}
                      >
                        <td style={{ textAlign: 'center', color: 'var(--muted)', padding: '16px 8px' }}>
                          {expandedRows[student.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </td>
                        <td style={{ fontWeight: 600, padding: '16px' }}>{student.rollNumber}</td>
                        <td style={{ fontWeight: 600, color: 'var(--primary)', padding: '16px' }}>{student.name}</td>
                        <td style={{ padding: '16px' }}>{student.branch || '-'} {student.section ? `(${student.section})` : ''}</td>
                        <td style={{ padding: '16px' }}>
                          <a href={student.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                            {student.url.split('/').filter(Boolean).pop()}
                          </a>
                        </td>
                        <td style={{ fontWeight: 700, padding: '16px' }}>{student.totalSolved || 0}</td>
                        <td style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', gap: '12px', fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--success)' }}>E: {student.easySolved || 0}</span>
                            <span style={{ color: 'var(--warning)' }}>M: {student.mediumSolved || 0}</span>
                            <span style={{ color: 'var(--destructive)' }}>H: {student.hardSolved || 0}</span>
                          </div>
                        </td>
                      </tr>
                      {expandedRows[student.id] && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid var(--surface-border)' }}>
                            <div style={{ padding: '24px', background: 'var(--background)', borderLeft: '4px solid var(--primary)' }}>
                              <h4 style={{ margin: '0 0 16px 0', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Complete Submission History (DB Records: {student.submissions?.length || 0})</span>
                              </h4>
                              
                              {student.submissions && student.submissions.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '12px' }}>
                                  {student.submissions.map((sub: any) => (
                                    <div key={sub.id} style={{ padding: '12px', background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      <a href={`https://leetcode.com/problems/${sub.titleSlug}/`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>
                                        {sub.title}
                                      </a>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                        <span style={{ 
                                          fontWeight: 600,
                                          color: sub.difficulty === 'Easy' ? 'var(--success)' : sub.difficulty === 'Medium' ? 'var(--warning)' : sub.difficulty === 'Hard' ? 'var(--destructive)' : 'var(--muted)'
                                        }}>
                                          {sub.difficulty || 'Unknown'}
                                        </span>
                                        <span style={{ color: 'var(--muted)' }}>
                                          {new Intl.DateTimeFormat('en-IN', {
                                            timeZone: 'Asia/Kolkata',
                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                                            hour12: true
                                          }).format(new Date(sub.timestamp))}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ color: 'var(--muted)' }}>No submissions recorded in the database yet.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {data.length === 0 && !loading && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
                        No records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
                Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, totalRecords)} of {totalRecords} records
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-outline"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  style={{ padding: '8px 16px' }}
                >
                  Previous
                </button>
                <button 
                  className="btn btn-outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  style={{ padding: '8px 16px' }}
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
