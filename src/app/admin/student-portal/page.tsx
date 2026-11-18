"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Lock,
  Unlock,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Download,
  Search,
  Save,
  Trash2,
  RefreshCw,
  KeyRound,
  Link2,
  FileSpreadsheet,
  ClipboardPaste,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface ParsedCredentialRow {
  rollNo: string;
  enrollmentNo: string;
  studentName?: string;
  stream?: string;
  semester?: string;
  section?: string;
  labBatch?: string;
}

export default function StudentPortalAccessAdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Password Lock Gate states
  const [checkingLock, setCheckingLock] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [usingDedicatedPassword, setUsingDedicatedPassword] = useState(false);
  const [lockPasswordInput, setLockPasswordInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Credentials Management states
  const [activeTab, setActiveTab] = useState<"upload" | "paste" | "manual">("upload");
  const [stats, setStats] = useState({
    totalCredentials: 0,
    linkedCount: 0,
    unlinkedCount: 0,
    totalStudents: 0,
  });
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "linked" | "unlinked">("all");

  // Upload / Paste states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCredentialRow[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [isRelinking, setIsRelinking] = useState(false);

  // Manual form states
  const [manualRollNo, setManualRollNo] = useState("");
  const [manualEnrollmentNo, setManualEnrollmentNo] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualStream, setManualStream] = useState("");
  const [manualSemester, setManualSemester] = useState("");
  const [manualSection, setManualSection] = useState("");
  const [manualLabBatch, setManualLabBatch] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSuccess, setManualSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && (session?.user as any)?.role !== "admin") {
      router.push("/");
    } else if (status === "authenticated") {
      checkLockStatus();
    }
  }, [status, session, router]);

  useEffect(() => {
    if (unlocked) {
      fetchCredentials();
    }
  }, [unlocked, filterType]);

  const checkLockStatus = async () => {
    setCheckingLock(true);
    try {
      const res = await fetch("/api/admin/student-credentials/unlock");
      if (res.ok) {
        const data = await res.json();
        setUnlocked(Boolean(data.unlocked));
        setUsingDedicatedPassword(Boolean(data.usingDedicatedPassword));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckingLock(false);
    }
  };

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockPasswordInput) return;
    setIsUnlocking(true);
    setUnlockError("");

    try {
      const res = await fetch("/api/admin/student-credentials/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: lockPasswordInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUnlockError(data.error || "Incorrect lock password.");
      } else {
        setLockPasswordInput("");
        setUnlocked(true);
      }
    } catch (e: any) {
      setUnlockError(e.message || "Network error verifying password.");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleLockNow = async () => {
    try {
      await fetch("/api/admin/student-credentials/unlock", { method: "DELETE" });
    } finally {
      setUnlocked(false);
      setCredentials([]);
      setParsedRows([]);
    }
  };

  const fetchCredentials = async (searchOverride?: string) => {
    setLoadingList(true);
    try {
      const q = searchOverride !== undefined ? searchOverride : searchTerm;
      const res = await fetch(
        `/api/admin/student-credentials?filter=${filterType}&search=${encodeURIComponent(q)}`
      );
      if (res.status === 403) {
        setUnlocked(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalCredentials: data.totalCredentials,
          linkedCount: data.linkedCount,
          unlinkedCount: data.unlinkedCount,
          totalStudents: data.totalStudents,
        });
        setCredentials(data.credentials || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  };

  /**
   * Smart 2D-array parser that accurately handles:
   * - Blank separator columns (e.g. "Sr,Roll No,,,,Enrollment No,Stream,Semester ,Class,Lab Batch,Student Name")
   * - Trailing whitespace in headers and values
   * - Both CSV and Excel spreadsheets
   */
  const parseMatrixRows = (matrix: any[][]): ParsedCredentialRow[] => {
    if (!Array.isArray(matrix) || matrix.length === 0) return [];

    let headerIdx = -1;
    let rollCol = -1;
    let enrollCol = -1;
    let nameCol = -1;
    let streamCol = -1;
    let semCol = -1;
    let secCol = -1;
    let batchCol = -1;

    const cleanHeader = (val: any) =>
      String(val ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");

    const maxScanRows = Math.min(matrix.length, 10);
    for (let r = 0; r < maxScanRows; r++) {
      const row = matrix[r];
      if (!Array.isArray(row)) continue;

      let rCol = -1;
      let eCol = -1;
      let nCol = -1;
      let stCol = -1;
      let smCol = -1;
      let scCol = -1;
      let bCol = -1;

      row.forEach((cell, idx) => {
        const h = cleanHeader(cell);
        if (!h) return;

        if (rCol === -1 && (h === "rollno" || h === "rollnumber" || h === "roll" || h === "univrollno" || h === "universityrollno" || h === "username")) {
          rCol = idx;
        } else if (
          eCol === -1 &&
          (h === "enrollmentno" ||
            h === "enrollmentnumber" ||
            h === "enrollment" ||
            h === "enrolmentno" ||
            h === "enrolment" ||
            h === "enrollno" ||
            h === "enroll" ||
            h === "password")
        ) {
          eCol = idx;
        } else if (nCol === -1 && (h === "studentname" || h === "name" || h === "fullname")) {
          nCol = idx;
        } else if (stCol === -1 && (h === "stream" || h === "branch" || h === "course" || h === "department" || h === "dept")) {
          stCol = idx;
        } else if (smCol === -1 && (h === "semester" || h === "sem")) {
          smCol = idx;
        } else if (scCol === -1 && (h === "class" || h === "section" || h === "sec")) {
          scCol = idx;
        } else if (bCol === -1 && (h === "labbatch" || h === "batch" || h === "lab")) {
          bCol = idx;
        }
      });

      if (rCol !== -1 && eCol !== -1) {
        headerIdx = r;
        rollCol = rCol;
        enrollCol = eCol;
        nameCol = nCol;
        streamCol = stCol;
        semCol = smCol;
        secCol = scCol;
        batchCol = bCol;
        break;
      }
    }

    if (headerIdx === -1 || rollCol === -1 || enrollCol === -1) {
      return [];
    }

    const extracted: ParsedCredentialRow[] = [];
    for (let r = headerIdx + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!Array.isArray(row)) continue;

      const rollNo = String(row[rollCol] ?? "").trim();
      const enrollmentNo = String(row[enrollCol] ?? "").trim();

      if (!rollNo || !enrollmentNo) continue;

      extracted.push({
        rollNo,
        enrollmentNo,
        studentName: nameCol !== -1 ? String(row[nameCol] ?? "").trim() || undefined : undefined,
        stream: streamCol !== -1 ? String(row[streamCol] ?? "").trim() || undefined : undefined,
        semester: semCol !== -1 ? String(row[semCol] ?? "").trim() || undefined : undefined,
        section: secCol !== -1 ? String(row[secCol] ?? "").trim() || undefined : undefined,
        labBatch: batchCol !== -1 ? String(row[batchCol] ?? "").trim() || undefined : undefined,
      });
    }

    return extracted;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setUploadError("");
    setUploadSuccess("");
    setParsedRows([]);

    try {
      if (file.name.toLowerCase().endsWith(".csv")) {
        Papa.parse(file, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            const rows = parseMatrixRows(results.data as any[][]);
            if (rows.length === 0) {
              setUploadError(
                'No valid rows found. Make sure your file has "Roll No" and "Enrollment No" columns.'
              );
            } else {
              setParsedRows(rows);
            }
            setIsProcessingFile(false);
          },
          error: (err) => {
            setUploadError(err.message || "Failed to parse CSV file.");
            setIsProcessingFile(false);
          },
        });
      } else if (
        file.name.toLowerCase().endsWith(".xlsx") ||
        file.name.toLowerCase().endsWith(".xls")
      ) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const workbook = XLSX.read(evt.target?.result, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
            const rows = parseMatrixRows(matrix);
            if (rows.length === 0) {
              setUploadError(
                'No valid rows found. Make sure your Excel sheet has "Roll No" and "Enrollment No" columns.'
              );
            } else {
              setParsedRows(rows);
            }
          } catch (err: any) {
            setUploadError(err.message || "Failed to read Excel file.");
          } finally {
            setIsProcessingFile(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        setUploadError("Please upload a .csv, .xlsx, or .xls file.");
        setIsProcessingFile(false);
      }
    } catch (err: any) {
      setUploadError(err.message || "Error reading file.");
      setIsProcessingFile(false);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleParsePastedCsv = () => {
    setUploadError("");
    setUploadSuccess("");
    if (!pasteText.trim()) {
      setUploadError("Please paste CSV data first.");
      return;
    }

    const results = Papa.parse(pasteText.trim(), {
      header: false,
      skipEmptyLines: true,
    });

    const rows = parseMatrixRows(results.data as any[][]);
    if (rows.length === 0) {
      setUploadError(
        'Could not find "Roll No" and "Enrollment No" columns in the pasted text. Make sure you included the header row.'
      );
    } else {
      setParsedRows(rows);
    }
  };

  const handleImportParsedRows = async () => {
    if (parsedRows.length === 0) return;

    setIsUploading(true);
    setUploadError("");
    setUploadSuccess("");

    const CHUNK_SIZE = 100;
    let totalSaved = 0;
    let totalLinked = 0;
    let totalUnlinked = 0;

    try {
      for (let i = 0; i < parsedRows.length; i += CHUNK_SIZE) {
        const chunk = parsedRows.slice(i, i + CHUNK_SIZE);
        setUploadProgress(
          `Uploading ${Math.min(i + chunk.length, parsedRows.length)} / ${parsedRows.length} students...`
        );

        const res = await fetch("/api/admin/student-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: chunk }),
        });

        const data = await res.json();
        if (res.status === 403) {
          setUnlocked(false);
          return;
        }
        if (!res.ok) {
          throw new Error(data.error || "Failed to save student credentials.");
        }

        totalSaved += data.savedCount || 0;
        totalLinked += data.linkedCount || 0;
        totalUnlinked += data.unlinkedCount || 0;
      }

      setUploadSuccess(
        `Successfully imported ${totalSaved} student logins (${totalLinked} linked to LeetCode roster, ${totalUnlinked} awaiting roster match).`
      );
      setParsedRows([]);
      setPasteText("");
      await fetchCredentials();
    } catch (err: any) {
      setUploadError(err.message || "Error uploading credentials.");
    } finally {
      setIsUploading(false);
      setUploadProgress("");
    }
  };

  const handleRelinkStudents = async () => {
    setIsRelinking(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      const res = await fetch("/api/admin/student-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "relink" }),
      });
      const data = await res.json();
      if (res.status === 403) {
        setUnlocked(false);
        return;
      }
      if (!res.ok) {
        setUploadError(data.error || "Failed to re-link students.");
      } else {
        setUploadSuccess(data.message || "Re-link completed.");
        await fetchCredentials();
      }
    } catch (e: any) {
      setUploadError(e.message || "Network error.");
    } finally {
      setIsRelinking(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRollNo.trim() || !manualEnrollmentNo.trim()) return;

    setIsSubmittingManual(true);
    setManualError("");
    setManualSuccess("");

    try {
      const res = await fetch("/api/admin/student-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rollNo: manualRollNo.trim(),
          enrollmentNo: manualEnrollmentNo.trim(),
          studentName: manualName.trim() || undefined,
          stream: manualStream.trim() || undefined,
          semester: manualSemester.trim() || undefined,
          section: manualSection.trim() || undefined,
          labBatch: manualLabBatch.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 403) {
        setUnlocked(false);
        return;
      }
      if (!res.ok) {
        setManualError(data.error || "Failed to save credential.");
      } else {
        setManualSuccess(data.message || "Saved student portal login.");
        setManualRollNo("");
        setManualEnrollmentNo("");
        setManualName("");
        setManualStream("");
        setManualSemester("");
        setManualSection("");
        setManualLabBatch("");
        await fetchCredentials();
      }
    } catch (err: any) {
      setManualError(err.message || "Network error saving credential.");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleDeleteCredential = async (id: string, username: string) => {
    if (!window.confirm(`Remove portal login for ${username}?`)) return;
    try {
      const res = await fetch(`/api/admin/student-credentials?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.status === 403) {
        setUnlocked(false);
        return;
      }
      if (res.ok) {
        await fetchCredentials();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (status === "loading" || checkingLock) {
    return (
      <div className="enterprise-loader-wrapper">
        <div className="pulse-logo">L</div>
        <div className="loader-text">Checking Access...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <nav className="topnav">
        <div className="topnav-brand">
          <Link
            href="/"
            className="icon-btn"
            style={{ background: "transparent", textDecoration: "none", color: "inherit" }}
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="topnav-brand-icon">L</div>
          <span>Student Portal Access</span>
        </div>
        <div className="topnav-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {unlocked && (
            <button
              type="button"
              onClick={handleLockNow}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "6px",
                fontSize: "0.82rem",
                fontWeight: 600,
                background: "white",
                color: "var(--primary)",
                border: "none",
                cursor: "pointer",
              }}
            >
              <Lock size={14} /> Lock Now
            </button>
          )}
        </div>
      </nav>

      <main className="main-content">
        {!unlocked ? (
          /* Password Lock Screen */
          <div style={{ minHeight: "65vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div className="dashboard-card" style={{ maxWidth: "430px", width: "100%", padding: "32px" }}>
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "14px",
                    background: "rgba(164, 14, 25, 0.1)",
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 14px",
                  }}
                >
                  <Lock size={28} />
                </div>
                <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 700 }}>
                  Password Protected
                </h2>
                <p style={{ margin: "8px 0 0", fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.5 }}>
                  Enter the lock password to upload and manage student login credentials (Roll No &amp; Enrollment No).
                </p>
              </div>

              <form onSubmit={handleUnlockSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "0.84rem", fontWeight: 600 }}>
                    Lock Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <KeyRound
                      size={16}
                      style={{
                        position: "absolute",
                        left: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--muted)",
                      }}
                    />
                    <input
                      type="password"
                      value={lockPasswordInput}
                      onChange={(e) => setLockPasswordInput(e.target.value)}
                      placeholder="Enter lock password"
                      autoFocus
                      required
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 38px",
                        borderRadius: "8px",
                        border: "1px solid var(--surface-border)",
                        background: "var(--background)",
                      }}
                    />
                  </div>
                </div>

                {unlockError && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#dc2626",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      fontSize: "0.84rem",
                    }}
                  >
                    <ShieldAlert size={16} />
                    <span>{unlockError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="btn btn-primary"
                  style={{ width: "100%", padding: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                >
                  <Unlock size={16} />
                  <span>{isUnlocking ? "Verifying..." : "Unlock Student Portal Upload"}</span>
                </button>
              </form>

              <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--surface-border)", fontSize: "0.78rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
                {usingDedicatedPassword ? (
                  <span>Protected by <code>STUDENT_PORTAL_PASSWORD</code> environment variable.</span>
                ) : (
                  <span>
                    Uses <code>STUDENT_PORTAL_PASSWORD</code> (currently falling back to <code>ADMIN_PASSWORD</code>).
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Unlocked Management View */
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div className="dashboard-hero" style={{ marginBottom: "24px", flexWrap: "wrap" }}>
              <div className="hero-left">
                <div className="hero-pill-badge">
                  <Unlock size={13} />
                  <span>Unlocked &bull; Protected Upload</span>
                </div>
                <h1 className="hero-heading">Student Portal Login Credentials</h1>
                <p className="hero-subheading">
                  Upload Roll No (Username) and Enrollment No (Password) sheets so students can log in at <code>/login</code> and view their own LeetCode question progress.
                </p>
              </div>
              <div className="hero-right-actions">
                <button
                  type="button"
                  onClick={handleRelinkStudents}
                  disabled={isRelinking}
                  className="btn btn-outline hero-action-btn"
                  title="Match unlinked student logins to students in the LeetCode roster"
                >
                  <Link2 size={15} />
                  <span>{isRelinking ? "Linking..." : "Re-link Roster"}</span>
                </button>
              </div>
            </div>

            {/* Metrics Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              <div className="dashboard-card" style={{ margin: 0, padding: "20px" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                  Portal Logins Uploaded
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "6px" }}>
                  {stats.totalCredentials}
                </div>
              </div>
              <div className="dashboard-card" style={{ margin: 0, padding: "20px", borderLeft: "4px solid #10b981" }}>
                <div style={{ fontSize: "0.78rem", color: "#059669", textTransform: "uppercase", fontWeight: 700 }}>
                  Linked to LeetCode Roster
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "6px", color: "#059669" }}>
                  {stats.linkedCount}
                </div>
              </div>
              <div className="dashboard-card" style={{ margin: 0, padding: "20px", borderLeft: "4px solid #f59e0b" }}>
                <div style={{ fontSize: "0.78rem", color: "#d97706", textTransform: "uppercase", fontWeight: 700 }}>
                  Awaiting Roster Match
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "6px", color: "#d97706" }}>
                  {stats.unlinkedCount}
                </div>
              </div>
            </div>

            {/* Upload / Paste / Manual Card */}
            <div className="dashboard-card" style={{ marginBottom: "24px" }}>
              <div className="card-header" style={{ borderBottom: "none" }}>
                <div style={{ display: "flex", gap: "20px", borderBottom: "1px solid var(--surface-border)", width: "100%", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("upload"); setParsedRows([]); setUploadError(""); setUploadSuccess(""); }}
                    style={{
                      paddingBottom: 12,
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      color: activeTab === "upload" ? "var(--primary)" : "var(--muted)",
                      borderBottom: activeTab === "upload" ? "2px solid var(--primary)" : "none",
                    }}
                  >
                    <FileSpreadsheet size={16} /> Upload CSV / Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("paste"); setParsedRows([]); setUploadError(""); setUploadSuccess(""); }}
                    style={{
                      paddingBottom: 12,
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      color: activeTab === "paste" ? "var(--primary)" : "var(--muted)",
                      borderBottom: activeTab === "paste" ? "2px solid var(--primary)" : "none",
                    }}
                  >
                    <ClipboardPaste size={16} /> Paste CSV Data
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab("manual"); setManualError(""); setManualSuccess(""); }}
                    style={{
                      paddingBottom: 12,
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      color: activeTab === "manual" ? "var(--primary)" : "var(--muted)",
                      borderBottom: activeTab === "manual" ? "2px solid var(--primary)" : "none",
                    }}
                  >
                    <KeyRound size={16} /> Add Single Student
                  </button>
                </div>
              </div>

              <div className="card-body">
                {uploadError && activeTab !== "manual" && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.86rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertCircle size={17} />
                    <span>{uploadError}</span>
                  </div>
                )}

                {uploadSuccess && activeTab !== "manual" && (
                  <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#059669", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", fontSize: "0.86rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={17} />
                    <span>{uploadSuccess}</span>
                  </div>
                )}

                {activeTab === "upload" && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                      <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--muted)" }}>
                        Upload a CSV or Excel sheet with <strong>Roll No</strong> (username) and <strong>Enrollment No</strong> (password) columns. Empty columns and extra spaces are cleaned automatically.
                      </p>
                      <a
                        href="/api/admin/student-credentials/template"
                        download
                        className="btn btn-outline"
                        style={{ fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
                      >
                        <Download size={14} /> Sample CSV
                      </a>
                    </div>

                    {parsedRows.length === 0 ? (
                      <div style={{ border: "2px dashed var(--surface-border)", borderRadius: "8px", padding: "40px 24px", textAlign: "center" }}>
                        <UploadCloud size={38} style={{ color: "var(--muted)", margin: "0 auto 10px" }} />
                        <h4 style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: 600 }}>Upload Student Login Sheet</h4>
                        <p style={{ margin: "0 auto 18px", maxWidth: 480, fontSize: "0.84rem", color: "var(--muted)" }}>
                          Supports <code>.csv</code>, <code>.xlsx</code>, and <code>.xls</code>. Automatically matches each student to the LeetCode roster via Enrollment No or Roll No.
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
                        >
                          {isProcessingFile ? "Reading File..." : "Browse File"}
                        </button>
                      </div>
                    ) : (
                      <div style={{ background: "#f8fafc", border: "1px solid var(--surface-border)", padding: "16px", borderRadius: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
                          <div>
                            <strong style={{ fontSize: "1rem" }}>{parsedRows.length} student logins ready to import</strong>
                            <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "2px" }}>
                              Preview: {parsedRows.slice(0, 3).map(r => `${r.rollNo} / ${r.enrollmentNo}${r.studentName ? ` (${r.studentName})` : ""}`).join(", ")}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: "10px" }}>
                            <button type="button" onClick={() => setParsedRows([])} disabled={isUploading} className="btn btn-outline">
                              Cancel
                            </button>
                            <button type="button" onClick={handleImportParsedRows} disabled={isUploading} className="btn btn-primary">
                              {isUploading ? uploadProgress || "Importing..." : `Import ${parsedRows.length} Logins`}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "paste" && (
                  <div>
                    <p style={{ margin: "0 0 12px", fontSize: "0.88rem", color: "var(--muted)" }}>
                      Paste raw CSV text including the header row (e.g. <code>Sr,Roll No,,,,Enrollment No,Stream,Semester,Class,Lab Batch,Student Name</code>).
                    </p>
                    <textarea
                      rows={7}
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder="Sr,Roll No,,,,Enrollment No,Stream,Semester ,Class,Lab Batch,Student Name&#10;1,2401003013,,,,2420673,BTAIDS,5,A,A2,Armaan"
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "8px",
                        border: "1px solid var(--surface-border)",
                        fontFamily: "monospace",
                        fontSize: "0.8rem",
                        marginBottom: "12px",
                      }}
                    />
                    {parsedRows.length === 0 ? (
                      <button type="button" onClick={handleParsePastedCsv} className="btn btn-primary">
                        Preview Pasted Rows
                      </button>
                    ) : (
                      <div style={{ background: "#f8fafc", border: "1px solid var(--surface-border)", padding: "14px 16px", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                        <div>
                          <strong>{parsedRows.length} valid student rows detected</strong>
                          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                            Sample: {parsedRows.slice(0, 3).map(r => `${r.rollNo} → ${r.studentName || r.enrollmentNo}`).join(", ")}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button type="button" onClick={() => setParsedRows([])} disabled={isUploading} className="btn btn-outline">
                            Clear
                          </button>
                          <button type="button" onClick={handleImportParsedRows} disabled={isUploading} className="btn btn-primary">
                            {isUploading ? uploadProgress || "Importing..." : `Import ${parsedRows.length} Logins`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "manual" && (
                  <div>
                    {manualError && (
                      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "0.85rem" }}>
                        {manualError}
                      </div>
                    )}
                    {manualSuccess && (
                      <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#059669", padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "0.85rem" }}>
                        {manualSuccess}
                      </div>
                    )}
                    <form onSubmit={handleManualSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", alignItems: "end" }}>
                      <div>
                        <label style={{ display: "block", marginBottom: "6px", fontSize: "0.82rem", fontWeight: 600 }}>Roll No (Username) *</label>
                        <input
                          type="text"
                          required
                          value={manualRollNo}
                          onChange={(e) => setManualRollNo(e.target.value)}
                          placeholder="e.g. 2401003013"
                          style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--surface-border)" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "6px", fontSize: "0.82rem", fontWeight: 600 }}>Enrollment No (Password) *</label>
                        <input
                          type="text"
                          required
                          value={manualEnrollmentNo}
                          onChange={(e) => setManualEnrollmentNo(e.target.value)}
                          placeholder="e.g. 2420673"
                          style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--surface-border)" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "6px", fontSize: "0.82rem", fontWeight: 600 }}>Student Name</label>
                        <input
                          type="text"
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          placeholder="Optional"
                          style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--surface-border)" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "6px", fontSize: "0.82rem", fontWeight: 600 }}>Stream / Branch</label>
                        <input
                          type="text"
                          value={manualStream}
                          onChange={(e) => setManualStream(e.target.value)}
                          placeholder="e.g. BTAIDS"
                          style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--surface-border)" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "6px", fontSize: "0.82rem", fontWeight: 600 }}>Semester</label>
                        <input
                          type="text"
                          value={manualSemester}
                          onChange={(e) => setManualSemester(e.target.value)}
                          placeholder="e.g. 5"
                          style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--surface-border)" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "6px", fontSize: "0.82rem", fontWeight: 600 }}>Section / Class</label>
                        <input
                          type="text"
                          value={manualSection}
                          onChange={(e) => setManualSection(e.target.value)}
                          placeholder="e.g. A"
                          style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--surface-border)" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "6px", fontSize: "0.82rem", fontWeight: 600 }}>Lab Batch</label>
                        <input
                          type="text"
                          value={manualLabBatch}
                          onChange={(e) => setManualLabBatch(e.target.value)}
                          placeholder="e.g. A2"
                          style={{ width: "100%", padding: "9px 10px", borderRadius: "8px", border: "1px solid var(--surface-border)" }}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmittingManual}
                        className="btn btn-primary"
                        style={{ padding: "10px 16px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        <Save size={15} /> {isSubmittingManual ? "Saving..." : "Save Login"}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>

            {/* Credentials Table */}
            <div className="dashboard-card">
              <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <h3 className="card-title" style={{ margin: 0 }}>Uploaded Student Logins</h3>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setFilterType("all")}
                      style={{
                        padding: "4px 10px", borderRadius: "6px", fontSize: "0.78rem", border: "none", cursor: "pointer", fontWeight: 600,
                        background: filterType === "all" ? "var(--primary)" : "#f1f5f9",
                        color: filterType === "all" ? "white" : "var(--muted)",
                      }}
                    >
                      All ({stats.totalCredentials})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("linked")}
                      style={{
                        padding: "4px 10px", borderRadius: "6px", fontSize: "0.78rem", border: "none", cursor: "pointer", fontWeight: 600,
                        background: filterType === "linked" ? "#10b981" : "#f1f5f9",
                        color: filterType === "linked" ? "white" : "var(--muted)",
                      }}
                    >
                      Linked ({stats.linkedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("unlinked")}
                      style={{
                        padding: "4px 10px", borderRadius: "6px", fontSize: "0.78rem", border: "none", cursor: "pointer", fontWeight: 600,
                        background: filterType === "unlinked" ? "#f59e0b" : "#f1f5f9",
                        color: filterType === "unlinked" ? "white" : "var(--muted)",
                      }}
                    >
                      Unlinked ({stats.unlinkedCount})
                    </button>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    fetchCredentials(searchTerm);
                  }}
                  style={{ display: "flex", gap: "8px" }}
                >
                  <input
                    type="text"
                    placeholder="Search roll, enroll, name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--surface-border)", fontSize: "0.84rem", width: "210px" }}
                  />
                  <button type="submit" className="btn btn-outline" style={{ padding: "6px 10px" }}>
                    <Search size={14} />
                  </button>
                </form>
              </div>

              <div className="card-body" style={{ padding: 0 }}>
                {loadingList ? (
                  <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                    <div>Loading student logins...</div>
                  </div>
                ) : credentials.length === 0 ? (
                  <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
                    No student portal logins found yet. Upload a CSV/Excel file above to get started.
                  </div>
                ) : (
                  <div className="data-table-wrapper" style={{ maxHeight: "480px", overflowY: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ padding: "10px 14px" }}>Roll No (Username)</th>
                          <th style={{ padding: "10px 14px" }}>Enrollment No (Password)</th>
                          <th style={{ padding: "10px 14px" }}>Student Name</th>
                          <th style={{ padding: "10px 14px" }}>Stream / Sem / Sec</th>
                          <th style={{ padding: "10px 14px" }}>Roster Link</th>
                          <th style={{ padding: "10px 14px", textAlign: "right" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {credentials.map((c) => (
                          <tr key={c.id}>
                            <td style={{ padding: "10px 14px", fontWeight: 600 }}>{c.portalUsername}</td>
                            <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "var(--muted)" }}>
                              {c.enrollmentNo}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              {c.student?.name || c.studentName || "—"}
                            </td>
                            <td style={{ padding: "10px 14px", fontSize: "0.83rem", color: "var(--muted)" }}>
                              {[c.stream || c.student?.branch, c.semester ? `Sem ${c.semester}` : null, c.section ? `Sec ${c.section}` : null, c.labBatch]
                                .filter(Boolean)
                                .join(" • ") || "—"}
                            </td>
                            <td style={{ padding: "10px 14px" }}>
                              {c.studentId ? (
                                <span className="status-badge success">
                                  Linked ({c.student?.totalSolved ?? 0} solved)
                                </span>
                              ) : (
                                <span className="status-badge pending">Unlinked</span>
                              )}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right" }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteCredential(c.id, c.portalUsername)}
                                className="icon-btn"
                                title="Delete Login"
                                style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", padding: 4 }}
                              >
                                <Trash2 size={15} />
                              </button>
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
        )}
      </main>
    </div>
  );
}
