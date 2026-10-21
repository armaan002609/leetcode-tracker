"use client";

import { useEffect, useState, useMemo } from "react";
import { generateCsv, downloadCsv } from "@/lib/export/generateCsv";
import { 
  CheckCircle2, Clock, Lock, HelpCircle, 
  AlertTriangle, RotateCw, Download, Search, AlertCircle,
  Menu, User, Grid, Home, ArrowLeft, Target, Activity, Award, UploadCloud, RefreshCw, Trash2, X, LogIn, LogOut, Database,
  Users, Flame, TrendingUp, Sparkles, Building2,
  ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, RotateCcw
} from "lucide-react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import DashboardCharts from "@/components/DashboardCharts";

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
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Export states
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);


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
  const rateLimitCount = rows.filter(r => r.status === 'rate_limited_retrying').length;

  // Problem-solving & Sync KPI metrics
  const activeStudentsCount = useMemo(() => rows.filter(r => (r.totalSolved || 0) > 0).length, [rows]);
  const totalQuestionsSolved = useMemo(() => rows.reduce((acc, r) => acc + (r.totalSolved || 0), 0), [rows]);
  const avgSolvedPerStudent = useMemo(() => rows.length > 0 ? (totalQuestionsSolved / rows.length).toFixed(1) : "0", [rows, totalQuestionsSolved]);
  const avgSolvedPerActive = useMemo(() => activeStudentsCount > 0 ? (totalQuestionsSolved / activeStudentsCount).toFixed(1) : "0", [activeStudentsCount, totalQuestionsSolved]);
  const totalSolvedToday = useMemo(() => rows.reduce((acc, r) => acc + (r.solvedToday || 0), 0), [rows]);
  const activeTodayCount = useMemo(() => rows.filter(r => (r.solvedToday || 0) > 0).length, [rows]);
  const syncSuccessRate = useMemo(() => rows.length > 0 ? ((successCount / rows.length) * 100).toFixed(1) : "0", [rows, successCount]);

  // Clean repeated consecutive words in student names (e.g. "Vishwakarma Vishwakarma" -> "Vishwakarma")
  const cleanStudentName = (name: string) => {
    if (!name) return '—';
    const parts = name.trim().split(/\s+/);
    const filtered: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i === 0 || parts[i].toLowerCase() !== parts[i - 1].toLowerCase()) {
        filtered.push(parts[i]);
      }
    }
    return filtered.join(' ');
  };

  // Sorting state - default to Roll Number ascending
  type SortField = 'rollNumber' | 'name' | 'branch' | 'semester' | 'section' | 'mentor' | 'solvedToday' | 'totalSolved' | 'easySolved' | 'mediumSolved' | 'hardSolved' | 'globalRank' | 'status';
  const [sortField, setSortField] = useState<SortField>('rollNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      if (['totalSolved', 'solvedToday', 'easySolved', 'mediumSolved', 'hardSolved', 'globalRank'].includes(field)) {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  const uniqueBranches = useMemo(() => Array.from(new Set(rows.map(r => r.branch).filter(Boolean))).sort(), [rows]);
  const uniqueSemesters = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  const uniqueSections = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || 
                            r.name?.toLowerCase().includes(term) || 
                            r.rollNumber?.toLowerCase().includes(term) ||
                            (r.mentor && r.mentor.toLowerCase().includes(term)) ||
                            (r.branch && r.branch.toLowerCase().includes(term));
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

  const sortedRows = useMemo(() => {
    const sorted = [...filteredRows];
    sorted.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === null || aVal === undefined) aVal = (typeof bVal === 'number') ? -Infinity : '';
      if (bVal === null || bVal === undefined) bVal = (typeof aVal === 'number') ? -Infinity : '';

      if (sortField === 'rollNumber') {
        const numA = parseFloat(String(aVal).replace(/\D/g, ''));
        const numB = parseFloat(String(bVal).replace(/\D/g, ''));
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }
        const comp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortDirection === 'asc' ? comp : -comp;
      }

      if (typeof aVal === 'string') {
        const comp = aVal.localeCompare(bVal as string, undefined, { numeric: true });
        return sortDirection === 'asc' ? comp : -comp;
      } else {
        const comp = (aVal as number) - (bVal as number);
        return sortDirection === 'asc' ? comp : -comp;
      }
    });
    return sorted;
  }, [filteredRows, sortField, sortDirection]);

  // Reset to page 1 when any filter or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, branchFilter, sectionFilter, semesterFilter, sortField, sortDirection]);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedRows.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedRows, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedRows.length / itemsPerPage);

  const selectedStudent = useMemo(() => rows.find(r => r.id === selectedStudentId), [rows, selectedStudentId]);

  useEffect(() => {
    if (selectedStudent) {
      setIsLoadingSubmissions(true);
      fetch(`/api/students/${selectedStudent.id}/submissions`)
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

  if (!isReady || status === "loading") {
    return (
      <div className="enterprise-loader-wrapper">
        <div className="pulse-logo">L</div>
        <div className="loader-text">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <>
      <div className="dashboard-layout animate-fade-in">
        <nav className="topnav">
          <div className="topnav-brand">
            <div className="topnav-brand-icon">L</div>
            <span>LeetCode Tracker</span>
          </div>
          <div className="topnav-actions" style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
            <Link href="/analytics" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white', textDecoration: 'none', background: 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.9rem', fontWeight: 500 }}>
              <Activity size={16} /> Analytics
            </Link>
            <div className="search-wrapper" style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
              <button 
                className="icon-btn hide-on-desktop" 
                onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                style={{background: 'white', color: 'var(--muted)', border: 'none', cursor: 'pointer', display: 'none'}}
              >
                <Search size={18} />
              </button>
              
              <div className={`search-input-container ${isSearchExpanded ? 'active' : ''}`}>
                <Search size={16} className="text-muted hide-on-mobile" style={{position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)'}} />
                <input 
                  type="text" 
                  placeholder="Search name/roll..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{padding: '8px 12px 8px 32px', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', outline: 'none', width: '250px', color: 'var(--foreground)', background: 'white'}}
                />
              </div>
            </div>
            
            <div style={{ position: 'relative' }}>
              <div 
                onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
                style={{width: 36, height: 36, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', transform: isNavMenuOpen ? 'scale(0.95)' : 'scale(1)'}}
                title="Menu"
              >
                <Menu size={20} color="var(--primary)" />
              </div>
              
              {isNavMenuOpen && (
                <>
                  <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }} 
                    onClick={() => setIsNavMenuOpen(false)} 
                  />
                  <div 
                    className="animate-slide-up"
                    style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'white', border: '1px solid var(--surface-border)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', minWidth: '220px', zIndex: 50, padding: '8px 0', display: 'flex', flexDirection: 'column', color: 'var(--foreground)' }}
                  >
                    <div style={{ padding: '8px 16px 12px', borderBottom: '1px solid var(--surface-border)', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{session?.user?.name || "User"}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', textTransform: 'capitalize' }}>{(session?.user as any)?.role || "User"}</div>
                    </div>

                    {isAdmin && (
                      <>
                        <Link href="/admin/data" style={{ padding: '10px 16px', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--foreground)' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                          <Database size={16} /> Full Data
                        </Link>
                        <Link href="/admin/assignments" style={{ padding: '10px 16px', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--foreground)' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                          <Target size={16} /> Assignments
                        </Link>
                        <Link href="/upload" style={{ padding: '10px 16px', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--foreground)' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                          <UploadCloud size={16} /> Upload Data
                        </Link>
                        <div style={{ height: '1px', background: 'var(--surface-border)', margin: '4px 0' }}></div>
                      </>
                    )}

                    <button 
                      onClick={() => { setIsNavMenuOpen(false); setIsPasswordModalOpen(true); }}
                      style={{ padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', color: 'var(--foreground)' }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <Lock size={16} /> Change Password
                    </button>
                    <button 
                      onClick={async () => {
                        await signOut({ redirect: false });
                        router.push('/login');
                      }}
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
        {/* Modern Clean SaaS Hero Header */}
        <div className="dashboard-hero">
          <div className="hero-left">
            <div className="hero-pill-badge">
              <span className="hero-live-dot" />
              <span>Persistent Batch Scraper</span>
            </div>
            <h1 className="hero-heading">Dashboard Overview</h1>
            <p className="hero-subheading">
              Track student problem-solving activity, difficulty breakdown, and batch scraper performance in real time.
            </p>
            <div className="hero-meta-chips">
              <span className="hero-chip">
                <Users size={14} /> {rows.length} Enrolled
              </span>
              <span className="hero-chip">
                <CheckCircle2 size={14} style={{ color: '#10b981' }} /> {processedCount} / {rows.length} Synced ({syncSuccessRate}%)
              </span>
              {rateLimitCount > 0 ? (
                <span className="hero-chip warning">
                  <Clock size={14} className="animate-pulse" /> {rateLimitCount} Retrying
                </span>
              ) : (
                <span className="hero-chip success">
                  <Sparkles size={14} /> Scraper Optimal
                </span>
              )}
            </div>
          </div>

          <div className="hero-right-actions">
            <button
              onClick={() => handleRefresh(rows.map(r => r.rollNumber))}
              disabled={isScraping || rows.length === 0}
              className="btn btn-outline hero-action-btn"
              title="Trigger background scrape refresh for all students"
            >
              <RefreshCw size={16} className={isScraping ? 'animate-spin' : ''} />
              <span>{isScraping ? 'Scraping...' : 'Refresh All'}</span>
            </button>
            <Link href="/analytics" className="btn btn-primary hero-action-btn">
              <Activity size={16} />
              <span>Deep Analytics</span>
            </Link>
          </div>
        </div>

        {/* 4 Executive KPI Cards (Problem-Solving & Sync Health) */}
        <div className="kpi-grid">
          {/* KPI 1: Total Students */}
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Total Students</span>
              <div className="kpi-icon-pill" style={{ background: 'rgba(164, 14, 25, 0.08)', color: 'var(--primary)' }}>
                <Users size={20} />
              </div>
            </div>
            <div className="kpi-value">{rows.length}</div>
            <div className="kpi-footer">
              <div className="kpi-subtext">
                <span style={{ fontWeight: 600, color: '#059669' }}>{activeStudentsCount} active</span> ({rows.length > 0 ? Math.round((activeStudentsCount / rows.length) * 100) : 0}%) • {rows.length - activeStudentsCount} inactive
              </div>
              <div className="kpi-ratio-bar">
                <div 
                  className="kpi-ratio-fill emerald" 
                  style={{ width: `${rows.length > 0 ? (activeStudentsCount / rows.length) * 100 : 0}%` }} 
                />
              </div>
            </div>
          </div>

          {/* KPI 2: Total Solved Questions */}
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Total Solved</span>
              <div className="kpi-icon-pill" style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
                <Award size={20} />
              </div>
            </div>
            <div className="kpi-value">{totalQuestionsSolved.toLocaleString()}</div>
            <div className="kpi-footer">
              <div className="kpi-subtext">
                <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>~{avgSolvedPerStudent}</span> avg / student • <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>~{avgSolvedPerActive}</span> / active
              </div>
              <div className="kpi-badge-pill green">
                Across All Difficulties
              </div>
            </div>
          </div>

          {/* KPI 3: Sync & Scraping Health */}
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Scrape Health</span>
              <div className="kpi-icon-pill" style={{ background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6' }}>
                <CheckCircle2 size={20} />
              </div>
            </div>
            <div className="kpi-value">{syncSuccessRate}%</div>
            <div className="kpi-footer">
              <div className="kpi-subtext">
                <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{successCount}</span> synced • <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{failCount}</span> errors
              </div>
              <div className="kpi-ratio-bar">
                <div 
                  className="kpi-ratio-fill blue" 
                  style={{ width: `${syncSuccessRate}%` }} 
                />
              </div>
            </div>
          </div>

          {/* KPI 4: 24h Velocity (Solved Today) */}
          <div className="kpi-card">
            <div className="kpi-header">
              <span className="kpi-title">Solved Today</span>
              <div className="kpi-icon-pill" style={{ background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b' }}>
                <Flame size={20} />
              </div>
            </div>
            <div className="kpi-value">{totalSolvedToday.toLocaleString()}</div>
            <div className="kpi-footer">
              <div className="kpi-subtext">
                <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{activeTodayCount}</span> students active in last 24h
              </div>
              <div className="kpi-badge-pill amber">
                24h Velocity
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Charts */}
        <DashboardCharts rows={filteredRows} onSelectStudent={(id) => setSelectedStudentId(id)} />

        {/* Data Table Card */}
        <div className="dashboard-card">
          {/* Table Header: Title + Inline Search + Action Buttons */}
          <div className="table-header-bar">
            <div className="table-header-title-group">
              <h3 className="card-title" style={{ margin: 0 }}>Student Scraper Roster</h3>
              <div className="table-count-badge">
                Showing <strong>{sortedRows.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, sortedRows.length)}</strong> of <strong>{sortedRows.length}</strong> students
                {sortedRows.length !== rows.length && (
                  <span className="table-filter-tag">(filtered from {rows.length})</span>
                )}
              </div>
            </div>

            <div className="table-header-controls">
              {/* Inline Search Input */}
              <div className="table-search-box">
                <Search size={15} className="table-search-icon" />
                <input
                  type="text"
                  placeholder="Search name, roll no, mentor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="table-search-input"
                />
                {searchTerm && (
                  <button 
                    type="button" 
                    onClick={() => setSearchTerm('')} 
                    className="table-search-clear"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Action Buttons: Refresh, Export, Clear */}
              <button 
                onClick={() => handleRefresh(rows.map(r => r.rollNumber))} 
                disabled={isScraping || rows.length === 0}
                className="btn btn-outline"
                title="Refresh scraping for all students"
              >
                <RefreshCw size={15} className={isScraping ? 'animate-spin' : ''} /> 
                <span>Refresh All</span>
              </button>

              {isAdmin && (
                <div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                    disabled={processedCount === 0}
                    className="btn btn-primary"
                  >
                    <Download size={15} /> <span>Export Data</span>
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
                          Export Table as CSV
                        </button>
                        <a 
                          href="/api/admin/submissions/export"
                          download
                          onClick={() => setIsExportMenuOpen(false)}
                          style={{ padding: '10px 16px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--foreground)', textDecoration: 'none', display: 'block' }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          Export All Solved Questions
                        </a>
                      </div>
                    </>
                  )}
                </div>
              )}

              {isAdmin && (
                <button 
                  onClick={handleClearData}
                  disabled={rows.length === 0}
                  className="btn btn-outline"
                  style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--danger)' }}
                  title="Delete all uploaded data"
                >
                  <Trash2 size={15} /> <span>Clear Data</span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Chips Bar */}
          <div className="table-filter-bar">
            <div className="filter-pill-group">
              <div className="filter-select-wrapper">
                <span className="filter-label">Status:</span>
                <select 
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Statuses</option>
                  <option value="success">Success & Partial</option>
                  <option value="failed">Failed & Errors</option>
                  <option value="pending">Pending</option>
                </select>
              </div>

              <div className="filter-select-wrapper">
                <span className="filter-label">Branch:</span>
                <select 
                  value={branchFilter}
                  onChange={e => setBranchFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Branches</option>
                  {uniqueBranches.map(b => <option key={b as string} value={b as string}>{b as string}</option>)}
                </select>
              </div>

              <div className="filter-select-wrapper">
                <span className="filter-label">Semester:</span>
                <select 
                  value={semesterFilter}
                  onChange={e => setSemesterFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Semesters</option>
                  {uniqueSemesters.map(s => <option key={s} value={s}>Sem {s}</option>)}
                </select>
              </div>

              <div className="filter-select-wrapper">
                <span className="filter-label">Section:</span>
                <select 
                  value={sectionFilter}
                  onChange={e => setSectionFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Sections</option>
                  {uniqueSections.map(s => <option key={s} value={s}>Sec {s}</option>)}
                </select>
              </div>

              {/* Clear Filters Button (shown only when any filter or search is active) */}
              {(statusFilter !== 'all' || branchFilter !== 'all' || semesterFilter !== 'all' || sectionFilter !== 'all' || searchTerm !== '') && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setBranchFilter('all');
                    setSemesterFilter('all');
                    setSectionFilter('all');
                    setSearchTerm('');
                  }}
                  className="filter-reset-btn"
                  title="Reset all filters"
                >
                  <RotateCcw size={13} /> Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Active Bulk Actions Bar (Only visible when >= 1 student is selected) */}
          {isAdmin && selectedStudents.length > 0 && (
            <div className="bulk-actions-bar animate-fade-in">
              <div className="bulk-actions-info">
                <span className="bulk-badge">{selectedStudents.length}</span>
                <span className="bulk-text">students selected</span>
              </div>

              <div className="bulk-actions-controls">
                <select 
                  value={selectedUserIdToAssign}
                  onChange={e => setSelectedUserIdToAssign(e.target.value)}
                  className="bulk-select"
                >
                  <option value="">Select Sub-User to Assign...</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                  ))}
                </select>

                <button 
                  onClick={handleAssignStudents}
                  className="btn btn-primary bulk-btn"
                  disabled={!selectedUserIdToAssign}
                >
                  Assign to User
                </button>

                <button
                  onClick={() => handleRefresh(selectedStudents)}
                  disabled={isScraping}
                  className="btn btn-outline bulk-btn"
                  title="Refresh scrape for selected students only"
                >
                  <RefreshCw size={14} className={isScraping ? 'animate-spin' : ''} />
                  <span>Refresh Selected</span>
                </button>

                <button 
                  onClick={() => setSelectedStudents([])}
                  className="bulk-clear-btn"
                  title="Deselect all"
                >
                  <X size={15} /> Deselect
                </button>
              </div>
            </div>
          )}
          
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  {isAdmin && (
                    <th style={{ width: '40px' }}>
                      <input 
                        type="checkbox" 
                        onChange={(e) => setSelectedStudents(e.target.checked ? paginatedRows.map(r => r.rollNumber) : [])}
                        checked={paginatedRows.length > 0 && selectedStudents.length === paginatedRows.length}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                  )}
                  <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', minWidth: '95px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Status 
                      {sortField === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('rollNumber')} style={{ cursor: 'pointer', minWidth: '100px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Roll No 
                      {sortField === 'rollNumber' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', minWidth: '160px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Name 
                      {sortField === 'name' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('branch')} style={{ cursor: 'pointer', minWidth: '90px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Branch 
                      {sortField === 'branch' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('semester')} style={{ cursor: 'pointer', minWidth: '65px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Sem 
                      {sortField === 'semester' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('section')} style={{ cursor: 'pointer', minWidth: '55px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Sec 
                      {sortField === 'section' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('mentor')} style={{ cursor: 'pointer', minWidth: '130px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Mentor 
                      {sortField === 'mentor' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('solvedToday')} className="text-right" style={{ cursor: 'pointer', minWidth: '95px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%' }}>
                      Today 
                      {sortField === 'solvedToday' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('totalSolved')} className="text-right" style={{ cursor: 'pointer', minWidth: '110px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%' }}>
                      Total Solved 
                      {sortField === 'totalSolved' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('easySolved')} className="text-right" style={{ cursor: 'pointer', minWidth: '65px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%' }}>
                      Easy 
                      {sortField === 'easySolved' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('mediumSolved')} className="text-right" style={{ cursor: 'pointer', minWidth: '65px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%' }}>
                      Med 
                      {sortField === 'mediumSolved' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('hardSolved')} className="text-right" style={{ cursor: 'pointer', minWidth: '65px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%' }}>
                      Hard 
                      {sortField === 'hardSolved' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th onClick={() => handleSort('globalRank')} className="text-right" style={{ cursor: 'pointer', minWidth: '110px', userSelect: 'none' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, width: '100%' }}>
                      Global Rank 
                      {sortField === 'globalRank' ? (
                        sortDirection === 'asc' ? <ArrowUp size={13} style={{ color: 'var(--primary)' }} /> : <ArrowDown size={13} style={{ color: 'var(--primary)' }} />
                      ) : (
                        <ArrowUpDown size={12} style={{ opacity: 0.35 }} />
                      )}
                    </div>
                  </th>
                  <th className="text-right" style={{ minWidth: '65px' }}>
                    Badges
                  </th>
                  <th className="text-center" style={{ minWidth: '85px' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map(row => {
                  const isPending = row.status === 'pending' || row.status === 'rate_limited_retrying';
                  const isSelected = row.id === selectedStudentId;
                  
                  return (
                    <tr key={row.id} style={{ opacity: isPending ? 0.6 : 1, background: isSelected ? 'var(--surface-hover)' : 'transparent' }}>
                      {isAdmin && (
                        <td>
                          <input 
                            type="checkbox" 
                            checked={selectedStudents.includes(row.rollNumber)}
                            onChange={() => handleToggleSelectStudent(row.rollNumber)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                      )}
                      <td><StatusIcon status={row.status} /></td>
                      <td>
                        <span className="roll-number-badge">{row.rollNumber}</span>
                      </td>
                      <td>
                        <span 
                          onClick={() => setSelectedStudentId(isSelected ? null : row.id)}
                          className="student-name-link"
                          title="Click to view student profile"
                        >
                          {cleanStudentName(row.name)}
                        </span>
                      </td>
                      <td>
                        <span className="cohort-tag">{row.branch ?? '—'}</span>
                      </td>
                      <td>
                        <span className="cohort-tag">{row.semester ?? '—'}</span>
                      </td>
                      <td>
                        <span className="cohort-tag">{row.section ?? '—'}</span>
                      </td>
                      <td>
                        <div className="mentor-cell" title={row.mentor || '—'}>
                          {row.mentor || '—'}
                        </div>
                      </td>
                      <td className="text-right">
                        {(row.solvedToday || 0) > 0 ? (
                          <span className="today-badge">+{row.solvedToday}</span>
                        ) : (
                          <span className="text-muted" style={{ opacity: 0.5 }}>0</span>
                        )}
                      </td>
                      <td className="text-right">
                        <span className="total-solved-pill">{row.totalSolved ?? 0}</span>
                      </td>
                      <td className="text-right">
                        <span className="diff-pill easy">{row.easySolved ?? 0}</span>
                      </td>
                      <td className="text-right">
                        <span className="diff-pill medium">{row.mediumSolved ?? 0}</span>
                      </td>
                      <td className="text-right">
                        <span className="diff-pill hard">{row.hardSolved ?? 0}</span>
                      </td>
                      <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                        {row.globalRank ? (
                          <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>#{row.globalRank.toLocaleString()}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        {(row.badges || 0) > 0 ? (
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{row.badges}</span>
                        ) : (
                          <span className="text-muted" style={{ opacity: 0.5 }}>0</span>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="row-actions-group">
                          <button 
                            onClick={() => setSelectedStudentId(row.id)}
                            className="row-action-btn primary"
                            title="View Student Profile"
                          >
                            <User size={14} />
                          </button>
                          <button 
                            onClick={() => handleRefresh([row.rollNumber])}
                            disabled={isScraping}
                            className="row-action-btn"
                            title="Refresh Scrape"
                            style={{ opacity: isScraping ? 0.5 : 1 }}
                          >
                            <RefreshCw size={14} className={isScraping ? 'animate-spin' : ''} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedRows.length === 0 && (
                  <tr>
                    <td colSpan={16} className="text-center p-8 text-muted">
                      No students found matching your search or filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--surface-border)', background: '#fdfdfd' }}>
              <div className="text-muted text-sm">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedRows.length)} of {sortedRows.length} students
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
                  <div style={{opacity: 0.95, fontSize: '0.85rem', marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '8px'}}>
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
                <div style={{position: 'absolute', top: 16, right: 16, display: 'flex', gap: '8px', zIndex: 10}}>
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
                    <div style={{ padding: '24px' }}>
                      <div className="skeleton-row" style={{ width: '100%', marginBottom: '12px' }}></div>
                      <div className="skeleton-row" style={{ width: '80%', marginBottom: '12px' }}></div>
                      <div className="skeleton-row" style={{ width: '90%' }}></div>
                    </div>
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
                    <div style={{ padding: '24px' }}>
                      <div className="skeleton-row" style={{ width: '100%', marginBottom: '12px' }}></div>
                      <div className="skeleton-row" style={{ width: '85%', marginBottom: '12px' }}></div>
                      <div className="skeleton-row" style={{ width: '95%' }}></div>
                    </div>
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

    </>
  );
}
