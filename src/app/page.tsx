"use client";

import { useEffect, useState, useMemo } from "react";
import { generateCsv, downloadCsv } from "@/lib/export/generateCsv";
import { 
  CheckCircle2, Clock, Lock, HelpCircle, 
  AlertTriangle, RotateCw, Download, Search, AlertCircle,
  Menu, User, Grid, Home, ArrowLeft, Target, Activity, Award, UploadCloud, RefreshCw, Trash2, X, LogIn, LogOut
} from "lucide-react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'success': return <span className="status-badge success"><CheckCircle2 size={16} /> Success</span>;
    case 'partial_success': return <span className="status-badge warning"><CheckCircle2 size={16} /> Partial</span>;
    case 'private_profile': return <span className="status-badge pending"><Lock size={16} /> Private</span>;
    case 'not_found': return <span className="status-badge pending"><HelpCircle size={16} /> Not Found</span>;
    case 'rate_limited_retrying': return <span className="status-badge warning"><Clock className="animate-pulse" size={16} /> Retrying</span>;
    case 'pending': return <span className="status-badge pending"><RotateCw size={16} /> Pending</span>;
    default: return <span className="status-badge danger"><AlertTriangle size={16} /> Error</span>;
  }
};

export default function Dashboard() {
  const [rows, setRows] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAdmin = (session?.user as any)?.role === 'admin';
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [assignedQuestions, setAssignedQuestions] = useState<any[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);

  // Assignment states
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserIdToAssign, setSelectedUserIdToAssign] = useState("");

  // Change Password states
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Export states
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isGoogleSheetModalOpen, setIsGoogleSheetModalOpen] = useState(false);
  const [googleSheetId, setGoogleSheetId] = useState("");
  const [googleSheetName, setGoogleSheetName] = useState("Sheet1");
  const [isExportingToSheets, setIsExportingToSheets] = useState(false);

  useEffect(() => {
    const savedId = localStorage.getItem('leetcode_tracker_sheet_id');
    if (savedId) setGoogleSheetId(savedId);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students');
      if (res.ok) {
        const data = await res.json();
        setRows(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsReady(true);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchStudents();
      if (isAdmin) {
        fetch('/api/users').then(async r => {
          if (r.ok) setUsers(await r.json());
        });
      }
    }
  }, [status, isAdmin]);

  const scrapeQueue = async (rollNumbersToScrape: string[]) => {
    if (rollNumbersToScrape.length === 0) return;
    setIsScraping(true);

    // Optimistic UI update to mark as pending
    setRows(prev => prev.map(r => rollNumbersToScrape.includes(r.rollNumber) ? { ...r, status: 'pending' } : r));

    const CHUNK_SIZE = 10;
    
    for (let i = 0; i < rollNumbersToScrape.length; i += CHUNK_SIZE) {
      const chunk = rollNumbersToScrape.slice(i, i + CHUNK_SIZE);
      
      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rollNumbers: chunk })
        });
        
        if (res.ok) {
          // Re-fetch all data to get updated stats for this chunk
          await fetchStudents();
        } else {
          console.error("Chunk failed");
        }
      } catch (e) {
        console.error(e);
      }
    }
    
    setIsScraping(false);
  };

  // Auto-start scraping for any pending rows on load
  useEffect(() => {
    if (isReady && !isScraping) {
      const pendingRolls = rows.filter(r => r.status === 'pending').map(r => r.rollNumber);
      if (pendingRolls.length > 0) {
        scrapeQueue(pendingRolls);
      }
    }
  }, [isReady, rows, isScraping]);

  const handleExport = () => {
    // Map db models back to row format for the exporter
    const exportRows = rows.map(r => ({
      ...r,
      solved_today: r.solvedToday,
      total_solved: r.totalSolved,
      easy_solved: r.easySolved,
      medium_solved: r.mediumSolved,
      hard_solved: r.hardSolved,
      global_rank: r.globalRank,
    }));
    const csv = generateCsv(exportRows);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsv(csv, `leetcode_tracker_export_${dateStr}.csv`);
    setIsExportMenuOpen(false);
  };

  const handleGoogleSheetsExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleSheetId) return;

    localStorage.setItem('leetcode_tracker_sheet_id', googleSheetId);
    setIsExportingToSheets(true);

    const exportRows = rows.map(r => ({
      ...r,
      solved_today: r.solvedToday,
      total_solved: r.totalSolved,
      easy_solved: r.easySolved,
      medium_solved: r.mediumSolved,
      hard_solved: r.hardSolved,
      global_rank: r.globalRank,
    }));

    try {
      const res = await fetch('/api/export/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: googleSheetId,
          sheetName: googleSheetName,
          data: exportRows
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Successfully exported to Google Sheets!");
        setIsGoogleSheetModalOpen(false);
      } else {
        alert(`Export failed: ${data.error}`);
      }
    } catch (err) {
      alert("An error occurred during export.");
      console.error(err);
    } finally {
      setIsExportingToSheets(false);
    }
  };

  const handleRefresh = (rollNumbers: string[]) => {
    scrapeQueue(rollNumbers);
  };

  const handleClearData = async () => {
    if (!window.confirm("Are you sure you want to delete all uploaded student data? This action cannot be undone.")) return;
    
    try {
      const res = await fetch('/api/students', { method: 'DELETE' });
      if (res.ok) {
        setRows([]); // Clear UI immediately
        setSelectedStudentId(null);
      } else {
        alert("Failed to clear data.");
      }
    } catch (e) {
      console.error("Error clearing data", e);
    }
  };

  const handleToggleSelectStudent = (rollNumber: string) => {
    setSelectedStudents(prev => 
      prev.includes(rollNumber) ? prev.filter(r => r !== rollNumber) : [...prev, rollNumber]
    );
  };

  const handleAssignStudents = async () => {
    if (!selectedUserIdToAssign) {
      alert("Please select a user to assign to.");
      return;
    }
    if (selectedStudents.length === 0) {
      alert("Please select at least one student.");
      return;
    }

    try {
      const res = await fetch('/api/students/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumbers: selectedStudents, userId: selectedUserIdToAssign })
      });
      if (res.ok) {
        alert("Students assigned successfully!");
        setSelectedStudents([]);
        fetchStudents(); // Refresh data
      } else {
        alert("Failed to assign students.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((session?.user as any)?.id === 'master-admin') {
      alert("Master Admin password must be changed in the .env file.");
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert("Password changed successfully!");
        setIsPasswordModalOpen(false);
        setCurrentPassword("");
        setNewPassword("");
      } else {
        alert(data.error || "Failed to change password");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const processedCount = rows.filter(r => r.status !== 'pending' && r.status !== 'rate_limited_retrying').length;
  const successCount = rows.filter(r => r.status === 'success' || r.status === 'partial_success').length;
  const failCount = rows.filter(r => ['timeout', 'unknown_error', 'not_found', 'invalid_url'].includes(r.status)).length;

  const uniqueBranches = useMemo(() => Array.from(new Set(rows.map(r => r.branch).filter(Boolean))).sort(), [rows]);
  const uniqueSections = useMemo(() => Array.from(new Set(rows.map(r => r.section).filter(Boolean))).sort(), [rows]);
  const uniqueSemesters = useMemo(() => Array.from(new Set(rows.map(r => r.semester).filter(Boolean))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            r.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'success' && (r.status === 'success' || r.status === 'partial_success')) ||
                            (statusFilter === 'failed' && ['timeout', 'unknown_error', 'not_found', 'invalid_url'].includes(r.status)) ||
                            (statusFilter === 'pending' && (r.status === 'pending' || r.status === 'rate_limited_retrying'));
      const matchesBranch = branchFilter === 'all' || r.branch === branchFilter;
      const matchesSection = sectionFilter === 'all' || r.section === sectionFilter;
      const matchesSemester = semesterFilter === 'all' || r.semester === semesterFilter;
      
      return matchesSearch && matchesStatus && matchesBranch && matchesSection && matchesSemester;
    });
  }, [rows, searchTerm, statusFilter, branchFilter, sectionFilter, semesterFilter]);

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, branchFilter, sectionFilter, semesterFilter]);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRows, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage);

  const selectedStudent = useMemo(() => rows.find(r => r.id === selectedStudentId), [rows, selectedStudentId]);

  useEffect(() => {
    if (selectedStudent?.url) {
      setIsLoadingSubmissions(true);
      fetch(`/api/recent-submissions?url=${encodeURIComponent(selectedStudent.url)}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setRecentSubmissions(data);
          else setRecentSubmissions([]);
        })
        .catch(e => {
          console.error(e);
          setRecentSubmissions([]);
        })
        .finally(() => setIsLoadingSubmissions(false));
        
      setIsLoadingAssignments(true);
      fetch(`/api/students/${selectedStudent.id}/assignments`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setAssignedQuestions(data);
          else setAssignedQuestions([]);
        })
        .catch(e => {
          console.error(e);
          setAssignedQuestions([]);
        })
        .finally(() => setIsLoadingAssignments(false));
    } else {
      setRecentSubmissions([]);
      setAssignedQuestions([]);
    }
  }, [selectedStudent]);

  useEffect(() => {
    if (selectedStudentId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedStudentId]);

  if (!isReady || status === "loading") return <div className="p-4 text-center"><RotateCw className="animate-spin text-muted" size={32} style={{margin: '40px auto'}} /></div>;

  return (
    <>
      <div className="dashboard-layout animate-fade-in">
        <nav className="topnav">
        <div className="topnav-brand">
          <button className="icon-btn" style={{background: 'transparent'}}><Menu size={20} /></button>
          <div className="topnav-brand-icon">L</div>
          <span>LeetCode Tracker</span>
        </div>
        <div className="topnav-actions" style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <div className="search-wrapper" style={{position: 'relative', width: '250px'}}>
            <Search size={16} className="text-muted" style={{position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)'}} />
            <input 
              type="text" 
              placeholder="Search name/roll..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{padding: '8px 12px 8px 32px', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', outline: 'none', width: '100%'}}
            />
          </div>
          {isAdmin && (
            <Link href="/upload" className="btn btn-primary" title="Upload Roster">
              <UploadCloud size={16} /> Upload Data
            </Link>
          )}
          <div style={{ position: 'relative' }}>
            <div 
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              style={{width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', transform: isUserDropdownOpen ? 'scale(0.95)' : 'scale(1)'}}
              title="User Menu"
            >
              <User size={18} color="#64748b" />
            </div>
            
            {isUserDropdownOpen && (
              <>
                <div 
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }} 
                  onClick={() => setIsUserDropdownOpen(false)} 
                />
                <div 
                  className="animate-slide-up"
                  style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'white', border: '1px solid var(--surface-border)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', minWidth: '220px', zIndex: 50, padding: '8px 0', display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{ padding: '8px 16px 12px', borderBottom: '1px solid var(--surface-border)', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{session?.user?.name || "User"}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'capitalize' }}>{(session?.user as any)?.role || "User"}</div>
                  </div>
                  <button 
                    onClick={() => { setIsUserDropdownOpen(false); setIsPasswordModalOpen(true); }}
                    style={{ padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', color: 'var(--foreground)' }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Lock size={16} /> Change Password
                  </button>
                  <button 
                    onClick={() => signOut()}
                    style={{ padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', color: 'var(--danger)' }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="main-content">
        <div className="curved-banner-container">
          <div className="curved-banner"></div>
        </div>

        {/* Dashboard Overview - Always visible */}
        <div className="profile-banner">
          <div className="profile-avatar">
            <User size={32} />
          </div>
          <div className="profile-info">
            <h2>Dashboard Overview</h2>
            <div style={{opacity: 0.8, fontSize: '0.9rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6}}>
              <div style={{width: 24, height: 24, background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <span style={{color: 'var(--primary)', fontWeight: 'bold', fontSize: 12}}>L</span>
              </div>
              Persistent Batch Dashboard
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
          </div>
        </div>

        {/* 4 Metric Cards */}
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

        {/* Data Table Card */}
        <div className="dashboard-card">
          <div className="card-header" style={{flexWrap: 'wrap', gap: '16px', flexDirection: 'column', alignItems: 'flex-start'}}>
            <h3 className="card-title" style={{marginBottom: '16px'}}>Scraper Results</h3>
            <div className="table-actions" style={{width: '100%', display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
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
              <select 
                value={branchFilter}
                onChange={e => setBranchFilter(e.target.value)}
                style={{padding: '8px 12px', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', outline: 'none', background: 'white', flex: '1 1 min-content'}}
              >
                <option value="all">All Branches</option>
                {uniqueBranches.map(b => <option key={b as string} value={b as string}>{b as string}</option>)}
              </select>
              <select 
                value={semesterFilter}
                onChange={e => setSemesterFilter(e.target.value)}
                style={{padding: '8px 12px', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', outline: 'none', background: 'white', flex: '1 1 min-content'}}
              >
                <option value="all">All Semesters</option>
                {uniqueSemesters.map(s => <option key={s as string} value={s as string}>Sem {s as string}</option>)}
              </select>
              <select 
                value={sectionFilter}
                onChange={e => setSectionFilter(e.target.value)}
                style={{padding: '8px 12px', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', outline: 'none', background: 'white', flex: '1 1 min-content'}}
              >
                <option value="all">All Sections</option>
                {uniqueSections.map(s => <option key={s as string} value={s as string}>Sec {s as string}</option>)}
              </select>
              <button 
                onClick={() => handleRefresh(rows.map(r => r.rollNumber))} 
                disabled={isScraping || rows.length === 0}
                className="btn btn-outline"
                style={{flex: '1 1 auto', whiteSpace: 'nowrap'}}
              >
                <RefreshCw size={16} className={isScraping ? 'animate-spin' : ''} /> Refresh All
              </button>
              
              <div style={{ position: 'relative', flex: '1 1 auto' }}>
                <button 
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  disabled={processedCount === 0}
                  className="btn btn-primary"
                  style={{width: '100%', whiteSpace: 'nowrap'}}
                >
                  <Download size={16} /> Export Data
                </button>
                {isExportMenuOpen && processedCount > 0 && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setIsExportMenuOpen(false)} />
                    <div className="animate-slide-up" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, background: 'white', border: '1px solid var(--surface-border)', borderRadius: 8, boxShadow: 'var(--shadow-md)', minWidth: 200, zIndex: 20, padding: '8px 0', display: 'flex', flexDirection: 'column' }}>
                      <button 
                        onClick={handleExport}
                        style={{ padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--foreground)' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        Export as CSV
                      </button>
                      <button 
                        onClick={() => { setIsExportMenuOpen(false); setIsGoogleSheetModalOpen(true); }}
                        style={{ padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--foreground)' }}
                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        Export to Google Sheets
                      </button>
                    </div>
                  </>
                )}
              </div>

              {isAdmin && (
                <button 
                  onClick={handleClearData}
                  disabled={rows.length === 0}
                  className="btn btn-outline"
                  style={{flex: '1 1 auto', whiteSpace: 'nowrap', borderColor: 'var(--danger)', color: 'var(--danger)'}}
                  title="Delete all uploaded data"
                >
                  <Trash2 size={16} /> Clear Data
                </button>
              )}
            </div>

            {isAdmin && (
              <div style={{display: 'flex', gap: '16px', marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--surface-border)', alignItems: 'center'}}>
                <span style={{fontSize: '0.9rem', fontWeight: 600}}>{selectedStudents.length} students selected</span>
                <select 
                  value={selectedUserIdToAssign}
                  onChange={e => setSelectedUserIdToAssign(e.target.value)}
                  style={{padding: '8px 12px', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', outline: 'none', background: 'white'}}
                >
                  <option value="">Select Sub-User to Assign...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                  ))}
                </select>
                <button 
                  onClick={handleAssignStudents}
                  className="btn btn-primary"
                  disabled={selectedStudents.length === 0 || !selectedUserIdToAssign}
                  style={{padding: '8px 16px', fontSize: '0.9rem'}}
                >
                  Assign to User
                </button>
                <Link href="/admin/users" className="btn btn-outline" style={{padding: '8px 16px', fontSize: '0.9rem', marginLeft: 'auto'}}>
                  Manage Users
                </Link>
              </div>
            )}
          </div>
          
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {isAdmin && (
                    <th>
                      <input 
                        type="checkbox" 
                        onChange={(e) => setSelectedStudents(e.target.checked ? paginatedRows.map(r => r.rollNumber) : [])}
                        checked={paginatedRows.length > 0 && selectedStudents.length === paginatedRows.length}
                        style={{cursor: 'pointer'}}
                      />
                    </th>
                  )}
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
                {paginatedRows.map(row => {
                  const isPending = row.status === 'pending' || row.status === 'rate_limited_retrying';
                  const isSelected = row.id === selectedStudentId;
                  
                  return (
                    <tr key={row.id} style={{opacity: isPending ? 0.6 : 1, background: isSelected ? 'var(--surface-hover)' : 'transparent'}}>
                      {isAdmin && (
                        <td>
                          <input 
                            type="checkbox" 
                            checked={selectedStudents.includes(row.rollNumber)}
                            onChange={() => handleToggleSelectStudent(row.rollNumber)}
                            style={{cursor: 'pointer'}}
                          />
                        </td>
                      )}
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
                      <td className="text-right font-medium">{row.solvedToday ?? '-'}</td>
                      <td className="text-right font-medium">{row.totalSolved ?? '-'}</td>
                      <td className="text-right text-green-500 font-medium">{row.easySolved ?? '-'}</td>
                      <td className="text-right text-yellow-500 font-medium">{row.mediumSolved ?? '-'}</td>
                      <td className="text-right text-red-500 font-medium">{row.hardSolved ?? '-'}</td>
                      <td className="text-right">{row.globalRank?.toLocaleString() ?? '-'}</td>
                      <td className="text-right">{row.badges ?? '-'}</td>
                      <td>
                        <button 
                          onClick={() => handleRefresh([row.rollNumber])}
                          disabled={isScraping}
                          className="text-primary font-medium"
                          style={{fontSize: '0.85rem', opacity: isScraping ? 0.5 : 1}}
                        >
                          Refresh
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="text-center p-8 text-muted">No students found. Upload a roster first!</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--surface-border)', background: '#fdfdfd' }}>
              <div className="text-muted text-sm">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRows.length)} of {filteredRows.length} students
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  Previous
                </button>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, margin: '0 8px' }}>
                  Page {currentPage} of {totalPages}
                </div>
                <button 
                  className="btn btn-outline" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>

    {/* MODAL overlay for selected student (Moved completely outside to avoid CSS transform relative positioning issues) */}
        {selectedStudent && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
          }}>
            <div style={{
              background: 'white', borderRadius: 'var(--radius-lg)', 
              width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', position: 'relative',
              display: 'flex', flexDirection: 'column'
            }}>
              {/* Modal Banner */}
              <div className="profile-banner" style={{ margin: 0, borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0', flexShrink: 0, background: 'var(--primary)' }}>
                <div className="profile-avatar">
                  <User size={32} />
                </div>
                <div className="profile-info">
                  <h2>{selectedStudent.name}</h2>
                  <div style={{opacity: 0.95, fontSize: '0.85rem', marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px'}}>
                    <div style={{background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: 6}}>
                      <div style={{width: 16, height: 16, background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                        <span style={{color: 'var(--primary)', fontWeight: 'bold', fontSize: 10}}>L</span>
                      </div>
                      <span><span className="font-medium">Roll No:</span> {selectedStudent.rollNumber}</span>
                    </div>
                    {selectedStudent.branch && (
                      <div style={{background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '100px'}}>
                        <span className="font-medium">Branch:</span> {selectedStudent.branch}
                      </div>
                    )}
                    {selectedStudent.semester && (
                      <div style={{background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '100px'}}>
                        <span className="font-medium">Sem:</span> {selectedStudent.semester}
                      </div>
                    )}
                    {selectedStudent.section && (
                      <div style={{background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '100px'}}>
                        <span className="font-medium">Sec:</span> {selectedStudent.section}
                      </div>
                    )}
                    {selectedStudent.mentor && (
                      <div style={{background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '100px'}}>
                        <span className="font-medium">Mentor:</span> {selectedStudent.mentor}
                      </div>
                    )}
                  </div>
                </div>
                <div className="quick-stats-bar" style={{display: 'flex', gap: '12px', marginLeft: 'auto', marginRight: '16px', marginTop: '-16px', background: 'transparent', alignItems: 'center'}}>
                  <button 
                    onClick={() => handleRefresh([selectedStudent.rollNumber])}
                    disabled={isScraping}
                    className="btn"
                    title="Refresh Profile"
                    style={{
                      background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', 
                      borderRadius: '50%', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backdropFilter: 'blur(10px)', width: '32px', height: '32px'
                    }}
                  >
                    <RefreshCw size={16} className={isScraping ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => setSelectedStudentId(null)}
                    className="btn"
                    title="Close"
                    style={{
                      background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.4)',
                      borderRadius: '50%', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backdropFilter: 'blur(10px)', width: '32px', height: '32px'
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div style={{ padding: '24px', flex: '1 1 auto', overflowY: 'auto' }}>
                <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '24px' }}>
                  <div className="metric-card" style={{margin: 0}}>
                    <div className="metric-icon-wrapper"><Target size={24} /></div>
                    <h3 className="metric-title">Total Solved</h3>
                    <div className="metric-stats">
                      <div className="metric-stat-row"><span>Problems Solved</span><div className="metric-circle blue">{selectedStudent.totalSolved ?? '-'}</div></div>
                      <div className="metric-stat-row"><span>Global Rank</span><span className="font-bold">{selectedStudent.globalRank?.toLocaleString() ?? '-'}</span></div>
                    </div>
                  </div>
                  
                  <div className="metric-card" style={{margin: 0}}>
                    <div className="metric-icon-wrapper"><Activity size={24} /></div>
                    <h3 className="metric-title">Difficulty</h3>
                    <div className="metric-stats">
                      <div className="metric-stat-row"><span>Easy</span><div className="metric-circle green">{selectedStudent.easySolved ?? '-'}</div></div>
                      <div className="metric-stat-row"><span>Medium</span><div className="metric-circle yellow">{selectedStudent.mediumSolved ?? '-'}</div></div>
                      <div className="metric-stat-row"><span>Hard</span><div className="metric-circle red">{selectedStudent.hardSolved ?? '-'}</div></div>
                    </div>
                  </div>

                  <div className="metric-card" style={{margin: 0}}>
                    <div className="metric-icon-wrapper"><Clock size={24} /></div>
                    <h3 className="metric-title">Activity</h3>
                    <div className="metric-stats">
                      <div className="metric-stat-row"><span>Solved Today</span><div className="metric-circle blue">{selectedStudent.solvedToday ?? '-'}</div></div>
                      <div className="metric-stat-row"><span>Scrape Status</span><StatusIcon status={selectedStudent.status} /></div>
                    </div>
                  </div>
                </div>

                <div className="dashboard-card" style={{ margin: '0 0 24px 0' }}>
                  <div className="card-header">
                    <h3 className="card-title">Assigned Questions</h3>
                  </div>
                  {isLoadingAssignments ? (
                    <div className="p-8 text-center text-muted"><RotateCw className="animate-spin" size={24} style={{margin: '0 auto'}} /></div>
                  ) : assignedQuestions.length > 0 ? (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{padding: '12px 16px'}}>Question</th>
                          <th style={{padding: '12px 16px'}}>Status</th>
                          <th style={{padding: '12px 16px', textAlign: 'right'}}>Completed At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignedQuestions.map((qa: any) => (
                          <tr key={qa.id}>
                            <td style={{padding: '12px 16px', fontWeight: 500}}>
                              <a href={`https://leetcode.com/problems/${qa.assignment.titleSlug}/`} target="_blank" rel="noreferrer" style={{color: 'var(--primary)', textDecoration: 'none'}}>
                                {qa.assignment.title}
                              </a>
                            </td>
                            <td style={{padding: '12px 16px'}}>
                              <span style={{
                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
                                color: qa.status === 'completed' ? '#10b981' : '#f59e0b',
                                backgroundColor: qa.status === 'completed' ? '#ecfdf5' : '#fffbeb'
                              }}>
                                {qa.status === 'completed' ? 'Done' : 'Pending'}
                              </span>
                            </td>
                            <td style={{padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)'}}>
                              {qa.completedAt ? new Date(qa.completedAt).toLocaleString() : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-muted">No questions assigned to this student.</div>
                  )}
                </div>

                <div className="dashboard-card" style={{ margin: 0 }}>
                  <div className="card-header">
                    <h3 className="card-title">Recent Submissions (Accepted)</h3>
                    {selectedStudent.url && (
                      <a href={selectedStudent.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{padding: '4px 12px', fontSize: '0.85rem'}}>
                        View Profile ↗
                      </a>
                    )}
                  </div>
                  {isLoadingSubmissions ? (
                    <div className="p-8 text-center text-muted"><RotateCw className="animate-spin" size={24} style={{margin: '0 auto'}} /></div>
                  ) : recentSubmissions.length > 0 ? (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{padding: '12px 16px'}}>Question</th>
                          <th style={{padding: '12px 16px'}}>Difficulty</th>
                          <th style={{padding: '12px 16px', textAlign: 'right'}}>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentSubmissions.map((sub: any) => (
                          <tr key={sub.id}>
                            <td style={{padding: '12px 16px', fontWeight: 500}}>{sub.title}</td>
                            <td style={{padding: '12px 16px'}}>
                              <span style={{
                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
                                color: sub.difficulty === 'Easy' ? '#10b981' : sub.difficulty === 'Medium' ? '#f59e0b' : '#ef4444',
                                backgroundColor: sub.difficulty === 'Easy' ? '#ecfdf5' : sub.difficulty === 'Medium' ? '#fffbeb' : '#fef2f2'
                              }}>
                                {sub.difficulty}
                              </span>
                            </td>
                            <td style={{padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)'}}>
                              {new Date(parseInt(sub.timestamp) * 1000).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-muted">No recent submissions found or profile is private.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPasswordModalOpen(false)}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{maxWidth: 400}}>
            <div className="modal-header">
              <h2 className="modal-title">Change Password</h2>
              <button className="icon-btn" onClick={() => setIsPasswordModalOpen(false)}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleChangePassword} style={{padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px'}}>
              <div>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600}}>Current Password</label>
                <input 
                  type="password" 
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none'}}
                  required
                />
              </div>
              <div>
                <label style={{display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600}}>New Password</label>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={6}
                  style={{width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none'}}
                  required
                />
              </div>
              
              <div style={{display: 'flex', gap: '12px', marginTop: '16px'}}>
                <button type="button" className="btn btn-outline" style={{flex: 1}} onClick={() => setIsPasswordModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{flex: 1}} disabled={isChangingPassword}>
                  {isChangingPassword ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Google Sheets Modal */}
      {isGoogleSheetModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="dashboard-card animate-fade-in" style={{ width: '100%', maxWidth: 500, margin: 0 }}>
            <div className="card-header border-b border-surface-border">
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img src="https://upload.wikimedia.org/wikipedia/commons/3/30/Google_Sheets_logo_%282014-2020%29.svg" alt="Sheets" style={{width: 20, height: 20}} />
                Export to Google Sheets
              </h3>
              <button onClick={() => setIsGoogleSheetModalOpen(false)} className="icon-btn" style={{marginRight: -8}}><X size={20} /></button>
            </div>
            <div className="card-body">
              <form onSubmit={handleGoogleSheetsExport}>
                <p className="text-sm text-muted mb-6">
                  Enter your Google Spreadsheet ID to sync the processed data. The server must be configured with a valid Google Service Account in the environment variables.
                </p>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 500 }}>Spreadsheet ID</label>
                  <input 
                    type="text" 
                    value={googleSheetId} 
                    onChange={e => {
                      const val = e.target.value;
                      const match = val.match(/[-\w]{25,}/);
                      setGoogleSheetId(match ? match[0] : val);
                    }}
                    placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    required
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--surface-border)', borderRadius: 6, outline: 'none', fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                  <p style={{fontSize: '0.75rem', marginTop: 4, color: 'var(--muted)'}}>Found in the URL: docs.google.com/spreadsheets/d/<strong>[SPREADSHEET_ID]</strong>/edit</p>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: '0.9rem', fontWeight: 500 }}>Sheet Name</label>
                  <input 
                    type="text" 
                    value={googleSheetName} 
                    onChange={e => setGoogleSheetName(e.target.value)}
                    placeholder="Sheet1"
                    required
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--surface-border)', borderRadius: 6, outline: 'none' }}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setIsGoogleSheetModalOpen(false)} className="btn btn-outline">Cancel</button>
                  <button type="submit" disabled={isExportingToSheets} className="btn btn-primary" style={{ background: '#0F9D58', borderColor: '#0F9D58' }}>
                    {isExportingToSheets ? <RotateCw size={16} className="animate-spin" /> : 'Start Export'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
