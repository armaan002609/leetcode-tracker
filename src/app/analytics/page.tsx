"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, Building2, CheckCircle2, CheckSquare, Target, Users, Zap, Layers, Trophy, BookOpen, ChevronRight, Activity, Medal, 
} from "lucide-react";

// Modern color palette based on reference
const COLORS_TIER = ['#94a3b8', '#60a5fa', '#3b82f6', '#2563eb', '#8b5cf6', '#10b981'];
const DIFF_COLORS = { easy: '#22c55e', medium: '#f59e0b', hard: '#dc2626' };

export default function AnalyticsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows, setRows] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(false);
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch('/api/students')
        .then(res => res.json())
        .then(data => {
          setRows(data);
          setIsReady(true);
        })
        .catch(e => {
          console.error(e);
          setIsReady(true);
        });
    }
  }, [status]);

  // Overall KPIs
  const totalEnrolled = rows.length;
  const activeStudents = rows.filter(r => (r.totalSolved || 0) > 0);
  const totalActive = activeStudents.length;
  const totalSolved = rows.reduce((sum, r) => sum + (r.totalSolved || 0), 0);
  const avgActive = totalActive > 0 ? (totalSolved / totalActive).toFixed(1) : "0";
  const avgEnrolled = totalEnrolled > 0 ? (totalSolved / totalEnrolled).toFixed(1) : "0";
  const successfulScrapes = rows.filter(r => r.status === 'success' || r.status === 'partial_success').length;

  // Branch (Course) Data
  const branchData = useMemo(() => {
    if (!rows.length) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, any>();
    
    rows.forEach(r => {
      const branchName = r.branch || 'Unknown';
      if (!map.has(branchName)) {
        map.set(branchName, { 
          name: branchName, 
          enrolled: 0, 
          active: 0, 
          totalSolved: 0,
          easy: 0, medium: 0, hard: 0,
          topStudent: null 
        });
      }
      const b = map.get(branchName);
      b.enrolled += 1;
      const solved = r.totalSolved || 0;
      if (solved > 0) b.active += 1;
      b.totalSolved += solved;
      b.easy += (r.easySolved || 0);
      b.medium += (r.mediumSolved || 0);
      b.hard += (r.hardSolved || 0);
      
      if (!b.topStudent || solved > b.topStudent.totalSolved) {
        b.topStudent = { name: r.name, totalSolved: solved };
      }
    });

    return Array.from(map.values()).map(b => ({
      ...b,
      avgActive: b.active > 0 ? (b.totalSolved / b.active).toFixed(1) : "0",
      avgEnrolled: b.enrolled > 0 ? (b.totalSolved / b.enrolled).toFixed(1) : "0",
      turnout: b.enrolled > 0 ? ((b.active / b.enrolled) * 100).toFixed(1) : "0"
    })).sort((a, b) => b.enrolled - a.enrolled);
  }, [rows]);

  // Top 10 Students for horizontal stacked bar
  const top10Students = useMemo(() => {
    const sorted = [...activeStudents].sort((a, b) => (b.totalSolved || 0) - (a.totalSolved || 0)).slice(0, 10);
    return sorted.map(s => ({
      name: s.name,
      easy: s.easySolved || 0,
      medium: s.mediumSolved || 0,
      hard: s.hardSolved || 0,
      total: s.totalSolved || 0,
      branch: s.branch || 'Unknown'
    }));
  }, [activeStudents]);

  // Difficulty Data
  const diffData = useMemo(() => {
    let easy = 0, medium = 0, hard = 0;
    rows.forEach(r => {
      easy += r.easySolved || 0;
      medium += r.mediumSolved || 0;
      hard += r.hardSolved || 0;
    });
    return [
      { name: 'Easy Problems', value: easy, fill: DIFF_COLORS.easy },
      { name: 'Medium Problems', value: medium, fill: DIFF_COLORS.medium },
      { name: 'Hard Problems', value: hard, fill: DIFF_COLORS.hard }
    ].filter(d => d.value > 0);
  }, [rows]);

  // Tier Distribution
  const tierData = useMemo(() => {
    const bins = [0, 0, 0, 0, 0, 0];
    rows.forEach(r => {
      const s = r.totalSolved || 0;
      if (s === 0) bins[0]++;
      else if (s <= 20) bins[1]++;
      else if (s <= 50) bins[2]++;
      else if (s <= 100) bins[3]++;
      else if (s <= 200) bins[4]++;
      else bins[5]++;
    });
    return [
      { name: '0 Solved', count: bins[0] },
      { name: '1 - 20', count: bins[1] },
      { name: '21 - 50', count: bins[2] },
      { name: '51 - 100', count: bins[3] },
      { name: '101 - 200', count: bins[4] },
      { name: '200+', count: bins[5] },
    ];
  }, [rows]);

  if (!isReady || status === "loading") {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Loading Intelligence Portal...</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f4f7f9', minHeight: '100vh', padding: '32px 40px', fontFamily: '"Inter", system-ui, sans-serif', color: '#1e293b' }}>
      
      {/* Premium Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)', 
        borderRadius: '16px', 
        padding: '32px', 
        color: 'white', 
        marginBottom: '24px', 
        boxShadow: '0 10px 25px -5px rgba(30, 58, 138, 0.4), 0 8px 10px -6px rgba(30, 58, 138, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}></div>
        <div style={{ position: 'absolute', bottom: -100, right: 100, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }}></div>
        
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.7)', textDecoration: 'none', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 500, transition: 'color 0.2s' }} onMouseOver={e => e.currentTarget.style.color='white'} onMouseOut={e => e.currentTarget.style.color='rgba(255,255,255,0.7)'}>
          <ArrowLeft size={14} /> Back to Application
        </Link>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <Activity size={14} /> Global Performance
          </div>
        </div>
        
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
          LeetCode Performance & Intelligence Portal
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.95rem', maxWidth: '800px', marginBottom: '24px', lineHeight: 1.5 }}>
          Comprehensive departmental & course-wise problem-solving analytics. Monitoring student participation, solution depth, and problem-solving benchmarks across all available programs.
        </p>

        {/* Branch Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {branchData.map((b, i) => (
            <div key={b.name} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(10px)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS_TIER[i % COLORS_TIER.length] }}></div>
              <span style={{ fontWeight: 600 }}>{b.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)' }}>|</span>
              <span style={{ opacity: 0.9 }}>{b.enrolled} Enrolled</span>
            </div>
          ))}
          <div style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#fcd34d' }}>
            <Trophy size={14} />
            <span style={{ fontWeight: 600 }}>Total Strength</span>
            <span style={{ opacity: 0.9 }}>{totalEnrolled} Students</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px', borderBottom: '1px solid #e2e8f0', paddingBottom: '0' }}>
        {['Executive Dashboard & Charts', 'Department & Course Reports', 'Full Student Leaderboard', 'Student Rank & Profile Lookup'].map((tab, i) => (
          <div key={tab} style={{ 
            padding: '12px 4px', 
            fontSize: '0.9rem', 
            fontWeight: i === 0 ? 600 : 500, 
            color: i === 0 ? '#1e40af' : '#64748b',
            borderBottom: i === 0 ? '3px solid #1e40af' : '3px solid transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            {i === 0 && <Activity size={16} />}
            {i === 1 && <BookOpen size={16} />}
            {i === 2 && <Trophy size={16} />}
            {i === 3 && <Users size={16} />}
            {tab}
          </div>
        ))}
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {[
          { label: 'TOTAL DEPT ENROLLED', value: totalEnrolled, icon: <Building2 size={20} color="#3b82f6" />, desc: `${activeStudents.length} Active | ${totalEnrolled - activeStudents.length} Inactive` },
          { label: 'SHEET SUBMISSIONS', value: successfulScrapes, icon: <CheckSquare size={20} color="#10b981" />, desc: `${((successfulScrapes/totalEnrolled)*100).toFixed(1)}% of total successfully parsed` },
          { label: 'TOTAL PROBLEMS SOLVED', value: totalSolved.toLocaleString(), icon: <Target size={20} color="#f59e0b" />, desc: `${diffData.find(d=>d.name==='Easy Problems')?.value.toLocaleString() || 0} E • ${diffData.find(d=>d.name==='Medium Problems')?.value.toLocaleString() || 0} M • ${diffData.find(d=>d.name==='Hard Problems')?.value.toLocaleString() || 0} H` },
          { label: 'AVG SOLVED (ACTIVE)', value: avgActive, icon: <Zap size={20} color="#8b5cf6" />, desc: 'Per student with >0 solved' },
          { label: 'AVG SOLVED (ENROLLED)', value: avgEnrolled, icon: <Users size={20} color="#64748b" />, desc: `Across all ${totalEnrolled} enrolled` },
        ].map((kpi, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: i === 0 ? '#3b82f6' : i === 1 ? '#10b981' : i === 2 ? '#f59e0b' : i === 3 ? '#8b5cf6' : '#94a3b8' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.5px' }}>{kpi.label}</div>
              <div style={{ background: '#f8fafc', padding: '6px', borderRadius: '8px' }}>{kpi.icon}</div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px', lineHeight: 1 }}>{kpi.value}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>{kpi.desc}</div>
          </div>
        ))}
      </div>

      {/* Course-Wise Performance Breakdown */}
      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '20px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Layers size={22} color="#2563eb" /> Course-Wise Performance Breakdown
      </h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {branchData.map((branch, i) => (
          <div key={branch.name} style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', background: '#eff6ff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>{branch.name}</div>
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', background: '#d1fae5', padding: '4px 10px', borderRadius: '6px' }}>{branch.turnout}% Turnout</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>ENROLLED VS ACTIVE</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{branch.active} <span style={{fontSize: '0.9rem', color: '#94a3b8', fontWeight: 500}}>/ {branch.enrolled}</span></div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>{branch.enrolled - branch.active} Not yet submitted</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>TOTAL SOLVED</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{branch.totalSolved.toLocaleString()}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>Max: {branch.topStudent?.totalSolved || 0}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>AVG / ACTIVE</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3b82f6' }}>{branch.avgActive}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>per active student</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>AVG / ENROLLED</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>{branch.avgEnrolled}</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>across all enrolled</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                Top: <span style={{ fontWeight: 700, color: '#0f172a' }}>{branch.topStudent?.name || 'N/A'}</span> <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>({branch.topStudent?.totalSolved || 0} solved)</span>
              </div>
              <button style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e40af', background: 'transparent', border: '1px solid #1e40af', padding: '4px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                View Students <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 2x2 Chart Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        
        {/* Course Participation & Enrolled Turnout */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Activity size={16} color="#3b82f6" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Course Participation & Enrolled Turnout</h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '24px' }}>Enrolled Department Strength vs Active Leetcode Profiles</p>
          
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={branchData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontSize: '0.85rem' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '0.8rem', paddingTop: '10px' }} />
                <Bar dataKey="enrolled" name="Enrolled Total Strength" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="active" name="Active Sheet Submissions" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Average Problems Solved per Student */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <BookOpen size={16} color="#f59e0b" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Average Problems Solved per Student</h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '24px' }}>Comparison of Avg per Active Student vs Avg per Total Enrolled</p>
          
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={branchData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontSize: '0.85rem' }} />
                <Legend iconType="square" wrapperStyle={{ fontSize: '0.8rem', paddingTop: '10px' }} />
                <Bar dataKey="avgActive" name="Avg Solved per Active Student" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="avgEnrolled" name="Avg Solved per Enrolled Student" fill="#475569" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Problem Difficulty Breakdown */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Target size={16} color="#10b981" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Department Problem Difficulty Breakdown</h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '24px' }}>Total solved distributed across Easy, Medium, and Hard</p>
          
          <div style={{ width: '100%', height: 300, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={diffData}
                  cx="50%"
                  cy="50%"
                  innerRadius={75}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {diffData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number) => [value.toLocaleString(), 'Solved']} 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontWeight: 600 }} 
                />
                <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '0.85rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Performance Brackets & Tier Distribution */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Users size={16} color="#8b5cf6" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Performance Brackets & Tier Distribution</h3>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '24px' }}>Count of students grouped by problem range solved</p>
          
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={tierData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontSize: '0.85rem' }} />
                <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]} barSize={45}>
                  {tierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_TIER[index % COLORS_TIER.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Top 10 High-Scoring Students Leaderboard */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '28px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Medal size={20} color="#f59e0b" />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Top 10 High-Scoring Students (Global)</h3>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '32px' }}>Leaderboard breakdown across Easy, Medium, and Hard solved problems.</p>
        
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <BarChart data={top10Students} layout="vertical" margin={{ top: 0, right: 30, left: 60, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }} width={120} />
              <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', fontSize: '0.85rem' }} />
              <Legend wrapperStyle={{ fontSize: '0.85rem', paddingTop: '10px' }} />
              <Bar dataKey="easy" name="Easy" stackId="a" fill={DIFF_COLORS.easy} barSize={16} />
              <Bar dataKey="medium" name="Medium" stackId="a" fill={DIFF_COLORS.medium} barSize={16} />
              <Bar dataKey="hard" name="Hard" stackId="a" fill={DIFF_COLORS.hard} barSize={16} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
