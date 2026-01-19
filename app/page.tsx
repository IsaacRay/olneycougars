'use client';

import { useAuth } from './contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';

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
  const [gridScale, setGridScale] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

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

  // Calculate grid scale to fit viewport
  useEffect(() => {
    const calculateScale = () => {
      // Grid width: AFC logo (70px) + row headers (32px) + 10 cells (960px) + padding (48px) ≈ 1110px
      const gridWidth = 1110;
      const viewportWidth = window.innerWidth;
      const padding = 32; // Page padding
      const availableWidth = viewportWidth - padding;

      if (availableWidth < gridWidth) {
        setGridScale(availableWidth / gridWidth);
      } else {
        setGridScale(1);
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 mb-6 border border-white/20">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
              2026 Olney Cougars SuperBowl Squares Fundraiser
            </h1>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-all duration-300 hover:scale-105 shadow-lg"
            >
              Logout
            </button>
          </div>
          <p className="text-gray-300 mb-4">
            Click on empty squares to select them. Click your own squares to deselect.
          </p>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-4 backdrop-blur">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-300">
              <span className="font-semibold text-white">Your squares:</span>{' '}
              <span className="text-xl font-bold text-yellow-400">{userSquareCount}</span>
              {userLocked && (
                <span className="ml-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/30 text-emerald-300 border border-emerald-500/50">
                  Locked In
                </span>
              )}
            </div>
            {!userLocked && (
              <button
                onClick={handleLockIn}
                disabled={userSquareCount === 0 || actionLoading}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-full hover:from-emerald-600 hover:to-green-700 transition-all duration-300 hover:scale-105 shadow-lg shadow-emerald-500/30 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
              >
                {actionLoading ? 'Processing...' : 'Lock me in!'}
              </button>
            )}
          </div>
        </div>

        {/* How it works button */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowHowItWorks(true)}
            className="px-6 py-3 bg-white/10 backdrop-blur text-white font-semibold rounded-full hover:bg-white/20 transition-all duration-300 border border-white/30 hover:border-white/50 hover:scale-105"
          >
            How does this work?
          </button>
        </div>

        {/* Grid with watermark background */}
        <div className="flex justify-center overflow-hidden">
          <div
            ref={gridRef}
            className="relative inline-block p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 shadow-2xl origin-top"
            style={{
              transform: `scale(${gridScale})`,
              marginBottom: gridScale < 1 ? `${(gridScale - 1) * 1100}px` : 0,
            }}
          >
            {/* Watermark background with 40% opacity */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                backgroundImage: 'url(/background.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: 0.3,
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
                          className="w-24 h-8 flex items-center justify-center font-bold text-xl text-yellow-400 drop-shadow-lg"
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
                        <div className="w-8 h-24 flex items-center justify-center font-bold text-xl text-yellow-400 drop-shadow-lg">
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

                    let bgColor = 'bg-white/5 hover:bg-white/20';
                    let cursor = 'cursor-pointer';
                    let textColor = 'text-gray-300';

                    if (isTaken) {
                      if (isOwn) {
                        bgColor = 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/30';
                        textColor = 'text-white';
                        if (userLocked) {
                          cursor = 'cursor-default';
                        } else {
                          bgColor += ' hover:from-emerald-600 hover:to-green-700';
                        }
                      } else {
                        bgColor = 'bg-gradient-to-br from-red-500 to-rose-600 shadow-lg shadow-red-500/30';
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
                        className={`w-24 h-24 border border-white/20 flex flex-col items-center justify-center ${bgColor} ${cursor} ${textColor} text-xs transition-all duration-200`}
                      >
                        {isTaken && (
                          <>
                            <span className="font-semibold">
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
        <div className="mt-6 flex justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-white/10 border border-white/20 rounded"></div>
            <span className="text-gray-300">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-emerald-500 to-green-600 rounded shadow-md"></div>
            <span className="text-gray-300">Your selection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-red-500 to-rose-600 rounded shadow-md"></div>
            <span className="text-gray-300">Taken</span>
          </div>
        </div>
      </div>

      {/* How It Works Modal */}
      {showHowItWorks && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">How Super Bowl Squares Works</h2>
                <button
                  onClick={() => setShowHowItWorks(false)}
                  className="text-gray-400 hover:text-white text-2xl leading-none transition-colors"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4 text-gray-300">
                <div>
                  <h3 className="font-semibold text-lg mb-2 text-white">The Basics</h3>
                  <p>
                    Super Bowl Squares is a fun, easy way to bet on the big game without needing to know anything about football!
                    The game uses a 10x10 grid creating 100 squares.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 text-white">How to Play</h3>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Click on any available square to select it. You can select multiple squares.</li>
                    <li>Once you&apos;re happy with your selections, click &quot;Lock me in!&quot; to finalize your choices.</li>
                    <li>After all 100 squares are locked in, random numbers (0-9) will be assigned to each row and column.</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 text-white">How Winners Are Determined</h3>
                  <p>
                    At the end of each quarter, look at the last digit of each team&apos;s score.
                    The square where the row (AFC team) and column (NFC team) intersect is the winner for that quarter!
                  </p>
                  <p className="mt-2">
                    <span className="text-yellow-400 font-semibold">Example:</span> If the score is AFC 17, NFC 14 at the end of a quarter,
                    find where row &quot;7&quot; and column &quot;4&quot; meet. That square wins!
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-2 text-white">Payouts</h3>
                  <p>
                    25% of the prize pool will be paid to the first quarter winner, 25% will be paid to the half-time winner, and 50% will be paid to the final score winner.
                  </p>
                </div>

                <div className="bg-white/10 p-4 rounded-xl border border-white/10">
                  <h3 className="font-semibold text-lg mb-2 text-yellow-400">Tips</h3>
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
                  className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-full hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-orange-500/30"
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
