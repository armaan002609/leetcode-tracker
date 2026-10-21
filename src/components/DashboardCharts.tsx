"use client";

import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Download, Trophy, Award, BarChart3, PieChart as PieIcon, 
  Users, ChevronRight, Layers, TrendingUp, Sparkles, Building2
} from 'lucide-react';
import { downloadCsv } from '@/lib/export/generateCsv';

// Authentic LeetCode color scheme
const DIFFICULTY_COLORS = {
  easy: '#00b8a3',   // LeetCode teal
  medium: '#ffc01e', // LeetCode amber
  hard: '#ef4444',   // LeetCode red
};

interface DashboardChartsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
  onSelectStudent?: (id: string) => void;
}

export default function DashboardCharts({ rows, onSelectStudent }: DashboardChartsProps) {
  const [leaderboardView, setLeaderboardView] = useState<'list' | 'chart'>('list');
  const [topCount, setTopCount] = useState<5 | 10>(10);
  const [cohortMetric, setCohortMetric] = useState<'average' | 'total' | 'activeRate'>('average');

  // 1. Difficulty Distribution Data
  const diffData = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    let totalEasy = 0, totalMedium = 0, totalHard = 0;
    rows.forEach(r => {
      totalEasy += (r.easySolved || 0);
      totalMedium += (r.mediumSolved || 0);
      totalHard += (r.hardSolved || 0);
    });
    const grandTotal = totalEasy + totalMedium + totalHard;
    return [
      { 
        name: 'Easy', 
        value: totalEasy, 
        color: DIFFICULTY_COLORS.easy,
        percentage: grandTotal > 0 ? ((totalEasy / grandTotal) * 100).toFixed(1) : '0'
      },
      { 
        name: 'Medium', 
        value: totalMedium, 
        color: DIFFICULTY_COLORS.medium,
        percentage: grandTotal > 0 ? ((totalMedium / grandTotal) * 100).toFixed(1) : '0'
      },
      { 
        name: 'Hard', 
        value: totalHard, 
        color: DIFFICULTY_COLORS.hard,
        percentage: grandTotal > 0 ? ((totalHard / grandTotal) * 100).toFixed(1) : '0'
      },
    ];
  }, [rows]);

  const totalQuestionsSolved = useMemo(() => {
    return diffData.reduce((acc, curr) => acc + curr.value, 0);
  }, [diffData]);

  // 2. Top Students Leaderboard Data
  const topUsers = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const validRows = rows.filter(r => (r.totalSolved || 0) > 0);
    validRows.sort((a, b) => (b.totalSolved || 0) - (a.totalSolved || 0));
    return validRows.slice(0, 10).map((r, index) => ({
      rank: index + 1,
      id: r.id,
      name: r.name || 'Unknown',
      rollNumber: r.rollNumber,
      branch: r.branch || '—',
      section: r.section || '',
      solved: r.totalSolved || 0,
      easy: r.easySolved || 0,
      medium: r.mediumSolved || 0,
      hard: r.hardSolved || 0,
      globalRank: r.globalRank,
    }));
  }, [rows]);

  // Data formatted specifically for the horizontal bar chart
  const horizontalChartData = useMemo(() => {
    return topUsers.slice(0, topCount).map(u => ({
      ...u,
      // Short display name with roll number snippet if needed
      displayName: u.name.length > 14 ? u.name.slice(0, 13) + '…' : u.name,
    })).reverse(); // Reverse so #1 is at top of vertical axis
  }, [topUsers, topCount]);

  // 3. Cohort / Group Comparison (Branch or Sections)
  const cohortData = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    
    // Check if branches exist
    const hasBranches = rows.some(r => !!r.branch);
    const key = hasBranches ? 'branch' : 'section';

    const groupMap = new Map<string, { total: number; count: number; active: number }>();
    rows.forEach(r => {
      const groupVal = r[key] || 'Unassigned';
      const existing = groupMap.get(groupVal) || { total: 0, count: 0, active: 0 };
      const solved = r.totalSolved || 0;
      groupMap.set(groupVal, { 
        total: existing.total + solved, 
        count: existing.count + 1,
        active: existing.active + (solved > 0 ? 1 : 0)
      });
    });

    return Array.from(groupMap.entries())
      .filter(([name]) => name !== 'Unassigned' || groupMap.size === 1)
      .map(([name, stats]) => ({
        name: key === 'section' ? `Sec ${name}` : name,
        studentsCount: stats.count,
        activeCount: stats.active,
        totalSolved: stats.total,
        average: Math.round(stats.total / (stats.count || 1)),
        activeRate: Math.round((stats.active / (stats.count || 1)) * 100),
      }))
      .sort((a, b) => b.average - a.average);
  }, [rows]);

  if (!rows || rows.length === 0) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const downloadGraphCsv = (headers: string[], data: any[], filename: string) => {
    let csv = headers.join(',') + '\n';
    data.forEach(item => {
      csv += Object.values(item).join(',') + '\n';
    });
    downloadCsv(csv, filename);
  };

  return (
    <div className="dashboard-charts-grid" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
      gap: '24px',
      marginBottom: '32px'
    }}>
      
      {/* ========================================================
          CARD 1: Top Students (Leaderboard / Ranking)
      ======================================================== */}
      <div className="chart-card" style={{
        background: 'var(--surface)',
        borderRadius: '16px',
        border: '1px solid var(--surface-border)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(to right, #fafafa, #ffffff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(164, 14, 25, 0.08)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Trophy size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>
                Top Performers
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>
                Ranked by verified problems solved
              </p>
            </div>
          </div>

          {/* Controls: List vs Chart & Top 5/10 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              display: 'flex',
              background: 'var(--muted-background)',
              padding: '2px',
              borderRadius: '8px'
            }}>
              <button
                type="button"
                onClick={() => setLeaderboardView('list')}
                title="Leaderboard List"
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: leaderboardView === 'list' ? 'white' : 'transparent',
                  color: leaderboardView === 'list' ? 'var(--primary)' : 'var(--muted)',
                  boxShadow: leaderboardView === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setLeaderboardView('chart')}
                title="Bar Chart"
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: leaderboardView === 'chart' ? 'white' : 'transparent',
                  color: leaderboardView === 'chart' ? 'var(--primary)' : 'var(--muted)',
                  boxShadow: leaderboardView === 'chart' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                Chart
              </button>
            </div>

            <button
              type="button"
              onClick={() => setTopCount(c => c === 10 ? 5 : 10)}
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'var(--muted-background)',
                color: 'var(--muted)',
                cursor: 'pointer'
              }}
              title="Toggle Top 5 / Top 10"
            >
              Top {topCount}
            </button>

            <button
              type="button"
              onClick={() => downloadGraphCsv(['Rank', 'Name', 'Roll Number', 'Branch', 'Solved'], topUsers, 'top_students.csv')}
              title="Download CSV"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ padding: '16px 20px', flex: 1, minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
          {topUsers.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: '0.9rem' }}>
              No problems solved yet in this filter.
            </div>
          ) : leaderboardView === 'list' ? (
            /* Ranked List with Medals and Breakdown */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '320px', paddingRight: '4px' }}>
              {topUsers.slice(0, topCount).map((user) => {
                const isMedal = user.rank <= 3;
                const medalBg = 
                  user.rank === 1 ? '#fef3c7' : 
                  user.rank === 2 ? '#f1f5f9' : 
                  user.rank === 3 ? '#ffedd5' : 'var(--muted-background)';
                const medalColor = 
                  user.rank === 1 ? '#d97706' : 
                  user.rank === 2 ? '#475569' : 
                  user.rank === 3 ? '#ea580c' : 'var(--muted)';
                const medalIcon = 
                  user.rank === 1 ? '🥇' : 
                  user.rank === 2 ? '🥈' : 
                  user.rank === 3 ? '🥉' : `#${user.rank}`;

                return (
                  <div
                    key={user.id || user.rollNumber}
                    onClick={() => user.id && onSelectStudent && onSelectStudent(user.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: isMedal ? 'rgba(248, 250, 252, 0.8)' : 'transparent',
                      border: '1px solid',
                      borderColor: isMedal ? 'rgba(226, 232, 240, 0.9)' : 'transparent',
                      cursor: onSelectStudent ? 'pointer' : 'default',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'var(--surface-hover)';
                      e.currentTarget.style.transform = 'translateX(2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = isMedal ? 'rgba(248, 250, 252, 0.8)' : 'transparent';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    {/* Rank Badge + Name */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: medalBg,
                        color: medalColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: isMedal ? '0.95rem' : '0.78rem',
                        flexShrink: 0
                      }}>
                        {medalIcon}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          color: 'var(--foreground)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {user.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'flex', gap: '6px' }}>
                          <span>{user.rollNumber}</span>
                          {user.branch !== '—' && <span>• {user.branch}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Solved Count + Micro Difficulty Breakdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)' }}>
                          {user.solved}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>solved</span>
                      </div>
                      {/* Micro Difficulty Segment Bar */}
                      <div style={{
                        display: 'flex',
                        width: '70px',
                        height: '4px',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        background: 'var(--surface-border)'
                      }}>
                        <div style={{ width: `${(user.easy / (user.solved || 1)) * 100}%`, background: DIFFICULTY_COLORS.easy }} title={`Easy: ${user.easy}`} />
                        <div style={{ width: `${(user.medium / (user.solved || 1)) * 100}%`, background: DIFFICULTY_COLORS.medium }} title={`Medium: ${user.medium}`} />
                        <div style={{ width: `${(user.hard / (user.solved || 1)) * 100}%`, background: DIFFICULTY_COLORS.hard }} title={`Hard: ${user.hard}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Horizontal Bar Chart View */
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={horizontalChartData}
                  margin={{ top: 8, right: 30, left: 10, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--surface-border)" />
                  <XAxis 
                    type="number" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: 'var(--muted)' }} 
                  />
                  <YAxis 
                    dataKey="displayName" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: 'var(--foreground)', fontWeight: 500 }} 
                    width={90}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: 'var(--surface-hover)' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div style={{
                          background: 'white',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          boxShadow: 'var(--shadow-md)',
                          border: '1px solid var(--surface-border)',
                          fontSize: '0.8rem'
                        }}>
                          <div style={{ fontWeight: 700, marginBottom: '4px', color: 'var(--foreground)' }}>
                            {data.name} ({data.rollNumber})
                          </div>
                          <div style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: '6px' }}>
                            {data.solved} Total Questions Solved
                          </div>
                          <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
                            <span style={{ color: DIFFICULTY_COLORS.easy }}>Easy: {data.easy}</span>
                            <span style={{ color: DIFFICULTY_COLORS.medium }}>Med: {data.medium}</span>
                            <span style={{ color: DIFFICULTY_COLORS.hard }}>Hard: {data.hard}</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar 
                    dataKey="solved" 
                    fill="var(--primary)" 
                    radius={[0, 6, 6, 0]} 
                    barSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          CARD 2: Difficulty Distribution (LeetCode Mastery Donut)
      ======================================================== */}
      <div className="chart-card" style={{
        background: 'var(--surface)',
        borderRadius: '16px',
        border: '1px solid var(--surface-border)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(to right, #fafafa, #ffffff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.08)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <PieIcon size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>
                Difficulty Distribution
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>
                Aggregated problem breakdown
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => downloadGraphCsv(['Difficulty', 'Questions Solved', 'Percentage'], diffData, 'difficulty_distribution.csv')}
            title="Download CSV"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Download size={16} />
          </button>
        </div>

        {/* Content Area: Donut Chart with Center Metric */}
        <div style={{ padding: '16px 20px', flex: 1, minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', width: '100%', height: '180px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={diffData}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {diffData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  formatter={(value: number, name: string) => [
                    `${value.toLocaleString()} questions (${diffData.find(d => d.name === name)?.percentage}%)`, 
                    name
                  ]}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid var(--surface-border)',
                    boxShadow: 'var(--shadow-md)',
                    fontSize: '0.8rem'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Clean Center Metric Badge */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.1 }}>
                {totalQuestionsSolved.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Solved
              </div>
            </div>
          </div>

          {/* Breakdown Cards below the Donut */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginTop: 'auto',
            paddingTop: '12px'
          }}>
            {diffData.map((d) => (
              <div
                key={d.name}
                style={{
                  background: 'var(--muted-background)',
                  borderRadius: '10px',
                  padding: '10px 8px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--foreground)' }}>
                    {d.name}
                  </span>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  {d.value.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--muted)' }}>
                  {d.percentage}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================
          CARD 3: Cohort & Branch Solved Comparison
      ======================================================== */}
      <div className="chart-card" style={{
        background: 'var(--surface)',
        borderRadius: '16px',
        border: '1px solid var(--surface-border)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid var(--surface-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(to right, #fafafa, #ffffff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(59, 130, 246, 0.08)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>
                Cohort Comparison
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>
                Performance benchmark across cohorts
              </p>
            </div>
          </div>

          {/* Metric Selector & CSV */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={cohortMetric}
              onChange={(e) => setCohortMetric(e.target.value as any)}
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'var(--muted-background)',
                border: '1px solid var(--surface-border)',
                color: 'var(--foreground)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="average">Avg Solved</option>
              <option value="total">Total Solved</option>
              <option value="activeRate">Active Rate %</option>
            </select>

            <button
              type="button"
              onClick={() => downloadGraphCsv(['Cohort', 'Students', 'Active Solvers', 'Total Solved', 'Average'], cohortData, 'cohort_benchmark.csv')}
              title="Download CSV"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ padding: '16px 20px', flex: 1, minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
          {cohortData.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: '0.9rem' }}>
              No cohort or branch metadata available.
            </div>
          ) : (
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cohortData}
                  margin={{ top: 15, right: 20, bottom: 25, left: -10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: 'var(--foreground)', fontWeight: 500 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: 'var(--muted)' }} 
                  />
                  <RechartsTooltip 
                    cursor={{ fill: 'var(--surface-hover)' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{
                          background: 'white',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          boxShadow: 'var(--shadow-md)',
                          border: '1px solid var(--surface-border)',
                          fontSize: '0.8rem'
                        }}>
                          <div style={{ fontWeight: 700, color: 'var(--foreground)', marginBottom: '4px' }}>
                            {d.name}
                          </div>
                          <div style={{ color: '#3b82f6', fontWeight: 600 }}>
                            {cohortMetric === 'average' && `${d.average} Avg Questions Solved`}
                            {cohortMetric === 'total' && `${d.totalSolved.toLocaleString()} Total Questions Solved`}
                            {cohortMetric === 'activeRate' && `${d.activeRate}% Active Solvers`}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '4px' }}>
                            {d.studentsCount} Students ({d.activeCount} active)
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar 
                    dataKey={cohortMetric} 
                    fill="#3b82f6" 
                    radius={[6, 6, 0, 0]} 
                    barSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
