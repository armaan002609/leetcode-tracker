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
  Clock,
  Filter,
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
    lockedCount: 0,
    unlockedCount: 0,
    loggedInCount: 0,
    neverLoggedInCount: 0,
    totalStudents: 0,
  });
  const [credentials, setCredentials] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "logged_in" | "never_logged_in" | "unlocked" | "locked" | "linked" | "unlinked">("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterSemester, setFilterSemester] = useState("all");
  const [filterSection, setFilterSection] = useState("all");
  const [availableStreams, setAvailableStreams] = useState<string[]>([]);
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [availableSections, setAvailableSections] = useState<string[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [isBulkTogglingLock, setIsBulkTogglingLock] = useState(false);
  const [lockActionMessage, setLockActionMessage] = useState("");

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

  const userRole = (session?.user as any)?.role as string | undefined;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && userRole !== "admin") {
      router.push(userRole === "student" ? "/student" : "/");
    } else if (status === "authenticated") {
      checkLockStatus();
    }
  }, [status, userRole, router]);

  useEffect(() => {
    if (unlocked) {
      fetchCredentials();
    }
  }, [unlocked, filterType, filterBranch, filterSemester, filterSection]);

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
      const params = new URLSearchParams({
        filter: filterType,
        search: q,
        branch: filterBranch,
        semester: filterSemester,
        section: filterSection,
      });
      const res = await fetch(
        `/api/admin/student-credentials?${params.toString()}`
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
          lockedCount: data.lockedCount ?? 0,
          unlockedCount: data.unlockedCount ?? data.totalCredentials,
          loggedInCount: data.loggedInCount ?? 0,
          neverLoggedInCount: data.neverLoggedInCount ?? 0,
          totalStudents: data.totalStudents,
        });
        setCredentials(data.credentials || []);
        if (data.uniqueStreams && data.uniqueStreams.length > 0) {
          setAvailableStreams(data.uniqueStreams);
        }
        if (data.uniqueSemesters && data.uniqueSemesters.length > 0) {
          setAvailableSemesters(data.uniqueSemesters);
        }
        if (data.uniqueSections && data.uniqueSections.length > 0) {
          setAvailableSections(data.uniqueSections);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  };

  const handleToggleIndividualLock = async (cred: any) => {
    const nextLocked = !cred.isLocked;
    setTogglingId(cred.id);
    setLockActionMessage("");
    try {
      const res = await fetch("/api/admin/student-credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cred.id, isLocked: nextLocked }),
      });
      if (res.status === 403) {
        setUnlocked(false);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setCredentials((prev) => {
          const updated = prev.map((item) =>
            item.id === cred.id ? { ...item, isLocked: nextLocked } : item
          );
          if (filterType === "locked" && !nextLocked) {
            return updated.filter((item) => item.id !== cred.id);
          }
          if (filterType === "unlocked" && nextLocked) {
            return updated.filter((item) => item.id !== cred.id);
          }
          return updated;
        });
        setStats((prev) => ({
          ...prev,
          lockedCount: Math.max(0, prev.lockedCount + (nextLocked ? 1 : -1)),
          unlockedCount: Math.max(0, prev.unlockedCount + (nextLocked ? -1 : 1)),
        }));
        setLockActionMessage(
          data.message || `${nextLocked ? "Locked" : "Unlocked"} ${cred.portalUsername}.`
        );
      } else {
        alert(data.error || "Failed to update lock status.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTogglingId(null);
    }
  };

  const handleBulkLockToggle = async (lockAll: boolean) => {
    const confirmText = lockAll
      ? `Lock all ${stats.totalCredentials} student IDs? Students will NOT be able to log in until unlocked.`
      : `Unlock all ${stats.totalCredentials} student IDs so students can log in?`;
    if (!window.confirm(confirmText)) return;

    setIsBulkTogglingLock(true);
    setLockActionMessage("");
    try {
      const res = await fetch("/api/admin/student-credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all", isLocked: lockAll }),
      });
      if (res.status === 403) {
        setUnlocked(false);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setLockActionMessage(data.message || (lockAll ? "All student IDs locked." : "All student IDs unlocked."));
        await fetchCredentials();
      } else {
        alert(data.error || "Failed to update lock status.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsBulkTogglingLock(false);
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
              <div className="dashboard-card" style={{ margin: 0, padding: "20px", borderLeft: "4px solid #dc2626" }}>
                <div style={{ fontSize: "0.78rem", color: "#dc2626", textTransform: "uppercase", fontWeight: 700 }}>
                  Locked Student IDs
                </div>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, marginTop: "6px", color: "#dc2626" }}>
                  {stats.lockedCount}
                  <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--muted)", marginLeft: "8px" }}>
                    ({stats.unlockedCount} active)
                  </span>
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
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => setFilterType("all")}
                      style={{
                        padding: "5px 10px", borderRadius: "6px", fontSize: "0.78rem", border: "none", cursor: "pointer", fontWeight: 600,
                        background: filterType === "all" ? "var(--primary)" : "#f1f5f9",
                        color: filterType === "all" ? "white" : "var(--muted)",
                      }}
                    >
                      All ({stats.totalCredentials})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("logged_in")}
                      style={{
                        padding: "5px 10px", borderRadius: "6px", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600,
                        background: filterType === "logged_in" ? "#047857" : "#ecfdf5",
                        color: filterType === "logged_in" ? "white" : "#065f46",
                        border: filterType === "logged_in" ? "none" : "1px solid #a7f3d0",
                      }}
                      title="Show students who have logged into their Student Portal"
                    >
                      ✓ Logged In ({stats.loggedInCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("never_logged_in")}
                      style={{
                        padding: "5px 10px", borderRadius: "6px", fontSize: "0.78rem", cursor: "pointer", fontWeight: 600,
                        background: filterType === "never_logged_in" ? "#b45309" : "#fffbeb",
                        color: filterType === "never_logged_in" ? "white" : "#92400e",
                        border: filterType === "never_logged_in" ? "none" : "1px solid #fde68a",
                      }}
                      title="Show students who have NEVER logged in yet"
                    >
                      ⏳ Never Logged In ({stats.neverLoggedInCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("unlocked")}
                      style={{
                        padding: "5px 10px", borderRadius: "6px", fontSize: "0.78rem", border: "none", cursor: "pointer", fontWeight: 600,
                        background: filterType === "unlocked" ? "#059669" : "#f1f5f9",
                        color: filterType === "unlocked" ? "white" : "var(--muted)",
                      }}
                    >
                      Unlocked ({stats.unlockedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("locked")}
                      style={{
                        padding: "5px 10px", borderRadius: "6px", fontSize: "0.78rem", border: "none", cursor: "pointer", fontWeight: 600,
                        background: filterType === "locked" ? "#dc2626" : "#f1f5f9",
                        color: filterType === "locked" ? "white" : "var(--muted)",
                      }}
                    >
                      Locked ({stats.lockedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("linked")}
                      style={{
                        padding: "5px 10px", borderRadius: "6px", fontSize: "0.78rem", border: "none", cursor: "pointer", fontWeight: 600,
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
                        padding: "5px 10px", borderRadius: "6px", fontSize: "0.78rem", border: "none", cursor: "pointer", fontWeight: 600,
                        background: filterType === "unlinked" ? "#f59e0b" : "#f1f5f9",
                        color: filterType === "unlinked" ? "white" : "var(--muted)",
                      }}
                    >
                      Unlinked ({stats.unlinkedCount})
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  {stats.totalCredentials > 0 && (
                    <>
                      <button
                        type="button"
                        disabled={isBulkTogglingLock || stats.unlockedCount === 0}
                        onClick={() => handleBulkLockToggle(true)}
                        className="btn btn-outline"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 11px",
                          fontSize: "0.78rem",
                          color: "#dc2626",
                          borderColor: "#fecaca",
                          background: "#fef2f2",
                          opacity: isBulkTogglingLock || stats.unlockedCount === 0 ? 0.5 : 1,
                          cursor: isBulkTogglingLock || stats.unlockedCount === 0 ? "not-allowed" : "pointer",
                        }}
                        title="Lock all student IDs so no student can log in"
                      >
                        <Lock size={13} /> Lock All IDs
                      </button>
                      <button
                        type="button"
                        disabled={isBulkTogglingLock || stats.lockedCount === 0}
                        onClick={() => handleBulkLockToggle(false)}
                        className="btn btn-outline"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "6px 11px",
                          fontSize: "0.78rem",
                          color: "#059669",
                          borderColor: "#a7f3d0",
                          background: "#ecfdf5",
                          opacity: isBulkTogglingLock || stats.lockedCount === 0 ? 0.5 : 1,
                          cursor: isBulkTogglingLock || stats.lockedCount === 0 ? "not-allowed" : "pointer",
                        }}
                        title="Unlock all student IDs so students can log in"
                      >
                        <Unlock size={13} /> Unlock All IDs
                      </button>
                    </>
                  )}
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
                      style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--surface-border)", fontSize: "0.84rem", width: "200px" }}
                    />
                    <button type="submit" className="btn btn-outline" style={{ padding: "6px 10px" }}>
                      <Search size={14} />
                    </button>
                  </form>
                </div>
              </div>

              {/* Branch / Stream, Semester, and Section Dropdowns Filter Bar */}
              <div style={{
                padding: "10px 16px",
                background: "#f8fafc",
                borderBottom: "1px solid var(--surface-border)",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "12px",
                justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)" }}>Branch / Stream:</label>
                    <select
                      value={filterBranch}
                      onChange={(e) => setFilterBranch(e.target.value)}
                      style={{ padding: "5px 9px", borderRadius: "6px", border: "1px solid var(--surface-border)", fontSize: "0.82rem", background: "var(--surface)" }}
                    >
                      <option value="all">All Branches</option>
                      {availableStreams.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)" }}>Semester:</label>
                    <select
                      value={filterSemester}
                      onChange={(e) => setFilterSemester(e.target.value)}
                      style={{ padding: "5px 9px", borderRadius: "6px", border: "1px solid var(--surface-border)", fontSize: "0.82rem", background: "var(--surface)" }}
                    >
                      <option value="all">All Semesters</option>
                      {["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"].map((s) => (
                        <option key={s} value={s}>{s} Sem</option>
                      ))}
                      {availableSemesters.filter(s => !["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"].includes(s)).map((s) => (
                        <option key={s} value={s}>Sem {s}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--muted)" }}>Section:</label>
                    <select
                      value={filterSection}
                      onChange={(e) => setFilterSection(e.target.value)}
                      style={{ padding: "5px 9px", borderRadius: "6px", border: "1px solid var(--surface-border)", fontSize: "0.82rem", background: "var(--surface)" }}
                    >
                      <option value="all">All Sections</option>
                      {availableSections.length > 0 ? (
                        availableSections.map((sec) => (
                          <option key={sec} value={sec}>Sec {sec}</option>
                        ))
                      ) : (
                        Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map((sec) => (
                          <option key={sec} value={sec}>Sec {sec}</option>
                        ))
                      )}
                    </select>
                  </div>

                  {(filterBranch !== "all" || filterSemester !== "all" || filterSection !== "all" || searchTerm || filterType !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterBranch("all");
                        setFilterSemester("all");
                        setFilterSection("all");
                        setSearchTerm("");
                        setFilterType("all");
                      }}
                      className="btn btn-outline"
                      style={{ padding: "4px 8px", fontSize: "0.75rem", color: "var(--muted)", height: "fit-content" }}
                    >
                      Reset All Filters
                    </button>
                  )}
                </div>

                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  Showing <strong style={{ color: "var(--foreground)" }}>{credentials.length}</strong> records (Total matched: {stats.totalCredentials})
                </div>
              </div>

              {lockActionMessage && (
                <div style={{
                  padding: "10px 16px",
                  background: "#f8fafc",
                  borderBottom: "1px solid var(--surface-border)",
                  fontSize: "0.84rem",
                  color: "#0f172a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={15} color="#059669" />
                    {lockActionMessage}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLockActionMessage("")}
                    style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "0.78rem" }}
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div className="card-body" style={{ padding: 0 }}>
                {loadingList ? (
                  <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
                    <RefreshCw size={20} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                    <div>Loading student logins...</div>
                  </div>
                ) : credentials.length === 0 ? (
                  <div style={{ padding: "32px", textAlign: "center", color: "var(--muted)" }}>
                    No student portal logins found for this filter.
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
                          <th style={{ padding: "10px 14px" }}>Portal Login Status</th>
                          <th style={{ padding: "10px 14px" }}>Roster Link</th>
                          <th style={{ padding: "10px 14px" }}>Login Access</th>
                          <th style={{ padding: "10px 14px", textAlign: "right" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {credentials.map((c) => {
                          const isLocked = Boolean(c.isLocked);
                          const isTogglingThis = togglingId === c.id;
                          return (
                            <tr key={c.id} style={{ background: isLocked ? "#fff5f5" : undefined }}>
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
                                {c.lastLoginAt ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                    <span className="status-badge success" style={{ display: "inline-flex", alignItems: "center", gap: "4px", width: "fit-content", fontSize: "0.76rem" }}>
                                      <CheckCircle2 size={12} /> Logged In {c.loginCount > 1 ? `(${c.loginCount}x)` : ''}
                                    </span>
                                    <span style={{ fontSize: "0.71rem", color: "var(--muted)", whiteSpace: "nowrap" }}>
                                      {new Intl.DateTimeFormat('en-IN', {
                                        timeZone: 'Asia/Kolkata',
                                        day: '2-digit', month: 'short', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit', hour12: true
                                      }).format(new Date(c.lastLoginAt))}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="status-badge pending" style={{ background: "#f8fafc", color: "#64748b", borderColor: "#e2e8f0", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.76rem" }}>
                                    <Clock size={12} /> Never Logged In
                                  </span>
                                )}
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
                              <td style={{ padding: "10px 14px" }}>
                                {isLocked ? (
                                  <span className="status-badge danger" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                    <Lock size={12} /> Locked
                                  </span>
                                ) : (
                                  <span className="status-badge success" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                    <Unlock size={12} /> Unlocked
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                  <button
                                    type="button"
                                    disabled={isTogglingThis || isBulkTogglingLock}
                                    onClick={() => handleToggleIndividualLock(c)}
                                    className="btn btn-outline"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                      padding: "4px 10px",
                                      fontSize: "0.76rem",
                                      fontWeight: 600,
                                      color: isLocked ? "#059669" : "#dc2626",
                                      borderColor: isLocked ? "#a7f3d0" : "#fecaca",
                                      background: isLocked ? "#ecfdf5" : "#fef2f2",
                                      cursor: isTogglingThis ? "not-allowed" : "pointer",
                                      opacity: isTogglingThis ? 0.6 : 1,
                                    }}
                                    title={isLocked ? `Unlock ${c.portalUsername} so student can log in` : `Lock ${c.portalUsername} so student cannot log in`}
                                  >
                                    {isLocked ? (
                                      <>
                                        <Unlock size={12} />
                                        <span>{isTogglingThis ? "Unlocking..." : "Unlock"}</span>
                                      </>
                                    ) : (
                                      <>
                                        <Lock size={12} />
                                        <span>{isTogglingThis ? "Locking..." : "Lock"}</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCredential(c.id, c.portalUsername)}
                                    className="icon-btn"
                                    title="Delete Login"
                                    style={{ background: "transparent", border: "none", color: "var(--danger)", cursor: "pointer", padding: 4 }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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
