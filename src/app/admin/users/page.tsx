"use client";

import { useState, useEffect } from "react";
import { 
  User, Lock, Key, Trash2, Plus, ArrowLeft, Users, X, UserMinus, 
  UserPlus, Eye, EyeOff, Search, CheckCircle2, AlertCircle, RefreshCw, Database, Target, UploadCloud
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function UserManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // Manage Students Modal States
  const [selectedUserForStudents, setSelectedUserForStudents] = useState<any | null>(null);
  const [assignedStudents, setAssignedStudents] = useState<any[]>([]);
  const [unassignedStudents, setUnassignedStudents] = useState<any[]>([]);
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<"assigned" | "assign">("assigned");
  const [assignedSearchTerm, setAssignedSearchTerm] = useState("");
  const [unassignedSearchTerm, setUnassignedSearchTerm] = useState("");
  const [manualRollNumbers, setManualRollNumbers] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [selectedUnassignedRolls, setSelectedUnassignedRolls] = useState<string[]>([]);

  // Reset Password Modal States
  const [selectedUserForPasswordReset, setSelectedUserForPasswordReset] = useState<any | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated" && (session?.user as any)?.role !== 'admin') {
      router.push("/");
    } else if (status === "authenticated") {
      fetchUsers();
    }
  }, [status, router, session]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setCreateError("");
    setCreateSuccess("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword })
      });
      
      const data = await res.json();
      if (res.ok) {
        setNewUsername("");
        setNewPassword("");
        fetchUsers();
        setCreateSuccess("User created successfully!");
        setTimeout(() => setCreateSuccess(""), 4000);
      } else {
        setCreateError(data.error || "Failed to create user");
      }
    } catch (e: any) {
      setCreateError(e.message || "Failed to create user");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenResetPassword = (user: any) => {
    setSelectedUserForPasswordReset(user);
    setResetNewPassword("");
    setResetConfirmPassword("");
    setShowPassword(false);
    setResetPasswordError("");
    setResetPasswordSuccess("");
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordError("");
    setResetPasswordSuccess("");

    if (!resetNewPassword || resetNewPassword.length < 6) {
      setResetPasswordError("Password must be at least 6 characters.");
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setResetPasswordError("Passwords do not match.");
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserForPasswordReset.id, newPassword: resetNewPassword })
      });
      
      const data = await res.json();
      if (res.ok) {
        setResetPasswordSuccess("Password reset successfully!");
        setTimeout(() => {
          setSelectedUserForPasswordReset(null);
          setResetPasswordSuccess("");
        }, 1500);
      } else {
        setResetPasswordError(data.error || "Failed to reset password");
      }
    } catch (e: any) {
      setResetPasswordError(e.message || "Failed to update password");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This will not delete their assigned students, but will remove their access.")) return;

    try {
      const res = await fetch(`/api/users?id=${userId}`, { method: "DELETE" });
      if (res.ok) {
        fetchUsers();
      } else {
        alert("Failed to delete user");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenManageStudents = async (user: any) => {
    setSelectedUserForStudents(user);
    setActiveModalTab("assigned");
    setAssignedSearchTerm("");
    setUnassignedSearchTerm("");
    setManualRollNumbers("");
    setSelectedUnassignedRolls([]);
    setAssignMessage(null);
    setIsStudentsLoading(true);

    try {
      const [resAssigned, resUnassigned] = await Promise.all([
        fetch(`/api/users/students?userId=${user.id}`),
        fetch(`/api/users/students?userId=unassigned`)
      ]);

      if (resAssigned.ok) {
        setAssignedStudents(await resAssigned.json());
      }
      if (resUnassigned.ok) {
        setUnassignedStudents(await resUnassigned.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsStudentsLoading(false);
    }
  };

  const refreshStudentLists = async (userId: string) => {
    try {
      const [resAssigned, resUnassigned] = await Promise.all([
        fetch(`/api/users/students?userId=${userId}`),
        fetch(`/api/users/students?userId=unassigned`)
      ]);

      if (resAssigned.ok) setAssignedStudents(await resAssigned.json());
      if (resUnassigned.ok) setUnassignedStudents(await resUnassigned.json());
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveSingleStudent = async (rollNumber: string) => {
    try {
      const res = await fetch('/api/students/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumbers: [rollNumber], userId: "unassign" })
      });
      if (res.ok) {
        setAssignedStudents(prev => prev.filter(s => s.rollNumber !== rollNumber));
        if (selectedUserForStudents) {
          refreshStudentLists(selectedUserForStudents.id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveAssignedStudents = async (userId: string) => {
    if (!confirm("Are you sure you want to unassign all students from this user? The students will remain in the database but will be unassigned.")) return;

    try {
      const res = await fetch(`/api/users/unassign-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        refreshStudentLists(userId);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to unassign students");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignRollNumbers = async () => {
    if (!manualRollNumbers.trim() || !selectedUserForStudents) return;

    // Parse roll numbers from comma, space, newline or tab separation
    const rolls = manualRollNumbers
      .split(/[\s,]+/)
      .map(r => r.trim())
      .filter(Boolean);

    if (rolls.length === 0) return;

    setIsAssigning(true);
    setAssignMessage(null);

    try {
      const res = await fetch('/api/students/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumbers: rolls, userId: selectedUserForStudents.id })
      });

      if (res.ok) {
        setAssignMessage({ text: `Successfully assigned ${rolls.length} students to ${selectedUserForStudents.username}!`, type: "success" });
        setManualRollNumbers("");
        await refreshStudentLists(selectedUserForStudents.id);
      } else {
        const data = await res.json();
        setAssignMessage({ text: data.error || "Failed to assign students.", type: "error" });
      }
    } catch (e: any) {
      setAssignMessage({ text: e.message || "Failed to assign students.", type: "error" });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAssignSelectedUnassigned = async () => {
    if (selectedUnassignedRolls.length === 0 || !selectedUserForStudents) return;

    setIsAssigning(true);
    setAssignMessage(null);

    try {
      const res = await fetch('/api/students/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumbers: selectedUnassignedRolls, userId: selectedUserForStudents.id })
      });

      if (res.ok) {
        setAssignMessage({ text: `Assigned ${selectedUnassignedRolls.length} students to ${selectedUserForStudents.username}!`, type: "success" });
        setSelectedUnassignedRolls([]);
        await refreshStudentLists(selectedUserForStudents.id);
      } else {
        const data = await res.json();
        setAssignMessage({ text: data.error || "Failed to assign students.", type: "error" });
      }
    } catch (e: any) {
      setAssignMessage({ text: e.message || "Failed to assign students.", type: "error" });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAssignSingleStudent = async (rollNumber: string) => {
    if (!selectedUserForStudents) return;
    try {
      const res = await fetch('/api/students/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollNumbers: [rollNumber], userId: selectedUserForStudents.id })
      });
      if (res.ok) {
        refreshStudentLists(selectedUserForStudents.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filter lists for search inside modal
  const filteredAssigned = assignedStudents.filter(s => 
    s.rollNumber?.toLowerCase().includes(assignedSearchTerm.toLowerCase()) ||
    s.name?.toLowerCase().includes(assignedSearchTerm.toLowerCase())
  );

  const filteredUnassigned = unassignedStudents.filter(s => 
    s.rollNumber?.toLowerCase().includes(unassignedSearchTerm.toLowerCase()) ||
    s.name?.toLowerCase().includes(unassignedSearchTerm.toLowerCase()) ||
    s.branch?.toLowerCase().includes(unassignedSearchTerm.toLowerCase())
  );

  if (loading || status === "loading") {
    return (
      <div className="enterprise-loader-wrapper">
        <div className="pulse-logo">L</div>
        <div className="loader-text">Loading User Management...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <nav className="topnav">
        <div className="topnav-brand">
          <Link href="/" className="icon-btn" style={{ background: 'transparent', textDecoration: 'none', color: 'inherit' }} title="Back to Dashboard">
            <ArrowLeft size={20} />
          </Link>
          <div className="topnav-brand-icon">L</div>
          <span>User Management</span>
        </div>
        <div className="topnav-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/" className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 12px' }}>
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <Link href="/admin/assignments" className="btn btn-outline hide-on-mobile" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 12px' }}>
            <Target size={14} /> Assignments
          </Link>
          <Link href="/admin/data" className="btn btn-outline hide-on-mobile" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', padding: '6px 12px' }}>
            <Database size={14} /> Full Data
          </Link>
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
            <h2>User Management & Student Assignment</h2>
            <div style={{ opacity: 0.9, fontSize: '0.9rem', marginTop: 4 }}>
              Create sub-users (teachers/mentors), assign students, and reset their passwords
            </div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '24px' }}>
            
            {/* Create User Form */}
            <div className="dashboard-card" style={{ margin: 0, alignSelf: 'start' }}>
              <div className="card-header">
                <h3 className="card-title">Create New Sub-User</h3>
              </div>
              <form onSubmit={handleCreateUser} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {createError && (
                  <div style={{ color: '#ef4444', fontSize: '0.85rem', background: '#fef2f2', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} /> {createError}
                  </div>
                )}
                {createSuccess && (
                  <div style={{ color: '#10b981', fontSize: '0.85rem', background: '#ecfdf5', padding: '10px 12px', borderRadius: '6px', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} /> {createSuccess}
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Username</label>
                  <input 
                    type="text" 
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="e.g. teacher_vipin"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Initial Password</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    minLength={6}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                    required
                  />
                </div>
                <button type="submit" disabled={isCreating} className="btn btn-primary" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Plus size={16} /> {isCreating ? "Creating User..." : "Create Sub-User"}
                </button>
              </form>
            </div>

            {/* Users List */}
            <div className="dashboard-card" style={{ margin: 0 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title">All Sub-Users ({users.length})</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>Manage student assignments and reset passwords</span>
              </div>
              {users.length === 0 ? (
                <div className="p-8 text-center text-muted">No sub-users created yet. Create one on the left.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ padding: '12px 16px' }}>Username</th>
                        <th style={{ padding: '12px 16px' }}>Role</th>
                        <th style={{ padding: '12px 16px' }}>Assigned Students</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                {u.username.charAt(0).toUpperCase()}
                              </div>
                              {u.username}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, background: '#e2e8f0', color: '#475569', textTransform: 'capitalize' }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: 6, 
                              padding: '4px 10px', 
                              borderRadius: '20px', 
                              fontSize: '0.85rem', 
                              fontWeight: 600,
                              background: (u._count?.students || 0) > 0 ? '#e0f2fe' : '#f1f5f9',
                              color: (u._count?.students || 0) > 0 ? '#0369a1' : '#64748b'
                            }}>
                              <Users size={14} />
                              {u._count?.students || 0} students
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {/* Reset Password Button */}
                            <button 
                              onClick={() => handleOpenResetPassword(u)}
                              className="btn btn-outline"
                              style={{ padding: '6px 12px', fontSize: '0.8rem', marginRight: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              title="Reset Password for this user"
                            >
                              <Key size={14} style={{ color: 'var(--primary)' }} /> 
                              <span>Reset Password</span>
                            </button>

                            {/* Manage & Assign Students Button */}
                            <button 
                              onClick={() => handleOpenManageStudents(u)}
                              className="btn btn-primary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem', marginRight: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              title="Assign or unassign students for this user"
                            >
                              <UserPlus size={14} />
                              <span>Manage Students</span>
                            </button>

                            {/* Delete User Button */}
                            <button 
                              onClick={() => handleDeleteUser(u.id)}
                              className="btn btn-outline hover:bg-red-50"
                              style={{ padding: '6px 10px', fontSize: '0.8rem', color: '#ef4444', borderColor: '#fca5a5' }}
                              title="Delete User"
                            >
                              <Trash2 size={14} />
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
      </main>

      {/* Reset Password Modal */}
      {selectedUserForPasswordReset && (
        <div className="modal-overlay" onClick={() => setSelectedUserForPasswordReset(null)}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Key size={18} />
                </div>
                <div>
                  <h2 className="modal-title" style={{ fontSize: '1.15rem' }}>Reset User Password</h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 2 }}>
                    Set a new password for <strong style={{ color: 'var(--foreground)' }}>{selectedUserForPasswordReset.username}</strong>
                  </div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedUserForPasswordReset(null)}><X size={20} /></button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {resetPasswordError && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', background: '#fef2f2', padding: '10px 12px', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} /> {resetPasswordError}
                </div>
              )}
              {resetPasswordSuccess && (
                <div style={{ color: '#10b981', fontSize: '0.85rem', background: '#ecfdf5', padding: '10px 12px', borderRadius: '6px', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} /> {resetPasswordSuccess}
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    minLength={6}
                    style={{ width: '100%', padding: '10px 40px 10px 12px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none' }}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Confirm New Password</label>
                <input 
                  type={showPassword ? "text" : "password"}
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  minLength={6}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--surface-border)', outline: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ flex: 1 }} 
                  onClick={() => setSelectedUserForPasswordReset(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ flex: 1 }} 
                  disabled={isResettingPassword}
                >
                  {isResettingPassword ? "Saving..." : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage & Assign Students Modal */}
      {selectedUserForStudents && (
        <div className="modal-overlay" onClick={() => setSelectedUserForStudents(null)}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: 750, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '8px', background: 'var(--primary-subtle)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="modal-title">Student Assignments: {selectedUserForStudents.username}</h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 2 }}>
                    Currently assigned: <strong style={{ color: 'var(--foreground)' }}>{assignedStudents.length} students</strong>
                  </div>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedUserForStudents(null)}><X size={20} /></button>
            </div>

            {/* Modal Tabs: View Assigned vs Assign Students */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--surface-border)', background: 'var(--surface)' }}>
              <button
                type="button"
                onClick={() => { setActiveModalTab("assigned"); setAssignMessage(null); }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: activeModalTab === "assigned" ? 'white' : 'transparent',
                  border: 'none',
                  borderBottom: activeModalTab === "assigned" ? '2px solid var(--primary)' : '2px solid transparent',
                  fontWeight: activeModalTab === "assigned" ? 600 : 500,
                  color: activeModalTab === "assigned" ? 'var(--primary)' : 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Users size={16} /> Currently Assigned ({assignedStudents.length})
              </button>
              <button
                type="button"
                onClick={() => { setActiveModalTab("assign"); setAssignMessage(null); }}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: activeModalTab === "assign" ? 'white' : 'transparent',
                  border: 'none',
                  borderBottom: activeModalTab === "assign" ? '2px solid var(--primary)' : '2px solid transparent',
                  fontWeight: activeModalTab === "assign" ? 600 : 500,
                  color: activeModalTab === "assign" ? 'var(--primary)' : 'var(--muted)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <UserPlus size={16} /> Assign New Students
              </button>
            </div>

            {assignMessage && (
              <div style={{ 
                margin: '12px 24px 0', 
                padding: '10px 14px', 
                borderRadius: '6px', 
                fontSize: '0.85rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                background: assignMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
                color: assignMessage.type === 'success' ? '#10b981' : '#ef4444',
                border: `1px solid ${assignMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`
              }}>
                {assignMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {assignMessage.text}
              </div>
            )}

            {/* TAB 1: CURRENTLY ASSIGNED STUDENTS */}
            {activeModalTab === "assigned" && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                    <input 
                      type="text" 
                      placeholder="Search assigned roll / name..." 
                      value={assignedSearchTerm}
                      onChange={e => setAssignedSearchTerm(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: '6px', border: '1px solid var(--surface-border)', fontSize: '0.85rem' }}
                    />
                  </div>
                  <button 
                    onClick={() => handleRemoveAssignedStudents(selectedUserForStudents.id)}
                    className="btn btn-outline hover:bg-orange-50"
                    style={{ padding: '7px 14px', fontSize: '0.85rem', color: '#f97316', borderColor: '#fdba74', display: 'flex', alignItems: 'center', gap: '6px' }}
                    disabled={assignedStudents.length === 0}
                  >
                    <UserMinus size={14} /> Remove All ({assignedStudents.length})
                  </button>
                </div>

                <div style={{ maxHeight: '420px', overflowY: 'auto', flex: 1 }}>
                  {isStudentsLoading ? (
                    <div style={{ padding: '24px' }}>
                      <div className="skeleton-row" style={{ width: '100%', marginBottom: '12px' }}></div>
                      <div className="skeleton-row" style={{ width: '80%', marginBottom: '12px' }}></div>
                      <div className="skeleton-row" style={{ width: '90%' }}></div>
                    </div>
                  ) : assignedStudents.length === 0 ? (
                    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--muted)' }}>
                      <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                      <p style={{ fontWeight: 500, margin: '0 0 6px 0', color: 'var(--foreground)' }}>No students assigned yet</p>
                      <p style={{ fontSize: '0.85rem', margin: 0 }}>Click "Assign New Students" tab above to assign students to {selectedUserForStudents.username}.</p>
                    </div>
                  ) : filteredAssigned.length === 0 ? (
                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                      No assigned students matching "{assignedSearchTerm}"
                    </div>
                  ) : (
                    <table className="data-table" style={{ border: 'none', margin: 0 }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'white' }}>
                        <tr>
                          <th style={{ padding: '12px 24px' }}>Roll No</th>
                          <th style={{ padding: '12px 24px' }}>Name</th>
                          <th style={{ padding: '12px 24px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAssigned.map(student => (
                          <tr key={student.id}>
                            <td style={{ padding: '12px 24px', fontWeight: 600 }}>{student.rollNumber}</td>
                            <td style={{ padding: '12px 24px' }}>{student.name}</td>
                            <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                              <button 
                                onClick={() => handleRemoveSingleStudent(student.rollNumber)}
                                style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#ef4444', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: ASSIGN STUDENTS TO THIS USER */}
            {activeModalTab === "assign" && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: '20px 24px', gap: '20px' }}>
                
                {/* Method 1: Bulk Roll Numbers */}
                <div style={{ background: '#f8fafc', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={16} style={{ color: 'var(--primary)' }} />
                    <span>Quick Assign by Roll Numbers</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '12px' }}>
                    Paste roll numbers separated by commas, spaces, or newlines (e.g. <code>21BCS101, 21BCS102, 21BCS103</code>)
                  </div>
                  <textarea
                    rows={3}
                    value={manualRollNumbers}
                    onChange={(e) => setManualRollNumbers(e.target.value)}
                    placeholder="Enter student roll numbers here..."
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid var(--surface-border)', fontSize: '0.85rem', resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={handleAssignRollNumbers}
                      disabled={isAssigning || !manualRollNumbers.trim()}
                      className="btn btn-primary"
                      style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <UserPlus size={15} />
                      {isAssigning ? "Assigning..." : `Assign to ${selectedUserForStudents.username}`}
                    </button>
                  </div>
                </div>

                {/* Method 2: Browse and Select Unassigned Pool */}
                <div style={{ background: 'white', border: '1px solid var(--surface-border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Unassigned Students Pool ({unassignedStudents.length})</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Select students currently without any assigned teacher/sub-user</div>
                    </div>
                    {selectedUnassignedRolls.length > 0 && (
                      <button
                        type="button"
                        onClick={handleAssignSelectedUnassigned}
                        disabled={isAssigning}
                        className="btn btn-primary"
                        style={{ padding: '6px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <UserPlus size={14} />
                        Assign Selected ({selectedUnassignedRolls.length})
                      </button>
                    )}
                  </div>

                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--surface-border)' }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                      <input 
                        type="text" 
                        placeholder="Search unassigned pool by roll, name, branch..." 
                        value={unassignedSearchTerm}
                        onChange={e => setUnassignedSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '7px 12px 7px 34px', borderRadius: '6px', border: '1px solid var(--surface-border)', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {unassignedStudents.length === 0 ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
                        All students in the database are currently assigned to users!
                      </div>
                    ) : filteredUnassigned.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
                        No unassigned students match "{unassignedSearchTerm}"
                      </div>
                    ) : (
                      <table className="data-table" style={{ margin: 0 }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f8fafc' }}>
                          <tr>
                            <th style={{ width: '40px', padding: '8px 16px' }}>
                              <input 
                                type="checkbox"
                                checked={filteredUnassigned.length > 0 && selectedUnassignedRolls.length === filteredUnassigned.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUnassignedRolls(filteredUnassigned.map(s => s.rollNumber));
                                  } else {
                                    setSelectedUnassignedRolls([]);
                                  }
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                            </th>
                            <th style={{ padding: '8px 16px' }}>Roll No</th>
                            <th style={{ padding: '8px 16px' }}>Name</th>
                            <th style={{ padding: '8px 16px' }}>Branch</th>
                            <th style={{ padding: '8px 16px', textAlign: 'right' }}>Quick Assign</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUnassigned.map(student => {
                            const isChecked = selectedUnassignedRolls.includes(student.rollNumber);
                            return (
                              <tr key={student.id}>
                                <td style={{ padding: '8px 16px' }}>
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      setSelectedUnassignedRolls(prev => 
                                        prev.includes(student.rollNumber)
                                          ? prev.filter(r => r !== student.rollNumber)
                                          : [...prev, student.rollNumber]
                                      );
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  />
                                </td>
                                <td style={{ padding: '8px 16px', fontWeight: 600 }}>{student.rollNumber}</td>
                                <td style={{ padding: '8px 16px' }}>{student.name}</td>
                                <td style={{ padding: '8px 16px' }}>
                                  <span className="cohort-tag">{student.branch || '—'} {student.section ? `(${student.section})` : ''}</span>
                                </td>
                                <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleAssignSingleStudent(student.rollNumber)}
                                    className="btn btn-outline"
                                    style={{ padding: '3px 8px', fontSize: '0.78rem', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                                  >
                                    + Assign
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
