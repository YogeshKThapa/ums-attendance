import React, { useState, useEffect } from 'react';

const Leaderboard = ({ studentData, overallPercentage, onBack }) => {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');
    const API_BASE = import.meta.env.VITE_API_URL || '';

    const [optedIn, setOptedIn] = useState(false);

    useEffect(() => {
        const rollNo = studentData.roll_no || studentData.RollNo;
        const hasOptedIn = localStorage.getItem(`leaderboard_optin_${rollNo}`) === 'true';
        setOptedIn(hasOptedIn);

        if (hasOptedIn) {
            fetchLeaderboard();
        } else {
            setLoading(false);
        }
    }, [studentData]);

    const fetchLeaderboard = async () => {
        setLoading(true);
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

    const handleJoin = async () => {
        if (!studentData || !overallPercentage) return;
        setJoining(true);
        try {
            const rollNo = studentData.roll_no || studentData.RollNo;
            const res = await fetch(`${API_BASE}/api/leaderboard/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roll_no: rollNo, // Handle case sensitivity
                    name: studentData.student_name || studentData.StudentName,
                    percentage: overallPercentage
                })
            });
            const data = await res.json();
            if (data.success) {
                localStorage.setItem(`leaderboard_optin_${rollNo}`, 'true');
                setOptedIn(true);
                fetchLeaderboard(); // Refresh list
            } else {
                alert("Failed to join: " + data.error);
            }
        } catch (err) {
            alert("Network error");
        } finally {
            setJoining(false);
        }
    };

    return (
        <div className="leaderboard-container fade-in">
            <div className="header-row">
                <button onClick={onBack} className="back-btn">← Back</button>
                <h2>🏆 Leaderboard</h2>
            </div>

            {/* Rankings List */}
            {!optedIn ? (
                <div className="opt-in-view" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>🏆</div>
                    <h3>Join the Leaderboard?</h3>
                    <p style={{ color: '#666', marginBottom: '30px' }}>
                        See how your attendance compares with others! <br />
                        <b>Privacy Note:</b> Your name and attendance % will be visible to other students.
                    </p>
                    <button
                        onClick={handleJoin}
                        disabled={joining}
                        style={{
                            background: '#4caf50',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '25px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            opacity: joining ? 0.7 : 1
                        }}
                    >
                        {joining ? 'Joining...' : 'Yes, Join Leaderboard'}
                    </button>
                    <p style={{ fontSize: '12px', color: '#999', marginTop: '20px' }}>
                        You can opt-out at any time (simulated).
                    </p>
                </div>
            ) : (
                <>
                    {/* Join Card (Now Status Card) */}
                    <div className="join-card">
                        <div className="my-score">
                            <span>My Score:</span>
                            <strong>{overallPercentage}%</strong>
                        </div>
                        <p className="privacy-note" style={{ marginTop: '10px', color: '#666' }}>
                            ✨ You are on the leaderboard. Your rank updates automatically.
                        </p>
                    </div>

                    {loading ? (
                        <div className="loading-spinner">Loading rankings...</div>
                    ) : error ? (
                        <div className="error-msg">{error}</div>
                    ) : (
                        <div className="rank-list">
                            {leaders.map((user, index) => (
                                <div
                                    key={index}
                                    className={`rank-item ${user.roll_no === (studentData.roll_no || studentData.RollNo) ? 'highlight' : ''}`}
                                >
                                    <div className="rank-num">#{index + 1}</div>
                                    <div className="rank-info">
                                        <div className="rank-name">{user.name}</div>
                                        <div className="rank-bar-bg">
                                            <div
                                                className="rank-bar-fill"
                                                style={{ width: `${Math.min(user.percentage, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="rank-score">{user.percentage}%</div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Leaderboard;
