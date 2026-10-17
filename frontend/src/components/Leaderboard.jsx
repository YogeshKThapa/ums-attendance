import React, { useState, useEffect } from 'react';

const Leaderboard = ({ studentData, overallPercentage, onBack }) => {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' | 'info' }

    const API_BASE = import.meta.env.VITE_API_URL || '';
    const rollNo = studentData?.roll_no || studentData?.RollNo;

    const [optedIn, setOptedIn] = useState(false);

    // Auto-dismiss toast notifications after 4.5 seconds
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(() => setToast(null), 4500);
        return () => clearTimeout(timer);
    }, [toast]);

    // Handle Escape key to close the confirmation modal
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showDeleteConfirm && !deleting) {
                setShowDeleteConfirm(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showDeleteConfirm, deleting]);

    useEffect(() => {
        const hasOptedIn = localStorage.getItem(`leaderboard_optin_${rollNo}`) === 'true';
        setOptedIn(hasOptedIn);

        if (hasOptedIn) {
            fetchLeaderboard();
        } else {
            setLoading(false);
        }
    }, [rollNo]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/leaderboard`);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Server Error: ${res.status} ${res.statusText} - ${text.substring(0, 50)}...`);
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                setLeaders(data);
            } else {
                throw new Error("Invalid data format received");
            }
        } catch (err) {
            console.error("Failed to fetch leaderboard", err);
            setError(err.message || "Failed to load rankings.");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!rollNo) return;

        setDeleting(true);
        try {
            const res = await fetch(`${API_BASE}/api/leaderboard/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roll_no: rollNo })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Server Error: ${res.status} ${res.statusText} - ${text.substring(0, 100)}`);
            }

            const data = await res.json();
            if (data.success) {
                localStorage.removeItem(`leaderboard_optin_${rollNo}`);
                setOptedIn(false);
                setLeaders([]);
                setShowDeleteConfirm(false);
                setToast({ message: "Your rank was successfully deleted from the leaderboard.", type: "success" });
            } else {
                setToast({ message: "Failed to delete rank: " + (data.error || data.message || "Unknown error"), type: "error" });
            }
        } catch (err) {
            console.error("Leaderboard Delete Error:", err);
            setToast({ message: `Error deleting rank: ${err.message}`, type: "error" });
        } finally {
            setDeleting(false);
        }
    };

    const handleJoin = async () => {
        if (!studentData || !overallPercentage) return;
        setJoining(true);
        try {
            const res = await fetch(`${API_BASE}/api/leaderboard/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roll_no: rollNo,
                    name: studentData.student_name || studentData.StudentName,
                    percentage: overallPercentage,
                    type: 'overall'
                })
            });

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Server Error: ${res.status} ${res.statusText} - ${text.substring(0, 100)}`);
            }

            const data = await res.json();
            if (data.success) {
                localStorage.setItem(`leaderboard_optin_${rollNo}`, 'true');
                setOptedIn(true);
                setToast({ message: "🎉 Welcome to the leaderboard! Your rank is now live.", type: "success" });
                fetchLeaderboard();
            } else {
                setToast({ message: "Failed to join: " + (data.error || "Unknown error"), type: "error" });
            }
        } catch (err) {
            console.error("Leaderboard Join Error:", err);
            setToast({ message: `Error joining: ${err.message}`, type: "error" });
        } finally {
            setJoining(false);
        }
    };

    // Calculate user's standing
    const userRankIndex = leaders.findIndex(u => String(u.roll_no).trim() === String(rollNo).trim());
    const userRank = userRankIndex !== -1 ? userRankIndex + 1 : null;

    return (
        <div className="leaderboard-container fade-in">
            {/* Toast Feedback */}
            {toast && (
                <div className={`leaderboard-toast ${toast.type}`}>
                    <span className="toast-icon">
                        {toast.type === 'success' ? '✅' : toast.type === 'error' ? '⚠️' : 'ℹ️'}
                    </span>
                    <span className="toast-text">{toast.message}</span>
                    <button className="toast-close" onClick={() => setToast(null)} aria-label="Dismiss">✕</button>
                </div>
            )}

            {/* Header Navigation */}
            <div className="header-row">
                <button onClick={onBack} className="back-btn" aria-label="Go back to dashboard">
                    <span className="back-icon">←</span> Dashboard
                </button>
                <h2>🏆 Leaderboard</h2>
                <button 
                    onClick={fetchLeaderboard} 
                    className="refresh-btn" 
                    title="Refresh Rankings" 
                    disabled={loading || !optedIn}
                    aria-label="Refresh Leaderboard"
                >
                    🔄
                </button>
            </div>

            {/* Main Content */}
            {!optedIn ? (
                <div className="opt-in-view">
                    <div className="opt-in-badge">🏆</div>
                    <h3 className="opt-in-title">Join the Leaderboard</h3>
                    <p className="opt-in-desc">
                        Compare your attendance with peers and celebrate consistency!
                    </p>

                    <div className="opt-in-privacy-card">
                        <span className="privacy-badge-icon">🔒</span>
                        <div>
                            <strong>Privacy Guarantee</strong>
                            <p>Only your name and attendance % are shared. You can delete your rank anytime.</p>
                        </div>
                    </div>

                    {overallPercentage === null ? (
                        <div className="opt-in-warning-box">
                            ⚠️ Please go back to the Dashboard and load your <strong>Overall Semester</strong> attendance to join.
                        </div>
                    ) : (
                        <button
                            onClick={handleJoin}
                            disabled={joining}
                            className="opt-in-join-btn"
                        >
                            {joining ? (
                                <>
                                    <span className="spinner-sm"></span> Joining...
                                </>
                            ) : (
                                '🚀 Join Leaderboard'
                            )}
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* Status & Action Card */}
                    <div className="leaderboard-status-card">
                        <div className="status-card-header">
                            <div className="status-live-indicator">
                                <span className="status-pulse-dot"></span>
                                <span>Active on Leaderboard</span>
                            </div>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                disabled={deleting}
                                className="delete-rank-trigger-btn"
                                title="Remove your rank from public leaderboard"
                            >
                                🗑️ Remove My Rank
                            </button>
                        </div>

                        <div className="status-stats-grid">
                            <div className="stat-box">
                                <span className="stat-label">Your Attendance</span>
                                <span className="stat-value highlight-score">
                                    {overallPercentage === null ? 'No Data' : `${overallPercentage}%`}
                                </span>
                            </div>
                            <div className="stat-box">
                                <span className="stat-label">Current Rank</span>
                                <span className="stat-value">
                                    {userRank ? `#${userRank} of ${leaders.length}` : (loading ? '...' : '—')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Rankings List or Loading/Empty States */}
                    {loading ? (
                        <div className="leaderboard-state-box">
                            <div className="spinner"></div>
                            <p>Loading rankings...</p>
                        </div>
                    ) : error ? (
                        <div className="error-message">{error}</div>
                    ) : leaders.length === 0 ? (
                        <div className="leaderboard-state-box empty">
                            <div className="state-icon">🌵</div>
                            <p>No rankings available yet.</p>
                            <p className="state-subtext">Be the first to join the leaderboard!</p>
                        </div>
                    ) : (
                        <div className="rank-list">
                            {leaders.map((user, index) => {
                                const isCurrentUser = String(user.roll_no).trim() === String(rollNo).trim();
                                const rankNum = index + 1;
                                const medal = rankNum === 1 ? '🥇' : rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : null;

                                return (
                                    <div
                                        key={user.roll_no || index}
                                        className={`rank-item ${isCurrentUser ? 'highlight' : ''} ${rankNum <= 3 ? `top-${rankNum}` : ''}`}
                                    >
                                        <div className="rank-num">
                                            {medal ? <span className="rank-medal">{medal}</span> : `#${rankNum}`}
                                        </div>
                                        <div className="rank-info">
                                            <div className="rank-name-row">
                                                <span className="rank-name">{user.name}</span>
                                                {isCurrentUser && <span className="you-pill">You</span>}
                                            </div>
                                            <div className="rank-bar-bg">
                                                <div
                                                    className="rank-bar-fill"
                                                    style={{ width: `${Math.min(user.percentage, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                        <div className="rank-score">
                                            {Number(user.percentage).toFixed(1)}%
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* Custom Modal Confirmation Dialog for Delete Rank */}
            {showDeleteConfirm && (
                <div className="confirm-modal-overlay" onClick={() => !deleting && setShowDeleteConfirm(false)}>
                    <div className="confirm-modal-card" onClick={e => e.stopPropagation()}>
                        <div className="confirm-modal-icon-wrap">
                            <div className="confirm-modal-danger-badge">🗑️</div>
                        </div>
                        <h3 className="confirm-modal-title">Delete Leaderboard Rank?</h3>
                        <p className="confirm-modal-desc">
                            Are you sure you want to remove your rank? Your attendance percentage ({overallPercentage}%) and name will no longer be visible to others.
                        </p>
                        <p className="confirm-modal-subtext">
                            You can easily rejoin at any time from the dashboard.
                        </p>
                        <div className="confirm-modal-actions">
                            <button
                                type="button"
                                className="btn-modal-cancel"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-modal-delete"
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                            >
                                {deleting ? (
                                    <>
                                        <span className="spinner-sm"></span> Deleting...
                                    </>
                                ) : (
                                    'Yes, Delete Rank'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Leaderboard;
