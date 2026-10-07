"use client";

import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Download } from 'lucide-react';
import { downloadCsv } from '@/lib/export/generateCsv';

const COLORS = ['#10b981', '#f59e0b', '#ef4444']; // green, yellow, red for Easy, Medium, Hard

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function DashboardCharts({ rows }: { rows: any[] }) {
  const diffData = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    let totalEasy = 0, totalMedium = 0, totalHard = 0;
    rows.forEach(r => {
      totalEasy += (r.easySolved || 0);
      totalMedium += (r.mediumSolved || 0);
      totalHard += (r.hardSolved || 0);
    });
    return [
      { name: 'Easy', value: totalEasy },
      { name: 'Medium', value: totalMedium },
      { name: 'Hard', value: totalHard },
    ];
  }, [rows]);

  const topUsers = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const validRows = rows.filter(r => (r.totalSolved || 0) > 0);
    validRows.sort((a, b) => (b.totalSolved || 0) - (a.totalSolved || 0));
    return validRows.slice(0, 10).map(r => ({
      name: r.name?.split(' ')[0] || r.rollNumber,
      solved: r.totalSolved || 0
    }));
  }, [rows]);
  
  const branchData = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const branchMap = new Map<string, { total: number, count: number }>();
    rows.forEach(r => {
      if (r.branch) {
        const existing = branchMap.get(r.branch) || { total: 0, count: 0 };
        branchMap.set(r.branch, { 
          total: existing.total + (r.totalSolved || 0), 
          count: existing.count + 1 
        });
      }
    });
    return Array.from(branchMap.entries()).map(([branch, stats]) => ({
      name: branch,
      average: Math.round(stats.total / stats.count)
    }));
  }, [rows]);

  if (!rows || rows.length === 0) return null;

  const downloadGraphCsv = (headers: string[], data: any[], filename: string) => {
    let csv = headers.join(',') + '\n';
    data.forEach(item => {
      csv += Object.values(item).join(',') + '\n';
    });
    downloadCsv(csv, filename);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
      
      {/* Top 10 Students */}
      <div className="dashboard-card" style={{ padding: '24px', borderRadius: '12px', background: 'white', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)' }}>Top 10 Students</h3>
          <button 
            onClick={() => downloadGraphCsv(['Name', 'Solved'], topUsers, 'top_10_students.csv')}
            title="Download Data"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
          >
            <Download size={18} />
          </button>
        </div>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={topUsers} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} angle={-45} textAnchor="end" />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
              <RechartsTooltip cursor={{ fill: 'var(--surface-hover)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
              <Bar dataKey="solved" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Difficulty Distribution */}
      <div className="dashboard-card" style={{ padding: '24px', borderRadius: '12px', background: 'white', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)' }}>Difficulty Distribution (Total)</h3>
          <button 
            onClick={() => downloadGraphCsv(['Difficulty', 'Questions Solved'], diffData, 'difficulty_distribution.csv')}
            title="Download Data"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
          >
            <Download size={18} />
          </button>
        </div>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={diffData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }: { name: string, percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {diffData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                 ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => [`${value} questions`, 'Solved']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Average Solved by Branch */}
      {branchData.length > 0 && (
        <div className="dashboard-card" style={{ padding: '24px', borderRadius: '12px', background: 'white', border: '1px solid var(--surface-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)' }}>Avg. Solved by Branch</h3>
            <button 
              onClick={() => downloadGraphCsv(['Branch', 'Average Solved'], branchData, 'avg_solved_by_branch.csv')}
              title="Download Data"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}
            >
              <Download size={18} />
            </button>
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={branchData} margin={{ top: 5, right: 20, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} angle={-45} textAnchor="end" />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <RechartsTooltip cursor={{ fill: 'var(--surface-hover)' }} formatter={(value: number) => [`${value} average solved`, 'Average']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }} />
                <Bar dataKey="average" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
  );
}
