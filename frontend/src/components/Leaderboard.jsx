import React, { useState, useEffect } from 'react';

const Leaderboard = ({ studentData, overallPercentage, onBack }) => {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');
    const API_BASE = import.meta.env.VITE_API_URL || '';

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/leaderboard`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setLeaders(data);
            }
        } catch (err) {
            console.error("Failed to fetch leaderboard", err);
            setError("Failed to load rankings.");
        } finally {
            setLoading(false);
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
                    roll_no: studentData.roll_no || studentData.RollNo, // Handle case sensitivity
                    name: studentData.student_name || studentData.StudentName,
                    percentage: overallPercentage
                })
            });
            const data = await res.json();
            if (data.success) {
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

            {/* Join Card */}
            <div className="join-card">
                <div className="my-score">
                    <span>My Score:</span>
                    <strong>{overallPercentage}%</strong>
                </div>
                <p className="privacy-note" style={{ marginTop: '10px', color: '#666' }}>
                    ✨ Your rank updates automatically when you check attendance.
                </p>
            </div>

            {/* Rankings List */}
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
        </div>
    );
};

export default Leaderboard;
