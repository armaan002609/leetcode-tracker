"use client";

import { useEffect, useState, useMemo } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Activity } from "lucide-react";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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

  // Derived Data
  const branchData = useMemo(() => {
    if (!rows.length) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, any>();
    rows.forEach(r => {
      if (!r.branch) return;
      if (!map.has(r.branch)) {
        map.set(r.branch, { branch: r.branch, count: 0, easy: 0, medium: 0, hard: 0, total: 0 });
      }
      const existing = map.get(r.branch);
      existing.count += 1;
      existing.easy += (r.easySolved || 0);
      existing.medium += (r.mediumSolved || 0);
      existing.hard += (r.hardSolved || 0);
      existing.total += (r.totalSolved || 0);
    });
    return Array.from(map.values()).map(b => ({
      ...b,
      avgTotal: Math.round(b.total / b.count)
    }));
  }, [rows]);

  const activityData = useMemo(() => {
    if (!rows.length) return [];
    let inactive = 0;
    let beginner = 0;
    let intermediate = 0;
    let advanced = 0;

    rows.forEach(r => {
      const total = r.totalSolved || 0;
      if (total === 0) inactive++;
      else if (total < 50) beginner++;
      else if (total < 200) intermediate++;
      else advanced++;
    });

    return [
      { name: '0 Solved (Inactive)', value: inactive },
      { name: '1-49 Solved (Beginner)', value: beginner },
      { name: '50-199 Solved (Intermediate)', value: intermediate },
      { name: '200+ Solved (Advanced)', value: advanced },
    ];
  }, [rows]);
  
  const sectionData = useMemo(() => {
    if (!rows.length) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, any>();
    rows.forEach(r => {
      if (!r.section) return;
      if (!map.has(r.section)) {
        map.set(r.section, { section: r.section, count: 0, total: 0 });
      }
      const existing = map.get(r.section);
      existing.count += 1;
      existing.total += (r.totalSolved || 0);
    });
    return Array.from(map.values())
      .map(s => ({ section: s.section, avgSolved: Math.round(s.total / s.count) }))
      .sort((a, b) => b.avgSolved - a.avgSolved);
  }, [rows]);

  if (!isReady || status === "loading") {
    return (
      <div className="enterprise-loader-wrapper">
        <div className="pulse-logo">L</div>
        <div className="loader-text">Loading Analytics...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout animate-fade-in" style={{ backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--muted)', textDecoration: 'none', marginBottom: '16px', fontWeight: 500 }}>
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity color="var(--primary)" size={28} /> Detailed Analytics
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: '8px' }}>Comprehensive overview of student performance and engagement metrics.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px' }}>
        
        {/* Branch Performance - Stacked Bar */}
        <div className="dashboard-card" style={{ padding: '24px', borderRadius: '12px', background: 'white', border: '1px solid var(--surface-border)' }}>
          <h3 style={{ marginBottom: '24px', fontSize: '1.1rem', fontWeight: 600 }}>Branch Performance (Total Difficulty)</h3>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <BarChart data={branchData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
                <XAxis dataKey="branch" tick={{ fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                <Legend />
                <Bar dataKey="easy" stackId="a" fill="#10b981" name="Easy" />
                <Bar dataKey="medium" stackId="a" fill="#f59e0b" name="Medium" />
                <Bar dataKey="hard" stackId="a" fill="#ef4444" name="Hard" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Student Engagement Activity */}
        <div className="dashboard-card" style={{ padding: '24px', borderRadius: '12px', background: 'white', border: '1px solid var(--surface-border)' }}>
          <h3 style={{ marginBottom: '24px', fontSize: '1.1rem', fontWeight: 600 }}>Student Engagement (Questions Solved)</h3>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={activityData}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {activityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value) => [`${value} students`, 'Count']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section Leaderboard */}
        <div className="dashboard-card" style={{ padding: '24px', borderRadius: '12px', background: 'white', border: '1px solid var(--surface-border)' }}>
          <h3 style={{ marginBottom: '24px', fontSize: '1.1rem', fontWeight: 600 }}>Top Sections by Avg Solved</h3>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <ComposedChart data={sectionData} layout="vertical" margin={{ top: 20, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--surface-border)" />
                <XAxis type="number" tick={{ fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="section" type="category" tick={{ fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{ fill: 'var(--surface-hover)' }} formatter={(value) => [`${value} avg solved`, 'Average']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                <Bar dataKey="avgSolved" fill="#8b5cf6" barSize={20} radius={[0, 4, 4, 0]} name="Avg Solved" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Average Solved per Branch */}
        <div className="dashboard-card" style={{ padding: '24px', borderRadius: '12px', background: 'white', border: '1px solid var(--surface-border)' }}>
          <h3 style={{ marginBottom: '24px', fontSize: '1.1rem', fontWeight: 600 }}>Avg Questions Solved per Branch</h3>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <AreaChart data={branchData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
                <XAxis dataKey="branch" tick={{ fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                <Area type="monotone" dataKey="avgTotal" stroke="#3b82f6" fillOpacity={1} fill="url(#colorAvg)" name="Average Solved" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
