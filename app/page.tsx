'use client';

import { useAuth } from './contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

interface Square {
  row_num: number;
  col_num: number;
  email: string;
  locked: boolean;
}

interface Config {
  row_sequence: number[];
  col_sequence: number[];
}

export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [squares, setSquares] = useState<Map<string, Square>>(new Map());
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const userEmail = user?.email?.toLowerCase();
  const userLocked = userEmail
    ? Array.from(squares.values()).some((s) => s.email === userEmail && s.locked)
    : false;
  const userSquareCount = userEmail
    ? Array.from(squares.values()).filter((s) => s.email === userEmail).length
    : 0;

  const fetchSquares = useCallback(async () => {
    try {
      const res = await fetch('/api/squares');
      const data = await res.json();

      if (res.ok) {
        const map = new Map<string, Square>();
        data.squares.forEach((sq: Square) => {
          map.set(`${sq.row_num}-${sq.col_num}`, sq);
        });
        setSquares(map);
        if (data.config) {
          setConfig(data.config);
        }
      } else {
        setError(data.error || 'Failed to load squares');
      }
    } catch {
      setError('Failed to load squares');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      fetchSquares();
    }
  }, [user, fetchSquares]);

  const handleSquareClick = async (row: number, col: number) => {
    if (!user || userLocked || actionLoading) return;

    const key = `${row}-${col}`;
    const existing = squares.get(key);

    // Can't click on other users' squares
    if (existing && existing.email !== userEmail) return;

    setActionLoading(true);
    setError(null);

    // Optimistic update
    const prevSquares = new Map(squares);
    if (existing) {
      // Remove
      const newSquares = new Map(squares);
      newSquares.delete(key);
      setSquares(newSquares);
    } else {
      // Add
      const newSquares = new Map(squares);
      newSquares.set(key, {
        row_num: row,
        col_num: col,
        email: userEmail!,
        locked: false,
      });
      setSquares(newSquares);
    }

    try {
      const res = await fetch('/api/squares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row, col }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Rollback
        setSquares(prevSquares);
        setError(data.error || 'Failed to update square');
      }
    } catch {
      // Rollback
      setSquares(prevSquares);
      setError('Failed to update square');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLockIn = async () => {
    if (!user || userLocked || userSquareCount === 0 || actionLoading) return;

    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/squares/lock', {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        // Refresh squares to get locked status
        await fetchSquares();
        // Check if numbers were generated after locking 100th square
        if (data.config) {
          setConfig(data.config);
        }
      } else {
        setError(data.error || 'Failed to lock squares');
      }
    } catch {
      setError('Failed to lock squares');
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const truncateEmail = (email: string) => {
    if (email.length <= 10) return email;
    return email.substring(0, 8) + '...';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">2026 Olney Cougars SuperBowl Squares Fundraiser</h1>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
          <p className="text-gray-600 mb-4">
            Click on empty squares to select them. Click your own squares to deselect.
          </p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Your squares:</span> {userSquareCount}
              {userLocked && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Locked
                </span>
              )}
            </div>
            {!userLocked && (
              <button
                onClick={handleLockIn}
                disabled={userSquareCount === 0 || actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {actionLoading ? 'Processing...' : 'Lock me in!'}
              </button>
            )}
          </div>
        </div>

        {/* How it works button */}
        <div className="flex justify-center mb-4">
          <button
            onClick={() => setShowHowItWorks(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            How does this work?
          </button>
        </div>

        {/* Grid with watermark background */}
        <div className="flex justify-center">
          <div className="relative inline-block p-4 rounded-lg">
            {/* Watermark background with 40% opacity */}
            <div
              className="absolute inset-0 rounded-lg"
              style={{
                backgroundImage: 'url(/background.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.4,
              }}
            />
            {/* Grid with headers */}
            <div className="relative inline-block">
              {/* NFC logo and column headers (top) */}
              <div className="flex">
                <div className="w-16 h-16" /> {/* Empty corner */}
                <div className="flex flex-col">
                  <img src="/NFC.png" alt="NFC" className="h-12 object-contain" style={{ width: `${10 * 96}px` }} />
                  {config && (
                    <div className="flex">
                      {config.col_sequence.map((num, i) => (
                        <div
                          key={i}
                          className="w-24 h-8 flex items-center justify-center font-bold text-xl text-gray-800"
                        >
                          {num}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* AFC logo and rows */}
              <div className="flex">
                {/* AFC logo (left side) */}
                <div className="flex flex-col">
                  <img src="/AFC.png" alt="AFC" className="object-contain" style={{ width: '70px', height: `${10 * 96}px` }} />
                </div>

                {/* Number headers and grid */}
                <div>
                  {Array.from({ length: 10 }, (_, row) => (
                    <div key={row} className="flex">
                      {/* Row header (left) */}
                      {config && (
                        <div className="w-8 h-24 flex items-center justify-center font-bold text-xl text-gray-800">
                          {config.row_sequence[row]}
                        </div>
                      )}

                  {/* Cells */}
                  {Array.from({ length: 10 }, (_, col) => {
                    const key = `${row}-${col}`;
                    const square = squares.get(key);
                    const isOwn = square?.email === userEmail;
                    const isTaken = !!square;
                    const isLocked = square?.locked;

                    let bgColor = 'bg-transparent hover:bg-white/30';
                    let cursor = 'cursor-pointer';
                    let textColor = 'text-gray-600';

                    if (isTaken) {
                      if (isOwn) {
                        bgColor = 'bg-green-500';
                        textColor = 'text-white';
                        if (userLocked) {
                          cursor = 'cursor-default';
                        } else {
                          bgColor += ' hover:bg-green-600';
                        }
                      } else {
                        bgColor = 'bg-red-400';
                        textColor = 'text-white';
                        cursor = 'cursor-not-allowed';
                      }
                    } else if (userLocked) {
                      cursor = 'cursor-not-allowed';
                    }

                    return (
                      <div
                        key={col}
                        onClick={() => handleSquareClick(row, col)}
                        className={`w-24 h-24 border border-gray-400 flex flex-col items-center justify-center ${bgColor} ${cursor} ${textColor} text-xs transition-colors`}
                      >
                        {isTaken && (
                          <>
                            <span className="font-medium">
                              {isOwn ? 'You' : truncateEmail(square.email)}
                            </span>
                            {isLocked && <span className="text-[10px]">locked</span>}
                          </>
                        )}
                      </div>
                    );
                  })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex justify-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white/50 border border-gray-300"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500"></div>
            <span>Your selection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-400"></div>
            <span>Taken</span>
          </div>
        </div>
      </div>

      {/* How It Works Modal */}
      {showHowItWorks && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-900">How Super Bowl Squares Works</h2>
                <button
                  onClick={() => setShowHowItWorks(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4 text-gray-700">
                <div>
                  <h3 className="font-semibold text-lg mb-2">The Basics</h3>
                  <p>
                    Super Bowl Squares is a fun, easy way to bet on the big game without needing to know anything about football!
                    The game uses a 10x10 grid creating 100 squares.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">How to Play</h3>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Click on any available square to select it. You can select multiple squares.</li>
                    <li>Once you&apos;re happy with your selections, click &quot;Lock me in!&quot; to finalize your choices.</li>
                    <li>After all 100 squares are locked in, random numbers (0-9) will be assigned to each row and column.</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">How Winners Are Determined</h3>
                  <p>
                    At the end of each quarter, look at the last digit of each team&apos;s score.
                    The square where the row (AFC team) and column (NFC team) intersect is the winner for that quarter!
                  </p>
                  <p className="mt-2">
                    <strong>Example:</strong> If the score is AFC 17, NFC 14 at the end of a quarter,
                    find where row &quot;7&quot; and column &quot;4&quot; meet. That square wins!
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2">Payouts</h3>
                  <p>
                    25% of the prize pool will be paid to the first quarter winner, 25% will be paid to the half-time winner, and 50% will be paid to the final score winner.
                  </p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-lg mb-2">Tips</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Numbers are assigned randomly after all squares are filled, so every square has an equal chance!</li>
                    <li>Some numbers (like 0, 3, 7) tend to come up more often in football scores.</li>
                    <li>The more squares you have, the better your chances of winning.</li>
                  </ul>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setShowHowItWorks(false)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
