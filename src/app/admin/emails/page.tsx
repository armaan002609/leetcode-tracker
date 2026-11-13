"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Mail, UploadCloud, CheckCircle2, AlertCircle, 
  Download, Search, Save, Edit2, Users, Database, Target, Trash2, X, RefreshCw
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export default function StudentEmailsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"bulk" | "manual">("bulk");
  const [stats, setStats] = useState({ totalStudents: 0, studentsWithEmail: 0, studentsWithoutEmail: 0 });
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "missing" | "has_email">("all");

  // Bulk Upload states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<Array<{ rollNumber: string; email: string }>>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState("");
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // Manual update states
  const [manualRoll, setManualRoll] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualSuccess, setManualSuccess] = useState("");
  const [manualError, setManualError] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Inline editing state in table
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState("");
  const [isSavingInline, setIsSavingInline] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && (session?.user as any)?.role !== "admin") {
      router.push("/");
    } else if (status === "authenticated") {
      fetchData();
    }
  }, [status, router, session, filterType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/emails?filter=${filterType}&search=${encodeURIComponent(searchTerm)}`);
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalStudents: data.totalStudents,
          studentsWithEmail: data.studentsWithEmail,
          studentsWithoutEmail: data.studentsWithoutEmail,
        });
        setStudents(data.students);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // Helper to extract values from diverse column names
  const getCol = (row: any, keys: string[]) => {
    const rowKeys = Object.keys(row);
    for (const k of keys) {
      const match = rowKeys.find(rk => rk.toLowerCase().replace(/[^a-z0-9]/g, '') === k);
      if (match && row[match] != null) return String(row[match]).trim();
    }
    return "";
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setBulkError("");
    setBulkSuccess("");
    setParsedRows([]);

    try {
      if (file.name.endsWith(".csv")) {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const rows: Array<{ rollNumber: string; email: string }> = [];
            results.data.forEach((row: any) => {
              const rollNumber = getCol(row, ["rollnumber", "rollno", "id", "roll", "studentroll"]);
              const email = getCol(row, ["email", "emailid", "mail", "studentemail"]);
              if (rollNumber && email && email.includes("@")) {
                rows.push({ rollNumber, email: email.toLowerCase() });
              }
            });

            if (rows.length === 0) {
              setBulkError("No valid rows found. File must contain 'Roll Number' and 'Email' columns.");
            } else {
              setParsedRows(rows);
            }
            setIsProcessingFile(false);
          },
          error: (err) => {
            setBulkError(err.message || "Failed to parse CSV file");
            setIsProcessingFile(false);
          }
        });
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = evt.target?.result;
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json: any[] = XLSX.utils.sheet_to_json(sheet);

            const rows: Array<{ rollNumber: string; email: string }> = [];
            json.forEach((row: any) => {
              const rollNumber = getCol(row, ["rollnumber", "rollno", "id", "roll", "studentroll"]);
              const email = getCol(row, ["email", "emailid", "mail", "studentemail"]);
              if (rollNumber && email && email.includes("@")) {
                rows.push({ rollNumber, email: email.toLowerCase() });
              }
            });

            if (rows.length === 0) {
              setBulkError("No valid rows found. File must contain 'Roll Number' and 'Email' columns.");
            } else {
              setParsedRows(rows);
            }
          } catch (err: any) {
            setBulkError(err.message || "Failed to read Excel file");
          } finally {
            setIsProcessingFile(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setBulkError("Please upload a .csv or .xlsx file.");
        setIsProcessingFile(false);
      }
    } catch (err: any) {
      setBulkError(err.message || "File processing error");
      setIsProcessingFile(false);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleApplyBulkUpdates = async () => {
    if (parsedRows.length === 0) return;
    setIsSubmittingBulk(true);
    setBulkError("");
    setBulkSuccess("");

    try {
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: parsedRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkError(data.error || "Failed to upload emails.");
      } else {
        setBulkSuccess(`Successfully updated ${data.updatedCount} students' email addresses!`);
        setParsedRows([]);
        fetchData();
      }
    } catch (err: any) {
      setBulkError(err.message || "Network error while saving emails.");
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRoll || !manualEmail) return;
    setIsSubmittingManual(true);
    setManualError("");
    setManualSuccess("");

    try {
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNumber: manualRoll, email: manualEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setManualError(data.error || "Failed to update email.");
      } else {
        setManualSuccess(`Updated email for student ${manualRoll}: ${manualEmail}`);
        setManualRoll("");
        setManualEmail("");
        fetchData();
      }
    } catch (err: any) {
      setManualError(err.message || "Network error updating student email.");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleSaveInline = async (rollNumber: string) => {
    setIsSavingInline(true);
    try {
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNumber, email: editingEmailValue.trim() }),
      });
      if (res.ok) {
        setEditingStudentId(null);
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update email.");
      }
    } catch (err: any) {
      alert(err.message || "Error saving email.");
    } finally {
      setIsSavingInline(false);
    }
  };

  return (
    <div className="dashboard-layout animate-fade-in">
      <nav className="topnav">
        <div className="topnav-brand">
          <Link href="/" className="icon-btn" style={{ background: "transparent", textDecoration: "none", color: "inherit" }} title="Back to Dashboard">
            <ArrowLeft size={20} />
          </Link>
          <div className="topnav-brand-icon">L</div>
          <span>Student Emails</span>
        </div>
        <div className="topnav-actions" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/admin/assignments" className="btn btn-outline hide-on-mobile" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", padding: "6px 12px" }}>
            <Target size={15} /> Assignments
          </Link>
          <Link href="/admin/data" className="btn btn-outline hide-on-mobile" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem", padding: "6px 12px" }}>
            <Database size={15} /> Full Data
          </Link>
        </div>
      </nav>

      <main className="main-content">
        <div className="curved-banner-container">
          <div className="curved-banner"></div>
        </div>

        <div className="profile-banner">
          <div className="profile-avatar">
            <Mail size={32} />
          </div>
          <div className="profile-info">
            <h2>Student Emails Management</h2>
            <div style={{ opacity: 0.9, fontSize: "0.9rem", marginTop: 4, lineHeight: 1.4 }}>
              Upload CSV/Excel files or manually add student emails to enable reminder notifications
            </div>
          </div>
        </div>

        <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
          
          {/* Top Metrics Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            <div className="dashboard-card" style={{ margin: 0, padding: "20px" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Total Roster Students</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "6px", color: "var(--foreground)" }}>{stats.totalStudents}</div>
            </div>
            <div className="dashboard-card" style={{ margin: 0, padding: "20px", borderLeft: "4px solid #10b981" }}>
              <div style={{ fontSize: "0.8rem", color: "#059669", textTransform: "uppercase", fontWeight: 700 }}>Has Email Address</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "6px", color: "#059669" }}>{stats.studentsWithEmail}</div>
            </div>
            <div className="dashboard-card" style={{ margin: 0, padding: "20px", borderLeft: "4px solid #f59e0b" }}>
              <div style={{ fontSize: "0.8rem", color: "#d97706", textTransform: "uppercase", fontWeight: 700 }}>Missing Email Address</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "6px", color: "#d97706" }}>{stats.studentsWithoutEmail}</div>
            </div>
          </div>

          {/* Action Tabs Card */}
          <div className="dashboard-card" style={{ margin: "0 0 24px 0" }}>
            <div className="card-header" style={{ borderBottom: "none" }}>
              <div style={{ display: "flex", gap: "20px", borderBottom: "1px solid var(--surface-border)", width: "100%" }}>
                <button
                  type="button"
                  onClick={() => setActiveTab("bulk")}
                  style={{
                    paddingBottom: 14,
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                    color: activeTab === "bulk" ? "var(--primary)" : "var(--muted)",
                    borderBottom: activeTab === "bulk" ? "2px solid var(--primary)" : "none",
                  }}
                >
                  Bulk Upload (CSV / Excel)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("manual")}
                  style={{
                    paddingBottom: 14,
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                    color: activeTab === "manual" ? "var(--primary)" : "var(--muted)",
                    borderBottom: activeTab === "manual" ? "2px solid var(--primary)" : "none",
                  }}
                >
                  Manually Add Email
                </button>
              </div>
            </div>

            <div className="card-body">
              {activeTab === "bulk" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>
                      Upload a spreadsheet with <strong>Roll Number</strong> and <strong>Email</strong> columns to bulk-update your students.
                    </p>
                    <a
                      href="/api/admin/emails/template"
                      download
                      className="btn btn-outline"
                      style={{ fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
                    >
                      <Download size={14} /> Download Sample CSV
                    </a>
                  </div>

                  {bulkError && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#ef4444", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "8px" }}>
                      <AlertCircle size={18} />
                      <span>{bulkError}</span>
                    </div>
                  )}

                  {bulkSuccess && (
                    <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#059669", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "8px" }}>
                      <CheckCircle2 size={18} />
                      <span>{bulkSuccess}</span>
                    </div>
                  )}

                  {parsedRows.length === 0 ? (
                    <div style={{ border: "2px dashed var(--surface-border)", borderRadius: "8px", padding: "48px 24px", textAlign: "center" }}>
                      <UploadCloud className="mx-auto mb-3" size={40} style={{ color: "var(--muted)" }} />
                      <h4 style={{ margin: "0 0 6px 0", fontSize: "1.05rem", fontWeight: 600 }}>Upload CSV or Excel File</h4>
                      <p style={{ margin: "0 auto 20px auto", maxWidth: 450, fontSize: "0.85rem", color: "var(--muted)" }}>
                        Supports <code>.csv</code>, <code>.xlsx</code>, and <code>.xls</code> files. Automatically pairs Roll Numbers to existing students.
                      </p>
                      <input
                        type="file"
                        accept=".csv, .xlsx, .xls"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessingFile}
                        className="btn btn-primary"
                        style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                      >
                        {isProcessingFile ? "Reading File..." : "Browse File"}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ background: "#f8fafc", border: "1px solid var(--surface-border)", padding: "16px", borderRadius: "8px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong style={{ color: "#0f172a", fontSize: "1rem" }}>{parsedRows.length} valid student emails ready to import</strong>
                          <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "2px" }}>
                            Previewing first few: {parsedRows.slice(0, 3).map(r => `${r.rollNumber} (${r.email})`).join(", ")}...
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "10px" }}>
                          <button
                            type="button"
                            onClick={() => setParsedRows([])}
                            className="btn btn-outline"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleApplyBulkUpdates}
                            disabled={isSubmittingBulk}
                            className="btn btn-primary"
                            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                          >
                            {isSubmittingBulk ? "Saving to Database..." : `Import ${parsedRows.length} Emails`}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "manual" && (
                <div>
                  <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem", color: "var(--muted)" }}>
                    Directly attach or update an email address for any student by their Roll Number.
                  </p>

                  {manualError && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#ef4444", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "8px" }}>
                      <AlertCircle size={18} />
                      <span>{manualError}</span>
                    </div>
                  )}

                  {manualSuccess && (
                    <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#059669", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "8px" }}>
                      <CheckCircle2 size={18} />
                      <span>{manualSuccess}</span>
                    </div>
                  )}

                  <form onSubmit={handleManualSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "16px", alignItems: "flex-end" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: "6px", fontSize: "0.85rem", fontWeight: 600 }}>
                        Student Roll Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={manualRoll}
                        onChange={(e) => setManualRoll(e.target.value)}
                        placeholder="e.g. 2420816"
                        style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-border)" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: "6px", fontSize: "0.85rem", fontWeight: 600 }}>
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={manualEmail}
                        onChange={(e) => setManualEmail(e.target.value)}
                        placeholder="student@example.com"
                        style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--surface-border)" }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmittingManual}
                      className="btn btn-primary"
                      style={{ padding: "10px 20px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                    >
                      <Save size={16} /> {isSubmittingManual ? "Saving..." : "Save Email"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Student Roster Table with Emails */}
          <div className="dashboard-card" style={{ margin: 0 }}>
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <h3 className="card-title" style={{ margin: 0 }}>Roster Email Status</h3>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setFilterType("all")}
                    style={{
                      padding: "4px 10px", borderRadius: "6px", fontSize: "0.8rem", border: "none", cursor: "pointer",
                      background: filterType === "all" ? "var(--primary)" : "#f1f5f9",
                      color: filterType === "all" ? "white" : "var(--muted)", fontWeight: 600
                    }}
                  >
                    All ({stats.totalStudents})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("missing")}
                    style={{
                      padding: "4px 10px", borderRadius: "6px", fontSize: "0.8rem", border: "none", cursor: "pointer",
                      background: filterType === "missing" ? "#f59e0b" : "#f1f5f9",
                      color: filterType === "missing" ? "white" : "var(--muted)", fontWeight: 600
                    }}
                  >
                    Missing Email ({stats.studentsWithoutEmail})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType("has_email")}
                    style={{
                      padding: "4px 10px", borderRadius: "6px", fontSize: "0.8rem", border: "none", cursor: "pointer",
                      background: filterType === "has_email" ? "#10b981" : "#f1f5f9",
                      color: filterType === "has_email" ? "white" : "var(--muted)", fontWeight: 600
                    }}
                  >
                    Has Email ({stats.studentsWithEmail})
                  </button>
                </div>
              </div>

              <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Search name or roll no..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--surface-border)", fontSize: "0.85rem", width: "200px" }}
                />
                <button type="submit" className="btn btn-outline" style={{ padding: "6px 12px" }}>
                  <Search size={14} />
                </button>
              </form>
            </div>

            <div className="card-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
                  <div className="animate-spin" style={{ width: 24, height: 24, border: "3px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", margin: "0 auto 8px auto" }}></div>
                  Loading student roster...
                </div>
              ) : students.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
                  No students found matching your filter.
                </div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ padding: "12px 16px" }}>Roll Number</th>
                        <th style={{ padding: "12px 16px" }}>Student Name</th>
                        <th style={{ padding: "12px 16px" }}>Branch / Section</th>
                        <th style={{ padding: "12px 16px" }}>Email Address</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student) => (
                        <tr key={student.id}>
                          <td style={{ padding: "12px 16px", fontWeight: 600 }}>{student.rollNumber}</td>
                          <td style={{ padding: "12px 16px" }}>{student.name}</td>
                          <td style={{ padding: "12px 16px", color: "var(--muted)", fontSize: "0.85rem" }}>
                            {student.branch || "-"} {student.section ? `(${student.section})` : ""}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            {editingStudentId === student.id ? (
                              <input
                                type="email"
                                value={editingEmailValue}
                                onChange={(e) => setEditingEmailValue(e.target.value)}
                                placeholder="name@example.com"
                                autoFocus
                                style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--primary)", fontSize: "0.85rem", width: "100%", maxWidth: "260px" }}
                              />
                            ) : student.email ? (
                              <span style={{ color: "var(--primary)", fontWeight: 500, fontSize: "0.88rem" }}>
                                {student.email}
                              </span>
                            ) : (
                              <span style={{ color: "#f59e0b", background: "#fef3c7", padding: "2px 8px", borderRadius: "4px", fontSize: "0.78rem", fontWeight: 600 }}>
                                Missing
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right" }}>
                            {editingStudentId === student.id ? (
                              <div style={{ display: "inline-flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  onClick={() => handleSaveInline(student.rollNumber)}
                                  disabled={isSavingInline}
                                  className="btn btn-primary"
                                  style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingStudentId(null)}
                                  className="btn btn-outline"
                                  style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStudentId(student.id);
                                  setEditingEmailValue(student.email || "");
                                }}
                                className="icon-btn"
                                title="Edit Email"
                                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--primary)", padding: 4 }}
                              >
                                <Edit2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
