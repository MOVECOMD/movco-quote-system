// app/company-dashboard/team/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  ROLE_DEFAULTS, hasPermission, roleLabel, roleColor, statusColor,
  type Role, type Resource, type AccessLevel, type CompanyUser,
} from '@/lib/permissions';

type Invite = {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  accepted: boolean;
  created_at: string;
};

export default function TeamPage() {
  const { user, loading: authLoading, companyUser } = useAuth();
  const router = useRouter();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [members, setMembers] = useState<CompanyUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<CompanyUser | null>(null);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push('/auth');
  }, [user, authLoading, router]);

  // Load data
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: co } = await supabase
        .from('companies').select('id, name').eq('user_id', user.id).maybeSingle();

      let cid = co?.id;
      let cname = co?.name || '';

      // If not a company owner, check if they are a team member
      if (!cid && companyUser) {
        cid = companyUser.company_id;
        const { data: co2 } = await supabase
          .from('companies').select('name').eq('id', cid).single();
        cname = co2?.name || '';
      }

      if (!cid) { setLoading(false); return; }

      setCompanyId(cid);
      setCompanyName(cname);

      const { data: membersData } = await supabase
        .from('company_users').select('*').eq('company_id', cid).order('created_at');
      if (membersData) setMembers(membersData as CompanyUser[]);

      const { data: invitesData } = await supabase
        .from('company_invites').select('*').eq('company_id', cid)
        .eq('accepted', false).order('created_at', { ascending: false });
      if (invitesData) setInvites(invitesData as Invite[]);

      setLoading(false);
    })();
  }, [user, companyUser]);

  // Permission check — only owner/manager can manage team
  const canManage = !companyUser || hasPermission(companyUser, 'team', 'edit');
  const isOwner = !companyUser || companyUser.role === 'owner';

  // ─── Invite ───────────────────────────────────────────────
  const sendInvite = async (email: string, role: Role, name: string) => {
    if (!companyId) return;
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 24);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Create invite record
    const { error: invErr } = await supabase.from('company_invites').insert({
      company_id: companyId, email, role, token, expires_at: expiresAt,
    });
    if (invErr) { alert('Failed to create invite: ' + invErr.message); return; }

    // Also create a company_users record in 'invited' status
    const { error: cuErr } = await supabase.from('company_users').insert({
      company_id: companyId, email, name, role,
      permissions: ROLE_DEFAULTS[role],
      status: 'invited', invited_by: user?.id,
    });
    if (cuErr) { alert('Failed to create team member: ' + cuErr.message); return; }

    // Copy invite link
    const link = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      alert(`Invite link copied!\n\nSend this to ${name}:\n${link}\n\nExpires in 7 days.`);
    } catch {
      prompt('Copy this invite link:', link);
    }

    // Refresh
    const { data: m } = await supabase.from('company_users').select('*').eq('company_id', companyId).order('created_at');
    if (m) setMembers(m as CompanyUser[]);
    const { data: inv } = await supabase.from('company_invites').select('*').eq('company_id', companyId).eq('accepted', false);
    if (inv) setInvites(inv as Invite[]);

    setShowInviteModal(false);
  };

  // ─── Edit role/permissions ────────────────────────────────
  const updateMember = async (memberId: string, role: Role, permissions: Record<Resource, AccessLevel>) => {
    const { error } = await supabase.from('company_users')
      .update({ role, permissions, updated_at: new Date().toISOString() })
      .eq('id', memberId);
    if (!error) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role, permissions } as CompanyUser : m));
    }
    setShowEditModal(false);
    setEditingMember(null);
  };

  // ─── Deactivate / Reactivate ─────────────────────────────
  const toggleMemberStatus = async (member: CompanyUser) => {
    if (member.role === 'owner') return;
    const newStatus = member.status === 'active' ? 'deactivated' : 'active';
    if (newStatus === 'deactivated' && !confirm(`Deactivate ${member.name}? They will lose access.`)) return;
    const { error } = await supabase.from('company_users')
      .update({ status: newStatus }).eq('id', member.id);
    if (!error) {
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, status: newStatus } as CompanyUser : m));
    }
  };

  // ─── Remove member ───────────────────────────────────────
  const removeMember = async (member: CompanyUser) => {
    if (member.role === 'owner') return;
    if (!confirm(`Remove ${member.name} from the team? This cannot be undone.`)) return;
    const { error } = await supabase.from('company_users').delete().eq('id', member.id);
    if (!error) setMembers(prev => prev.filter(m => m.id !== member.id));
  };

  // ─── Revoke invite ───────────────────────────────────────
  const revokeInvite = async (invite: Invite) => {
    if (!confirm(`Revoke invite for ${invite.email}?`)) return;
    await supabase.from('company_invites').delete().eq('id', invite.id);
    // Also remove the invited company_user
    await supabase.from('company_users').delete()
      .eq('company_id', companyId).eq('email', invite.email).eq('status', 'invited');
    setInvites(prev => prev.filter(i => i.id !== invite.id));
    setMembers(prev => prev.filter(m => !(m.email === invite.email && m.status === 'invited')));
  };

  // ─── Resend invite link ──────────────────────────────────
  const resendInvite = async (invite: Invite) => {
    const link = `${window.location.origin}/invite/${invite.token}`;
    try {
      await navigator.clipboard.writeText(link);
      alert(`Invite link copied!\n\nSend to ${invite.email}:\n${link}`);
    } catch {
      prompt('Copy this invite link:', link);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-gray-700 font-medium">Loading team...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const activeMembers = members.filter(m => m.status === 'active');
  const invitedMembers = members.filter(m => m.status === 'invited');
  const deactivatedMembers = members.filter(m => m.status === 'deactivated');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 md:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/company-dashboard')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {companyName} &middot; {activeMembers.length} active member{activeMembers.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {canManage && (
          <button onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite Member
          </button>
        )}
      </div>

      <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-6">

        {/* Role summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['owner','manager','staff','driver'] as Role[]).map(role => {
            const count = members.filter(m => m.role === role && m.status !== 'deactivated').length;
            return (
              <div key={role} className="bg-white rounded-xl border p-4">
                <p className="text-xs font-medium text-gray-500">{roleLabel(role)}s</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Active members */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-sm">Active Members</h2>
            <span className="text-xs text-gray-500">{activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}</span>
          </div>
          {activeMembers.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No active members yet.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activeMembers.map(member => (
                <div key={member.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {member.name}
                        {member.user_id === user?.id && (
                          <span className="text-xs text-gray-400 font-normal ml-2">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${roleColor(member.role as Role)}`}>
                      {roleLabel(member.role as Role)}
                    </span>
                    {canManage && member.role !== 'owner' && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingMember(member); setShowEditModal(true); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit role">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => toggleMemberStatus(member)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Deactivate">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending invites */}
        {invitedMembers.length > 0 && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-4 border-b bg-yellow-50 flex items-center justify-between">
              <h2 className="font-bold text-yellow-800 text-sm">Pending Invites</h2>
              <span className="text-xs text-yellow-600">{invitedMembers.length} pending</span>
            </div>
            <div className="divide-y divide-gray-100">
              {invitedMembers.map(member => {
                const invite = invites.find(i => i.email === member.email);
                return (
                  <div key={member.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition">
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-sm flex-shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{member.name}</p>
                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${roleColor(member.role as Role)}`}>
                        {roleLabel(member.role as Role)}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                        Invited
                      </span>
                      {canManage && invite && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => resendInvite(invite)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Copy invite link">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                          </button>
                          <button onClick={() => revokeInvite(invite)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Revoke invite">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Deactivated */}
        {deactivatedMembers.length > 0 && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-4 border-b bg-red-50 flex items-center justify-between">
              <h2 className="font-bold text-red-800 text-sm">Deactivated</h2>
              <span className="text-xs text-red-600">{deactivatedMembers.length}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {deactivatedMembers.map(member => (
                <div key={member.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition opacity-60">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 font-bold text-sm flex-shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-700 text-sm">{member.name}</p>
                      <p className="text-xs text-gray-400">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {canManage && (
                      <>
                        <button onClick={() => toggleMemberStatus(member)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-3 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition">
                          Reactivate
                        </button>
                        {isOwner && (
                          <button onClick={() => removeMember(member)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition">
                            Remove
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Permissions reference */}
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Role Permissions</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Feature</th>
                  <th className="px-3 py-2 text-center font-semibold text-purple-700">Owner</th>
                  <th className="px-3 py-2 text-center font-semibold text-blue-700">Manager</th>
                  <th className="px-3 py-2 text-center font-semibold text-green-700">Staff</th>
                  <th className="px-3 py-2 text-center font-semibold text-yellow-700">Driver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(['quotes','pipeline','diary','customers','reports','settings','team','import'] as Resource[]).map(res => (
                  <tr key={res}>
                    <td className="px-3 py-2 font-medium text-gray-700 capitalize">{res}</td>
                    {(['owner','manager','staff','driver'] as Role[]).map(role => {
                      const lvl = ROLE_DEFAULTS[role][res];
                      const icon = lvl === 'full' ? '✅' : lvl === 'edit' ? '✏️' : lvl === 'view' ? '👁' : lvl === 'own' ? '🔒' : '—';
                      return <td key={role} className="px-3 py-2 text-center">{icon}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-400 mt-3">✅ Full access &middot; ✏️ Edit &middot; 👁 View only &middot; 🔒 Own items only &middot; — No access</p>
        </div>
      </div>

      {/* ═══════ INVITE MODAL ═══════ */}
      {showInviteModal && (
        <InviteModal
          onSave={sendInvite}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* ═══════ EDIT ROLE MODAL ═══════ */}
      {showEditModal && editingMember && (
        <EditRoleModal
          member={editingMember}
          onSave={updateMember}
          onClose={() => { setShowEditModal(false); setEditingMember(null); }}
        />
      )}
    </div>
  );
}


// ─── Invite Modal ───────────────────────────────────────────

function InviteModal({ onSave, onClose }: {
  onSave: (email: string, role: Role, name: string) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('staff');

  const roles: { value: Role; label: string; desc: string }[] = [
    { value: 'manager', label: 'Manager', desc: 'Full CRM access, can manage settings' },
    { value: 'staff', label: 'Staff', desc: 'Edit quotes, diary, customers. No settings' },
    { value: 'driver', label: 'Driver', desc: 'View quotes and customers, own diary only' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Invite Team Member</h2>
        <p className="text-sm text-gray-500 mb-5">They will receive a link to join your team.</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="John Smith"
              className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="john@example.com"
              className="w-full px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Role</label>
            <div className="space-y-2">
              {roles.map(r => (
                <label key={r.value}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                    role === r.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input type="radio" name="role" value={r.value} checked={role === r.value}
                    onChange={() => setRole(r.value)} className="hidden" />
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    role === r.value ? 'border-blue-600' : 'border-gray-300'
                  }`}>
                    {role === r.value && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{r.label}</p>
                    <p className="text-xs text-gray-500">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => {
            if (!name.trim()) return alert('Name is required');
            if (!email.trim()) return alert('Email is required');
            onSave(email, role, name);
          }} className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition">
            Send Invite
          </button>
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Edit Role Modal ────────────────────────────────────────

function EditRoleModal({ member, onSave, onClose }: {
  member: CompanyUser;
  onSave: (memberId: string, role: Role, permissions: Record<Resource, AccessLevel>) => void;
  onClose: () => void;
}) {
  const [role, setRole] = useState<Role>(member.role as Role);
  const [perms, setPerms] = useState<Record<Resource, AccessLevel>>(
    member.permissions || ROLE_DEFAULTS[member.role as Role]
  );

  const [showCustom, setShowCustom] = useState(false);

  // When role changes, reset to defaults
  const handleRoleChange = (newRole: Role) => {
    setRole(newRole);
    setPerms(ROLE_DEFAULTS[newRole]);
  };

  const resources: { key: Resource; label: string }[] = [
    { key: 'quotes', label: 'Quotes' },
    { key: 'pipeline', label: 'Pipeline' },
    { key: 'diary', label: 'Diary' },
    { key: 'customers', label: 'Customers' },
    { key: 'reports', label: 'Reports' },
    { key: 'settings', label: 'Settings' },
    { key: 'team', label: 'Team' },
    { key: 'import', label: 'Import' },
  ];

  const levels: AccessLevel[] = ['full', 'edit', 'view', 'none'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Edit Role</h2>
        <p className="text-sm text-gray-500 mb-5">{member.name} &middot; {member.email}</p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 mb-2 block">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(['manager','staff','driver'] as Role[]).map(r => (
                <button key={r} onClick={() => handleRoleChange(r)}
                  className={`px-3 py-2.5 rounded-lg text-sm font-semibold transition ${
                    role === r ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                  {roleLabel(r)}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setShowCustom(!showCustom)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            {showCustom ? 'Hide custom permissions' : 'Customise permissions'}
          </button>

          {showCustom && (
            <div className="border rounded-xl p-4 space-y-2">
              {resources.map(res => (
                <div key={res.key} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{res.label}</span>
                  <select value={perms[res.key] || 'none'}
                    onChange={e => setPerms({ ...perms, [res.key]: e.target.value as AccessLevel })}
                    className="px-3 py-1.5 border rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none">
                    {levels.map(l => (
                      <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={() => onSave(member.id, role, perms)}
            className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition">
            Save Changes
          </button>
          <button onClick={onClose}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
