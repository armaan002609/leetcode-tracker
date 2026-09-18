"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadJobFromSession } from "@/lib/orchestration/store";
import { useChunkedRun } from "@/lib/orchestration/useChunkedRun";
import { generateCsv, downloadCsv } from "@/lib/export/generateCsv";
import { 
  CheckCircle2, Clock, Lock, HelpCircle, 
  AlertTriangle, RotateCw, Download, Search, AlertCircle,
  Menu, User, Grid, Home, ArrowLeft, Target, Activity, Award
} from "lucide-react";
import Link from "next/link";

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'success': return <span className="status-badge success"><CheckCircle2 size={16} /> Success</span>;
    case 'partial_success': return <span className="status-badge warning"><CheckCircle2 size={16} /> Partial</span>;
    case 'private_profile': return <span className="status-badge pending"><Lock size={16} /> Private</span>;
    case 'not_found': return <span className="status-badge pending"><HelpCircle size={16} /> Not Found</span>;
    case 'rate_limited_retrying': return <span className="status-badge warning"><Clock className="animate-pulse" size={16} /> Retrying</span>;
    case 'pending': return <span className="status-badge pending"><RotateCw className="animate-spin" size={16} /> Pending</span>;
    default: return <span className="status-badge danger"><AlertTriangle size={16} /> Error</span>;
  }
};

