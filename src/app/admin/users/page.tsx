"use client";

import { useState, useEffect } from "react";
import { User, Lock, Trash2, Plus, ArrowLeft, Users, X, UserMinus } from "lucide-react";
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

  // Manage Students Modal States
  const [selectedUserForStudents, setSelectedUserForStudents] = useState<any | null>(null);
  const [assignedStudents, setAssignedStudents] = useState<any[]>([]);
  const [isStudentsLoading, setIsStudentsLoading] = useState(false);

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
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword })
      });
      
      if (res.ok) {
        setNewUsername("");
        setNewPassword("");
        fetchUsers();
        alert("User created successfully");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create user");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleChangePassword = async (userId: string) => {
    const newPassword = prompt("Enter new password for this user (min 6 characters):");
    if (!newPassword) return;

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newPassword })
      });
      
      if (res.ok) {
        alert("Password updated successfully");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update password");
      }
    } catch (e) {
      console.error(e);
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

  const handleRemoveAssignedStudents = async (userId: string) => {
    if (!confirm("Are you sure you want to unassign all students from this user? The students will remain in the database but this user will no longer see them.")) return;

    try {
      const res = await fetch(`/api/users/unassign-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        fetchUsers();
        if (selectedUserForStudents?.id === userId) {
           setAssignedStudents([]);
        }
      } else {
        const data = await res.json();
        alert(data.error || "Failed to unassign students");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenManageStudents = async (user: any) => {
    setSelectedUserForStudents(user);
    setIsStudentsLoading(true);
    try {
      const res = await fetch(`/api/users/students?userId=${user.id}`);
      if (res.ok) {
        setAssignedStudents(await res.json());
      }
    } catch(e) {
      console.error(e);
    } finally {
      setIsStudentsLoading(false);
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
        fetchUsers(); // Update the count on the main table
      }
    } catch(e) {
      console.error(e);
    }
  };

  if (loading || status === "loading") {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="dashboard-layout">
      <nav className="topnav">
        <div className="topnav-brand">
          <Link href="/" className="icon-btn" style={{background: 'transparent', textDecoration: 'none', color: 'inherit'}}>
            <ArrowLeft size={20} />
          </Link>
          <div className="topnav-brand-icon">L</div>
          <span>User Management</span>
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
            <h2>Manage Sub-Users</h2>
            <div style={{opacity: 0.9, fontSize: '0.9rem', marginTop: 4}}>
              Create users and manage their passwords
            </div>
          </div>
        </div>

        <div style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
            
            {/* Create User Form */}
            <div className="dashboard-card" style={{ margin: 0, alignSelf: 'start' }}>
              <div className="card-header">
                <h3 className="card-title">Create New User</h3>
              </div>
              <form onSubmit={handleCreateUser} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Username</label>
                  <input 
                    type="text" 
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="teacher_vipin"
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 600 }}>Password</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}
                    required
                  />
                </div>
                <button type="submit" disabled={isCreating} className="btn btn-primary" style={{ marginTop: '8px' }}>
                  <Plus size={16} /> {isCreating ? "Creating..." : "Create User"}
                </button>
              </form>
            </div>

            {/* Users List */}
            <div className="dashboard-card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title">All Users</h3>
              </div>
              {users.length === 0 ? (
                <div className="p-8 text-center text-muted">No sub-users created yet.</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{padding: '12px 16px'}}>Username</th>
                      <th style={{padding: '12px 16px'}}>Role</th>
                      <th style={{padding: '12px 16px'}}>Students</th>
                      <th style={{padding: '12px 16px', textAlign: 'right'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td style={{padding: '12px 16px', fontWeight: 500}}>{u.username}</td>
                        <td style={{padding: '12px 16px'}}>
                          <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600, background: '#e2e8f0', color: '#475569' }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{padding: '12px 16px', color: 'var(--muted)'}}>
                          <Users size={14} style={{display: 'inline', marginRight: 4, verticalAlign: 'text-bottom'}} />
                          {u._count?.students || 0}
                        </td>
                        <td style={{padding: '12px 16px', textAlign: 'right'}}>
                          <button 
                            onClick={() => handleChangePassword(u.id)}
                            className="btn btn-outline"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', marginRight: '8px' }}
                            title="Change Password"
                          >
                            <Lock size={14} /> 
                          </button>
                          <button 
                            onClick={() => handleOpenManageStudents(u)}
                            className="btn btn-outline"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', marginRight: '8px' }}
                            title="Manage Assigned Students"
                          >
                            Manage Students
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="btn btn-outline hover:bg-red-50"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#ef4444', borderColor: '#fca5a5' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Manage Students Modal */}
      {selectedUserForStudents && (
        <div className="modal-overlay" onClick={() => setSelectedUserForStudents(null)}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{maxWidth: 600}}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Assigned Students</h2>
                <div style={{fontSize: '0.85rem', color: 'var(--muted)', marginTop: 4}}>{selectedUserForStudents.username} has {assignedStudents.length} students</div>
              </div>
              <button className="icon-btn" onClick={() => setSelectedUserForStudents(null)}><X size={20} /></button>
            </div>
            
            <div style={{padding: '16px 24px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end'}}>
               <button 
                  onClick={() => handleRemoveAssignedStudents(selectedUserForStudents.id)}
                  className="btn btn-outline hover:bg-orange-50"
                  style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#f97316', borderColor: '#fdba74' }}
                  disabled={assignedStudents.length === 0}
                >
                  <UserMinus size={14} /> Remove All Students
                </button>
            </div>

            <div style={{maxHeight: '400px', overflowY: 'auto'}}>
              {isStudentsLoading ? (
                <div className="p-8 text-center text-muted">Loading students...</div>
              ) : assignedStudents.length === 0 ? (
                <div className="p-8 text-center text-muted">No students assigned to this user.</div>
              ) : (
                <table className="data-table" style={{border: 'none', margin: 0}}>
                  <thead style={{position: 'sticky', top: 0, zIndex: 10, background: 'white'}}>
                    <tr>
                      <th style={{padding: '12px 24px'}}>Roll No</th>
                      <th style={{padding: '12px 24px'}}>Name</th>
                      <th style={{padding: '12px 24px', textAlign: 'right'}}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedStudents.map(student => (
                      <tr key={student.id}>
                        <td style={{padding: '12px 24px', fontWeight: 500}}>{student.rollNumber}</td>
                        <td style={{padding: '12px 24px'}}>{student.name}</td>
                        <td style={{padding: '12px 24px', textAlign: 'right'}}>
                          <button 
                            onClick={() => handleRemoveSingleStudent(student.rollNumber)}
                            style={{ padding: '4px 8px', fontSize: '0.8rem', color: '#ef4444', background: 'transparent', border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer' }}
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
        </div>
      )}
    </div>
  );
}
