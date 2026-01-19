'use client';

import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

interface UserSquares {
  email: string;
  squareCount: number;
  locked: boolean;
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserSquares[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdminUser = user?.email?.toLowerCase() === 'isaacmray1984@gmail.com';

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();

      if (res.ok) {
        setUsers(data.users);
      } else {
        setError(data.error || 'Failed to load users');
      }
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (!authLoading && user && !isAdminUser) {
      router.push('/');
    }
  }, [user, authLoading, router, isAdminUser]);

  useEffect(() => {
    if (user && isAdminUser) {
      fetchUsers();
    }
  }, [user, isAdminUser, fetchUsers]);

  const handleRelease = async (email: string) => {
    if (actionLoading) return;

    const confirmed = window.confirm(
      `Are you sure you want to release all squares for ${email}? This will unlock and delete all their selections.`
    );

    if (!confirmed) return;

    setActionLoading(email);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/admin/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(data.message);
        await fetchUsers();
      } else {
        setError(data.error || 'Failed to release squares');
      }
    } catch {
      setError('Failed to release squares');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!user || !isAdminUser) {
    return null;
  }

  const totalSquares = users.reduce((sum, u) => sum + u.squareCount, 0);
  const lockedSquares = users
    .filter((u) => u.locked)
    .reduce((sum, u) => sum + u.squareCount, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Grid
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{users.length}</div>
              <div className="text-sm text-gray-600">Total Users</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{totalSquares}</div>
              <div className="text-sm text-gray-600">Squares Selected</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{lockedSquares}</div>
              <div className="text-sm text-gray-600">Squares Locked</div>
            </div>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Users with Squares</h2>
          </div>

          {users.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No users have selected squares yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {users.map((u) => (
                <div
                  key={u.email}
                  className="px-6 py-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900">{u.email}</div>
                    <div className="text-sm text-gray-500">
                      {u.squareCount} square{u.squareCount !== 1 ? 's' : ''}
                      {u.locked && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Locked
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRelease(u.email)}
                    disabled={actionLoading === u.email}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                  >
                    {actionLoading === u.email ? 'Releasing...' : 'Release Squares'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
