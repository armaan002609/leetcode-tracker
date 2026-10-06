"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { parseCsv } from "@/lib/validation/parseCsv";
import { parseXlsx } from "@/lib/validation/parseXlsx";
import { StudentRow } from "@/lib/validation/rowSchema";
import { saveJobToSession } from "@/lib/orchestration/store";
import { UploadCloud, CheckCircle2, AlertCircle, Menu, Home, Search, Grid, User } from "lucide-react";
import Link from "next/link";

export default function UploadPage() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<"bulk" | "manual">("bulk");
  const [rows, setRows] = useState<Omit<StudentRow, "id">[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [manualForm, setManualForm] = useState({
    name: '', rollNumber: '', branch: '', semester: '1st', section: 'A', mentor: '', url: ''
  });
  const [mentorDesignation, setMentorDesignation] = useState('Mr.');
  const [manualError, setManualError] = useState('');
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');
    setIsSubmittingManual(true);
    try {
      const payload = {
        ...manualForm,
        mentor: `${mentorDesignation} ${manualForm.mentor}`.trim()
      };
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([payload])
      });
      if (!res.ok) {
        let err = await res.text();
        try {
          const parsed = JSON.parse(err);
          err = parsed.error || err;
        } catch(e) {}
        throw new Error(err);
      }
      router.push('/');
    } catch(e: any) {
      setManualError(e.message || 'An error occurred saving the data.');
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setErrors([]);
    setRows([]);

    if (file.size > 5 * 1024 * 1024) {
      setErrors(["File exceeds 5MB limit."]);
      setIsProcessingFile(false);
      return;
    }

    let result: { rows: Omit<StudentRow, "id">[], errors: string[] } | null = null;
    
    if (file.name.endsWith('.csv')) {
      result = await parseCsv(file);
    } else if (file.name.endsWith('.xlsx')) {
      result = await parseXlsx(file);
    } else {
      setErrors(["Unsupported file type. Please upload a .csv or .xlsx file."]);
      setIsProcessingFile(false);
      return;
    }

    if (result.rows.length > 1000) {
      setErrors(["File exceeds 1,000 row limit. Please split your batch."]);
      setIsProcessingFile(false);
      return;
    }

    const rollNumbers = new Set<string>();
    const duplicateErrors: string[] = [];
    result.rows.forEach(r => {
      if (r.rollNumber) {
        if (rollNumbers.has(r.rollNumber)) {
          duplicateErrors.push(`Duplicate Roll Number found: ${r.rollNumber}`);
        } else {
          rollNumbers.add(r.rollNumber);
        }
      }
    });

    setRows(result.rows);
    setErrors([...result.errors, ...duplicateErrors]);
    setIsProcessingFile(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleStartRun = async () => {
    const validRows = rows.filter(r => !r.validationError).map(r => ({
      ...r,
    }));
    
    if (validRows.length === 0) return;

    setIsProcessingFile(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validRows)
      });
      
      if (!res.ok) {
        let errorMsg = `Server error ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.error) errorMsg += `: ${errData.error}`;
          if (errData.details) errorMsg += ` - ${JSON.stringify(errData.details)}`;
        } catch(e) {
          errorMsg += `: ${await res.text()}`;
        }
        throw new Error(errorMsg);
      }
      
      router.push(`/`); // Redirect to dashboard
    } catch (e: any) {
      setErrors([e.message || 'An error occurred saving the data.']);
      setIsProcessingFile(false);
    }
  };

  return (
    <div className="dashboard-layout animate-fade-in">
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

      <main className="main-content">
        <div className="curved-banner-container">
          <div className="curved-banner"></div>
        </div>

        <div className="profile-banner">
          <div className="profile-avatar">
            <User size={32} />
          </div>
          <div className="profile-info">
            <h2>Data Upload</h2>
            <div style={{opacity: 0.8, fontSize: '0.9rem', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6}}>
              <div style={{width: 24, height: 24, background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <span style={{color: 'var(--primary)', fontWeight: 'bold', fontSize: 12}}>L</span>
              </div>
              Upload Data
            </div>
          </div>
        </div>

        <div style={{maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 1, padding: '20px 0'}}>
          <div className="dashboard-card p-4">
            <div className="card-header" style={{borderBottom: 'none'}}>
              <div className="flex gap-4 border-b border-surface-border w-full">
                <button 
                  onClick={() => setActiveTab("bulk")}
                  style={{paddingBottom: 16, fontWeight: 500, color: activeTab === 'bulk' ? 'var(--primary)' : 'var(--muted)', borderBottom: activeTab === 'bulk' ? '2px solid var(--primary)' : 'none'}}
                >
                  Bulk Upload
                </button>
                <button 
                  onClick={() => setActiveTab("manual")}
                  style={{paddingBottom: 16, fontWeight: 500, color: activeTab === 'manual' ? 'var(--primary)' : 'var(--muted)', borderBottom: activeTab === 'manual' ? '2px solid var(--primary)' : 'none'}}
                >
                  Manual Entry
                </button>
              </div>
            </div>

            <div className="card-body">
              {activeTab === "bulk" && (
                <div>
                  {rows.length === 0 && !isProcessingFile ? (
                    <div style={{border: '2px dashed var(--surface-border)', borderRadius: 'var(--radius-md)', padding: '64px 24px', textAlign: 'center'}}>
                      <UploadCloud className="mx-auto text-muted mb-4" size={48} />
                      <h3 className="text-lg font-medium mb-2">Upload Roster File</h3>
                      <p className="text-sm text-muted mb-6 max-w-sm mx-auto">
                        Accepts .csv or .xlsx files up to 5MB (max 1000 rows). Must contain Roll Number, Name, Branch, Semester, Section, Mentor Name, and LeetCode URL columns.
                      </p>
                      
                      <input 
                        type="file" 
                        accept=".csv, .xlsx" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        style={{display: 'none'}}
                      />
                      
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-primary"
                      >
                        Browse Files
                      </button>
                    </div>
                  ) : isProcessingFile ? (
                    <div className="text-center py-12">
                      <div className="animate-spin mx-auto mb-4" style={{width: 32, height: 32, border: '4px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%'}}></div>
                      <p>Validating file...</p>
                    </div>
                  ) : (
                    <div className="animate-fade-in">
                      <h3 className="text-xl font-semibold mb-4">Validation Summary</h3>
                      
                      <div className="flex items-center gap-4 mb-6">
                        <div className="flex items-center gap-2 text-success">
                          <CheckCircle2 size={20} />
                          <span>{rows.filter(r => !r.validationError).length} Valid Rows</span>
                        </div>
                        {errors.length > 0 && (
                          <div className="flex items-center gap-2 text-danger">
                            <AlertCircle size={20} />
                            <span>{errors.length} Errors Found</span>
                          </div>
                        )}
                      </div>

                      {errors.length > 0 && (
                        <div className="mb-6" style={{background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: 16, borderRadius: 8, maxHeight: 200, overflowY: 'auto'}}>
                          <ul className="text-sm text-danger" style={{paddingLeft: 20}}>
                            {errors.map((err, i) => <li key={i} style={{marginBottom: 4}}>{err}</li>)}
                          </ul>
                        </div>
                      )}

                      <div className="flex justify-end gap-4 mt-8 pt-6" style={{borderTop: '1px solid var(--surface-border)'}}>
                        <button 
                          onClick={() => { setRows([]); setErrors([]); }}
                          className="btn"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleStartRun}
                          disabled={rows.filter(r => !r.validationError).length === 0}
                          className="btn btn-primary"
                          style={{opacity: rows.filter(r => !r.validationError).length === 0 ? 0.5 : 1}}
                        >
                          Proceed with {rows.filter(r => !r.validationError).length} rows
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "manual" && (
                <div style={{ padding: '24px' }} className="animate-fade-in">
                  <h3 className="text-xl font-semibold mb-6">Manual Student Entry</h3>
                  {manualError && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--destructive)', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px' }}>
                      {manualError}
                    </div>
                  )}
                  <form onSubmit={handleManualSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Name *</label>
                      <input required type="text" value={manualForm.name} onChange={e => setManualForm({...manualForm, name: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Roll Number *</label>
                      <input required type="text" value={manualForm.rollNumber} onChange={e => setManualForm({...manualForm, rollNumber: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Branch *</label>
                      <input required type="text" value={manualForm.branch} onChange={e => setManualForm({...manualForm, branch: e.target.value})} placeholder="e.g. CSE" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Semester *</label>
                      <select required value={manualForm.semester} onChange={e => setManualForm({...manualForm, semester: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                        {["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"].map(sem => (
                          <option key={sem} value={sem}>{sem}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Section *</label>
                      <select required value={manualForm.section} onChange={e => setManualForm({...manualForm, section: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                        {Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i)).map(sec => (
                          <option key={sec} value={sec}>{sec}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mentor Name *</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <select 
                          value={mentorDesignation} 
                          onChange={e => setMentorDesignation(e.target.value)} 
                          style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                        >
                          <option value="Mr.">Mr.</option>
                          <option value="Ms.">Ms.</option>
                          <option value="Mrs.">Mrs.</option>
                          <option value="Dr.">Dr.</option>
                        </select>
                        <input required type="text" value={manualForm.mentor} onChange={e => setManualForm({...manualForm, mentor: e.target.value})} style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)', flex: 1 }} />
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>LeetCode URL *</label>
                      <input required type="url" value={manualForm.url} onChange={e => setManualForm({...manualForm, url: e.target.value})} placeholder="https://leetcode.com/username/" style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }} />
                    </div>
                    
                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', paddingTop: '20px', borderTop: '1px solid var(--surface-border)' }}>
                      <button type="button" onClick={() => {
                        setManualForm({name: '', rollNumber: '', branch: '', semester: '1st', section: 'A', mentor: '', url: ''});
                        setMentorDesignation('Mr.');
                      }} className="btn">Clear</button>
                      <button type="submit" disabled={isSubmittingManual} className="btn btn-primary">
                        {isSubmittingManual ? 'Saving...' : 'Add Student'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