export default function RunPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId as string;
  
  const [isReady, setIsReady] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const { 
    rows, 
    setRows,
    isRunning, 
    isCompleted, 
    globalError, 
    startRun, 
    retryFailed, 
    retryRow 
  } = useChunkedRun([]);

  useEffect(() => {
    const loadedRows = loadJobFromSession(jobId);
    if (!loadedRows) {
      router.push('/');
      return;
    }
    setRows(loadedRows);
    setIsReady(true);
  }, [jobId, router, setRows]);

  useEffect(() => {
    if (isReady && rows.every(r => r.status === 'pending') && !isRunning && !isCompleted) {
      startRun();
    }
  }, [isReady, rows, isRunning, isCompleted, startRun]);

  const handleExport = () => {
    const csv = generateCsv(rows);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsv(csv, `leetcode_tracker_export_${dateStr}.csv`);
  };

  const processedCount = rows.filter(r => r.status !== 'pending' && r.status !== 'rate_limited_retrying').length;
  const successCount = rows.filter(r => r.status === 'success' || r.status === 'partial_success').length;
  const failCount = rows.filter(r => ['timeout', 'unknown_error', 'not_found', 'invalid_url'].includes(r.status)).length;

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            r.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'success' && (r.status === 'success' || r.status === 'partial_success')) ||
                            (statusFilter === 'failed' && ['timeout', 'unknown_error', 'not_found', 'invalid_url'].includes(r.status)) ||
                            (statusFilter === 'pending' && (r.status === 'pending' || r.status === 'rate_limited_retrying'));
      return matchesSearch && matchesStatus;
    });
  }, [rows, searchTerm, statusFilter]);

  const selectedStudent = useMemo(() => rows.find(r => r.id === selectedStudentId), [rows, selectedStudentId]);

  if (!isReady) return <div className="p-4 text-center"><RotateCw className="animate-spin text-muted" size={32} style={{margin: '40px auto'}} /></div>;

  return (
    <div className="dashboard-layout animate-fade-in">
      {/* Top Navigation */}
      <nav className="topnav">
        <div className="topnav-brand">
          <button className="icon-btn" style={{background: 'transparent'}}><Menu size={20} /></button>
          <div className="topnav-brand-icon">L</div>
          <span>LeetCode Tracker</span>
        </div>
        <div className="topnav-actions">
          <Link href="/" className="icon-btn" title="Home"><Home size={18} /></Link>
          <button className="icon-btn"><Search size={18} /></button>
          <button className="icon-btn"><Grid size={18} /></button>
          <div style={{width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <User size={18} color="#64748b" />
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="curved-banner-container">
          <div className="curved-banner"></div>
        </div>

        {selectedStudent ? (
          <div className="profile-banner">
            <div className="profile-avatar">
              <User size={32} />
            </div>
            <div className="profile-info">
              <h2>{selectedStudent.name}</h2>
              <div style={{opacity: 0.8, fontSize: '0.9rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6}}>
                <div style={{width: 24, height: 24, background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <span style={{color: 'var(--primary)', fontWeight: 'bold', fontSize: 12}}>L</span>
                </div>
                Roll No: {selectedStudent.rollNumber} | Mentor: {selectedStudent.mentor}
              </div>
            </div>
            
            <div className="quick-stats-bar" style={{display: 'flex', gap: '48px', marginLeft: 'auto', background: 'transparent', alignItems: 'center'}}>
              <button 
                onClick={() => setSelectedStudentId(null)}
                className="btn hover:bg-white/10"
                style={{background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)'}}
              >
                <ArrowLeft size={16} /> Back to Batch Overview
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-banner">
            <div className="profile-avatar">
              <User size={32} />
            </div>
            <div className="profile-info">
              <h2>Batch Overview</h2>
              <div style={{opacity: 0.8, fontSize: '0.9rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6}}>
                <div style={{width: 24, height: 24, background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <span style={{color: 'var(--primary)', fontWeight: 'bold', fontSize: 12}}>L</span>
                </div>
                Batch Dashboard
              </div>
            </div>
            
            <div className="quick-stats-bar" style={{display: 'flex', gap: '48px', marginLeft: 'auto', background: 'transparent'}}>
              <div className="quick-stat">
                <span className="quick-stat-label text-white opacity-80" style={{color: 'white', opacity: 0.8}}>Processed</span>
                <span className="quick-stat-value text-white">{processedCount} <span style={{opacity: 0.7, fontSize: '0.85em'}}>/ {rows.length}</span></span>
              </div>
              <div className="quick-stat">
                <span className="quick-stat-label text-white opacity-80" style={{color: 'white', opacity: 0.8}}>Success Rate</span>
                <span className="quick-stat-value text-white">{rows.length > 0 ? Math.round((successCount / rows.length) * 100) : 0}%</span>
              </div>
              <div className="quick-stat">
                <span className="quick-stat-label text-white opacity-80" style={{color: 'white', opacity: 0.8}}>Job Status 
                  <span className="badge" style={{background: isRunning ? 'var(--warning)' : isCompleted ? 'var(--success)' : '#ffffff33'}}>{isRunning ? 'RUNNING' : isCompleted ? 'COMPLETE' : 'PAUSED'}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 4 Metric Cards */}
        {selectedStudent ? (
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon-wrapper">
                <Target size={24} />
              </div>
              <h3 className="metric-title">Total Solved</h3>
              <div className="metric-stats">
                <div className="metric-stat-row">
                  <span>Problems Solved</span>
                  <div className="metric-circle blue">{selectedStudent.total_solved ?? '-'}</div>
                </div>
                <div className="metric-stat-row">
                  <span>Global Rank</span>
                  <span className="font-bold">{selectedStudent.global_rank?.toLocaleString() ?? '-'}</span>
                </div>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon-wrapper">
                <Activity size={24} />
              </div>
              <h3 className="metric-title">Difficulty</h3>
              <div className="metric-stats">
                <div className="metric-stat-row">
                  <span>Easy</span>
                  <div className="metric-circle green">{selectedStudent.easy_solved ?? '-'}</div>
                </div>
                <div className="metric-stat-row">
                  <span>Medium</span>
                  <div className="metric-circle yellow">{selectedStudent.medium_solved ?? '-'}</div>
                </div>
                <div className="metric-stat-row">
                  <span>Hard</span>
                  <div className="metric-circle red">{selectedStudent.hard_solved ?? '-'}</div>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-wrapper">
                <Clock size={24} />
              </div>
              <h3 className="metric-title">Recent Activity</h3>
              <div className="metric-stats">
                <div className="metric-stat-row">
                  <span>Solved Today</span>
                  <div className="metric-circle blue">{selectedStudent.solved_today ?? '-'}</div>
                </div>
                <div className="metric-stat-row">
                  <span>Scrape Status</span>
                  <StatusIcon status={selectedStudent.status} />
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-wrapper">
                <Award size={24} />
              </div>
              <h3 className="metric-title">Achievements</h3>
              <div className="metric-stats">
                <div className="metric-stat-row">
                  <span>Badges Earned</span>
                  <div className="metric-circle yellow">{selectedStudent.badges ?? '-'}</div>
                </div>
                {selectedStudent.url && (
                  <div className="metric-stat-row" style={{marginTop: 8}}>
                    <a href={selectedStudent.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm font-medium">View LeetCode Profile ↗</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon-wrapper">
                <Grid size={24} />
              </div>
              <h3 className="metric-title">Total Profiles</h3>
              <div className="metric-stats">
                <div className="metric-stat-row">
                  <span>Batch Size</span>
                  <div className="metric-circle blue">{rows.length}</div>
                </div>
              </div>
            </div>
            
            <div className="metric-card">
              <div className="metric-icon-wrapper">
                <RotateCw size={24} />
              </div>
              <h3 className="metric-title">Progress</h3>
              <div className="metric-stats">
                <div className="metric-stat-row">
                  <span>Processed</span>
                  <div className="metric-circle blue">{processedCount}</div>
                </div>
                <div className="metric-stat-row">
                  <span>Pending</span>
                  <div className="metric-circle gray">{rows.length - processedCount}</div>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-wrapper">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="metric-title">Success</h3>
              <div className="metric-stats">
                <div className="metric-stat-row">
                  <span>Successfully Scraped</span>
                  <div className="metric-circle green">{successCount}</div>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-wrapper">
                <AlertTriangle size={24} />
              </div>
              <h3 className="metric-title">Failures</h3>
              <div className="metric-stats">
                <div className="metric-stat-row">
                  <span>Errors / Not Found</span>
                  <div className="metric-circle red">{failCount}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {globalError && (
          <div className="dashboard-card mb-6" style={{borderLeft: '4px solid var(--danger)'}}>
            <div className="card-body flex gap-3 items-center">
              <AlertCircle className="text-danger shrink-0" size={24} />
              <div>
                <h4 className="font-medium mb-1 text-danger">Batch Paused</h4>
                <p className="text-sm text-muted">{globalError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Data Table Card */}
        <div className="dashboard-card">
          <div className="card-header" style={{flexWrap: 'wrap', gap: '16px', flexDirection: 'column', alignItems: 'flex-start'}}>
            <h3 className="card-title" style={{marginBottom: '16px'}}>Scraper Results</h3>
            <div className="table-actions" style={{width: '100%'}}>
              <div className="search-wrapper" style={{position: 'relative', flex: '1 1 min-content'}}>
                <Search size={16} className="text-muted" style={{position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)'}} />
                <input 
                  type="text" 
                  placeholder="Search name/roll..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{padding: '8px 12px 8px 32px', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', outline: 'none', width: '100%'}}
                />
              </div>
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{padding: '8px 12px', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', outline: 'none', background: 'white', flex: '1 1 min-content'}}
              >
                <option value="all">All Statuses</option>
                <option value="success">Success & Partial</option>
                <option value="failed">Failed & Errors</option>
                <option value="pending">Pending</option>
              </select>
              <button 
                onClick={retryFailed} 
                disabled={isRunning || failCount === 0}
                className="btn btn-outline"
                style={{flex: '1 1 auto', whiteSpace: 'nowrap'}}
              >
                <RotateCw size={16} className={isRunning ? 'animate-spin' : ''} /> Retry Failed
              </button>
              <button 
                onClick={handleExport}
                disabled={processedCount === 0}
                className="btn btn-primary"
                style={{flex: '1 1 auto', whiteSpace: 'nowrap'}}
              >
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>
          
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Roll No</th>
                  <th>Name</th>
                  <th>Branch</th>
                  <th>Semester</th>
                  <th>Section</th>
                  <th>Mentor</th>
                  <th className="text-right">Solved Today</th>
                  <th className="text-right">Total Solved</th>
                  <th className="text-right">Easy</th>
                  <th className="text-right">Medium</th>
                  <th className="text-right">Hard</th>
                  <th className="text-right">Global Rank</th>
                  <th className="text-right">Badges</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(row => {
                  const isError = ['timeout', 'unknown_error', 'not_found', 'invalid_url'].includes(row.status);
                  const isPending = row.status === 'pending' || row.status === 'rate_limited_retrying';
                  const isSelected = row.id === selectedStudentId;
                  
                  return (
                    <tr key={row.id} style={{opacity: isPending ? 0.6 : 1, background: isSelected ? 'var(--surface-hover)' : 'transparent'}}>
                      <td><StatusIcon status={row.status} /></td>
                      <td className="font-medium">{row.rollNumber}</td>
                      <td 
                        onClick={() => setSelectedStudentId(isSelected ? null : row.id)}
                        style={{color: 'var(--primary)', cursor: 'pointer', fontWeight: 500}}
                        className="hover:underline"
                        title="Click to view profile"
                      >
                        {row.name}
                      </td>
                      <td className="text-muted">{row.branch ?? '-'}</td>
                      <td className="text-muted">{row.semester ?? '-'}</td>
                      <td className="text-muted">{row.section ?? '-'}</td>
                      <td className="text-muted">{row.mentor}</td>
                      <td className="text-right font-medium">{row.solved_today ?? '-'}</td>
                      <td className="text-right font-medium">{row.total_solved ?? '-'}</td>
                      <td className="text-right text-green-500 font-medium">{row.easy_solved ?? '-'}</td>
                      <td className="text-right text-yellow-500 font-medium">{row.medium_solved ?? '-'}</td>
                      <td className="text-right text-red-500 font-medium">{row.hard_solved ?? '-'}</td>
                      <td className="text-right">{row.global_rank?.toLocaleString() ?? '-'}</td>
                      <td className="text-right">{row.badges ?? '-'}</td>
                      <td>
                        {isError && !isRunning && (
                          <button 
                            onClick={() => retryRow(row.id)}
                            className="text-primary font-medium"
                            style={{fontSize: '0.85rem'}}
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center p-8 text-muted">No rows match your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
