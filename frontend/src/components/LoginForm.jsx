import React, { useState, useEffect } from 'react';
import AttendanceSmartView from './AttendanceSmartView';
import Leaderboard from './Leaderboard';

const LoginForm = () => {
    // App State
    const [view, setView] = useState('profiles'); // 'profiles', 'login', 'dashboard'
    const [profiles, setProfiles] = useState([]);
    const [activeProfile, setActiveProfile] = useState(null); // The profile currently trying to login

    // Login Form State
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [captchaText, setCaptchaText] = useState('');
    const [captchaImage, setCaptchaImage] = useState(null);
    const [sessionId, setSessionId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Dashboard State
    const [studentData, setStudentData] = useState(null);
    const [semesters, setSemesters] = useState([]);
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [attendanceHtml, setAttendanceHtml] = useState('');
    const [attendanceData, setAttendanceData] = useState([]);
    const [tableHeaders, setTableHeaders] = useState([]);
    const [overallData, setOverallData] = useState(null);

    const [sessionYears, setSessionYears] = useState([]);
    const [years, setYears] = useState([]);
    const [selectedSessionYear, setSelectedSessionYear] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [viewMode, setViewMode] = useState('smart');

    // Load Profiles and Cache on Mount
    useEffect(() => {
        const savedProfiles = JSON.parse(localStorage.getItem('ums_profiles') || '[]');
        setProfiles(savedProfiles);

        // Migration: Convert old 'ums_session' to new 'ums_cache' if it exists
        const oldSession = localStorage.getItem('ums_session');
        if (oldSession) {
            try {
                const parsed = JSON.parse(oldSession);
                if (parsed.roll_no) {
                    const cache = JSON.parse(localStorage.getItem('ums_cache') || '{}');
                    cache[parsed.roll_no] = parsed;
                    localStorage.setItem('ums_cache', JSON.stringify(cache));
                    console.log("Migrated old session to ums_cache for", parsed.roll_no);
                }
                localStorage.removeItem('ums_session');
            } catch (e) {
                localStorage.removeItem('ums_session');
            }
        }
    }, []);

    const loadFromCache = (rollNo) => {
        const cache = JSON.parse(localStorage.getItem('ums_cache') || '{}');
        return cache[rollNo];
    };

    const saveToCache = (rollNo, data) => {
        const cache = JSON.parse(localStorage.getItem('ums_cache') || '{}');
        // Merge with existing data to preserve what we have
        cache[rollNo] = { ...(cache[rollNo] || {}), ...data };
        localStorage.setItem('ums_cache', JSON.stringify(cache));
    };

    // Restore state from a cached session object
    const restoreSession = (cachedData) => {
        setSessionId(cachedData.sessionId);
        setStudentData(cachedData.studentData);
        setSessionYears(cachedData.sessionYears || []);
        setYears(cachedData.years || []);
        if (cachedData.semesters) setSemesters(cachedData.semesters);

        // Restore Attendance Data if available
        if (cachedData.attendanceData) {
            setAttendanceData(cachedData.attendanceData);
            setTableHeaders(cachedData.headers || []);
            setOverallData(cachedData.overallData || null);
        }

        // Restore Defaults
        if (cachedData.sessionYears?.length > 0) setSelectedSessionYear(cachedData.sessionYears[0].Value);
        if (cachedData.years?.length > 0) setSelectedYear(cachedData.years[0].Value);

        // Also restore selected semester if saved, else default to first
        if (cachedData.semesters?.length > 0) {
            // Try to restore last used semester, or default to first
            setSelectedSemester(cachedData.semesters[0].Value);
        }
    };

    const handleProfileSelect = (profile) => {
        setActiveProfile(profile);

        // FAST RE-ENTRY LOGIC
        // Check if we have cached data for this user
        const cached = loadFromCache(profile.rollNo);

        if (cached && cached.studentData) {
            console.log("Found cached data for", profile.rollNo);
            // We have data! Load it immediately.
            restoreSession(cached);

            // We still set credentials for potential re-login if needed
            setLoginId(profile.rollNo);
            setPassword(profile.dob);

            // Directly go to dashboard
            setView('dashboard');
            return;
        }

        // Fallback: Normal Login
        setLoginId(profile.rollNo);
        setPassword(profile.dob);
        setCaptchaText('');
        setError('');
        setView('login');
        fetchCaptcha();
    };

    const handleAddProfile = () => {
        setActiveProfile(null);
        setLoginId('');
        setPassword('');
        setCaptchaText('');
        setError('');
        setView('login');
        fetchCaptcha();
    };


    const deleteProfile = (e, index) => {
        e.stopPropagation();
        if (window.confirm("Delete this profile?")) {
            const profileToDelete = profiles[index];
            const updated = profiles.filter((_, i) => i !== index);
            setProfiles(updated);
            localStorage.setItem('ums_profiles', JSON.stringify(updated));

            // Also cleanup cache
            if (profileToDelete) {
                const cache = JSON.parse(localStorage.getItem('ums_cache') || '{}');
                delete cache[profileToDelete.rollNo];
                localStorage.setItem('ums_cache', JSON.stringify(cache));
            }
        }
    };

    // --- Existing Logic (fetchCaptcha, handleSubmit, etc.) ---

    // API Base URL (from environment variable or empty for local proxy)
    const API_BASE = import.meta.env.VITE_API_URL || '';

    const fetchCaptcha = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE}/api/init`);
            if (!res.ok) throw new Error('Failed to load login page');
            const data = await res.json();
            setCaptchaImage(data.captcha_image);
            setSessionId(data.session_id);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    login_id: loginId,
                    password: password,
                    captcha_text: captchaText
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                // SAVE PROFILE LOGIC
                const newProfile = {
                    rollNo: loginId,
                    dob: password,
                    name: data.student_data.student_name,
                    nickname: activeProfile?.nickname || data.student_data.student_name.split(' ')[0] // Default to first name
                };

                // Update or Add Profile
                let updatedProfiles = [...profiles];
                const existingIndex = updatedProfiles.findIndex(p => p.rollNo === loginId);
                if (existingIndex >= 0) {
                    updatedProfiles[existingIndex] = { ...updatedProfiles[existingIndex], ...newProfile, nickname: updatedProfiles[existingIndex].nickname }; // Keep existing nickname if editing
                } else {
                    updatedProfiles.push(newProfile);
                }
                setProfiles(updatedProfiles);
                localStorage.setItem('ums_profiles', JSON.stringify(updatedProfiles));

                // Session Logic
                setSuccess(data.message);
                setStudentData(data.student_data);
                setSessionYears(data.session_years || []);
                setYears(data.years || []);
                if (data.session_years?.length > 0) setSelectedSessionYear(data.session_years[0].Value);
                if (data.years?.length > 0) setSelectedYear(data.years[0].Value);

                // Update Cache
                saveToCache(loginId, {
                    sessionId: sessionId,
                    studentData: data.student_data,
                    sessionYears: data.session_years,
                    years: data.years,
                    roll_no: loginId, // Redundant but safe
                    dob: password
                });

                fetchSemesters(sessionId, loginId); // Pass loginId to save semesters to cache
                setView('dashboard');
            } else {
                setError(data.message || 'Login failed');
                fetchCaptcha();
                setCaptchaText('');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchSemesters = async (sid, rNo) => {
        try {
            const res = await fetch(`${API_BASE}/api/semesters?session_id=${sid}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setSemesters(data);
                // Update Cache with semesters
                saveToCache(rNo, { semesters: data });
            }
        } catch (err) {
            console.error("Failed to fetch semesters", err);
        }
    };

    const handleGetAttendance = async () => {
        if (!selectedSemester) {
            alert("Please select a semester");
            return;
        }
        setLoading(true);

        // Use current loginId or fallback to what's in studentData if we loaded from cache
        const rNo = loginId || studentData?.rollNo;
        const dOb = password; // Warning: if loaded from cache, password might be empty state. 
        // Current flow sets password/loginId in handleProfileSelect even on cache hit, 
        // so this matches.

        console.log("Fetching attendance...");

        try {
            const res = await fetch(`${API_BASE}/api/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId, // This might be expired on server, need to handle that
                    semester_id: selectedSemester,
                    roll_no: rNo,
                    dob: dOb,
                    month_id: selectedMonth,
                    year: selectedYear,
                    session_year: selectedSessionYear
                })
            });

            if (res.status === 400 || res.status === 401) {
                // Session expired or invalid
                const errorData = await res.json();

                // If we are just viewing cached data, maybe we shouldn't force logout immediately?
                // But the user clicked "Go", so they want fresh data.
                // We should guide them to re-login.

                if (window.confirm("Your session has expired. Re-login to refresh data?")) {
                    setView('login');
                    fetchCaptcha();
                    setCaptchaText('');
                }
                setLoading(false);
                return;
            }

            const data = await res.json();
            if (data.attendance_data) {
                setAttendanceData(data.attendance_data);
                setTableHeaders(data.headers || []);

                // Cache this attendance result!
                const updatePayload = {
                    attendanceData: data.attendance_data,
                    headers: data.headers
                };

                if (selectedMonth === '0') {
                    setOverallData(data); // Cache overall data for smart view
                    updatePayload.overallData = data;
                }

                saveToCache(rNo, updatePayload);

                // --- AUTOMATIC LEADERBOARD UPDATE ---
                // Calculate percentage immediately
                const totalHeld = data.attendance_data.reduce((acc, row) => acc + parseInt(row[1] || 0), 0);
                const totalAttended = data.attendance_data.reduce((acc, row) => acc + parseInt(row[2] || 0), 0);
                const percentage = totalHeld > 0 ? ((totalAttended / totalHeld) * 100).toFixed(2) : "0.00";

                // Send to backend silently
                fetch(`${API_BASE}/api/leaderboard/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roll_no: rNo,
                        name: studentData.student_name,
                        percentage: percentage
                    })
                }).catch(err => console.error("Leaderboard update failed", err));
            }
            if (data.html) setAttendanceHtml(data.html);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Trigger overall fetch when semester is selected
    useEffect(() => {
        // Logic to fetch overall stats silently could go here
    }, [sessionId, selectedSemester, selectedSessionYear, selectedYear]);




    // --- RENDER ---
    console.log("Render LoginForm | View:", view, "| StudentData:", studentData ? "Present" : "Missing");

    if (view === 'profiles') {
        return (
            <div className="login-container">
                <h2>Select Profile</h2>
                <div className="profiles-grid" style={{ display: 'grid', gap: '15px', marginTop: '20px' }}>
                    {profiles.map((p, idx) => (
                        <div key={idx} onClick={() => handleProfileSelect(p)} style={{
                            background: '#f8f9fa',
                            padding: '15px',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            border: '1px solid #eee',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{p.nickname}</div>
                                <div style={{ fontSize: '12px', color: '#666' }}>{p.name}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={(e) => deleteProfile(e, idx)} style={{ padding: '5px 10px', fontSize: '12px', background: '#ffebee', color: '#c62828' }}>🗑️</button>
                            </div>
                        </div>
                    ))}

                    <button onClick={handleAddProfile} style={{
                        padding: '15px',
                        background: 'white',
                        border: '2px dashed #ccc',
                        color: '#666',
                        borderRadius: '12px',
                        fontWeight: 'bold'
                    }}>
                        + Add New Profile
                    </button>
                </div>
            </div>
        );
    }

    if (view === 'login') {
        return (
            <div className="login-container">
                <button onClick={() => setView('profiles')} style={{ background: 'none', border: 'none', color: '#666', marginBottom: '10px', cursor: 'pointer' }}>
                    ← Back to Profiles
                </button>
                <h2>{activeProfile ? `Login as ${activeProfile.nickname}` : 'New Login'}</h2>
                {error && <div className="error-message">{error}</div>}

                {loading && !captchaImage ? (
                    <p>Loading...</p>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {!activeProfile && (
                            <>
                                <div className="form-group">
                                    <label>Roll Number</label>
                                    <input type="text" value={loginId} onChange={(e) => setLoginId(e.target.value)} required placeholder="Enter Roll No" />
                                </div>
                                <div className="form-group">
                                    <label>Date of Birth</label>
                                    <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="DD/MM/YYYY" />
                                </div>
                            </>
                        )}

                        <div className="form-group captcha-group">
                            <label>Captcha</label>
                            {captchaImage && <img src={captchaImage} alt="Captcha" className="captcha-img" />}
                            <button type="button" onClick={fetchCaptcha} className="refresh-btn">↻</button>
                            <input type="text" value={captchaText} onChange={(e) => setCaptchaText(e.target.value)} required placeholder="Enter code" autoFocus />
                        </div>

                        <button type="submit" disabled={loading}>
                            {loading ? 'Verifying...' : 'Login'}
                        </button>
                    </form >
                )}
            </div >
        );
    }

    // LEADERBOARD VIEW
    if (view === 'leaderboard') {
        return (
            <Leaderboard
                studentData={studentData}
                overallPercentage={
                    // Calculate overall percentage from attendanceData if available
                    attendanceData.length > 0
                        ? (() => {
                            const totalHeld = attendanceData.reduce((acc, row) => acc + parseInt(row[1] || 0), 0);
                            const totalAttended = attendanceData.reduce((acc, row) => acc + parseInt(row[2] || 0), 0);
                            return totalHeld > 0 ? ((totalAttended / totalHeld) * 100).toFixed(2) : "0.00";
                        })()
                        : "0.00"
                }
                onBack={() => setView('dashboard')}
            />
        );
    }

    // DASHBOARD VIEW
    if (view === 'dashboard' && studentData) {
        return (
            <div className="login-container" style={{ maxWidth: '800px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>Hi, {studentData.student_name.split(' ')[0]} 👋</h2>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setView('leaderboard')} style={{ background: '#FFD700', color: '#000', padding: '8px 12px', fontSize: '14px', border: 'none', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>
                            🏆 Rank
                        </button>
                        <button onClick={() => {
                            // Logout Logic: Go back to profiles, clear current view state, but DO NOT delete cache unless requested
                            // Actually, standard logout just exits the view.
                            setView('profiles');
                            setStudentData(null);
                        }} style={{ background: '#f5f5f5', color: '#333', padding: '8px 12px', fontSize: '14px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                            Back
                        </button>
                    </div>
                </div>

                <div className="dashboard-controls">
                    <select value={selectedSessionYear} onChange={(e) => setSelectedSessionYear(e.target.value)}>
                        <option value="">-- Session --</option>
                        {sessionYears.map(opt => <option key={opt.Value} value={opt.Value}>{opt.Text}</option>)}
                    </select>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                        <option value="">-- Year --</option>
                        {years.map(opt => <option key={opt.Value} value={opt.Value}>{opt.Text}</option>)}
                    </select>
                    <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}>
                        <option value="">-- Semester --</option>
                        {semesters.map(sem => <option key={sem.Value} value={sem.Value}>{sem.Text}</option>)}
                    </select>
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                        <option value="0">Overall Semester</option>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                        ))}
                    </select>
                    <button onClick={handleGetAttendance} disabled={loading} className="go-btn">
                        {loading ? '...' : 'Go'}
                    </button>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#666' }}>
                        <div className="spinner"></div>
                        <span style={{ marginTop: '10px', fontWeight: '500' }}>Fetching Attendance...</span>
                    </div>
                ) : studentData && attendanceData.length > 0 ? (
                    <>
                        <div className="view-toggle" style={{ marginBottom: '15px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setViewMode(viewMode === 'smart' ? 'table' : 'smart')} style={{ background: 'none', border: '1px solid #ccc', padding: '5px 10px', borderRadius: '4px' }}>
                                {viewMode === 'smart' ? 'Show Table' : 'Show Smart View'}
                            </button>
                        </div>
                        <div className="attendance-wrapper">
                            {viewMode === 'smart' ? (
                                <AttendanceSmartView
                                    data={attendanceData}
                                    headers={tableHeaders}
                                    overallData={overallData}
                                    isMonthly={selectedMonth !== '0'}
                                />
                            ) : (
                                <table className="attendance-table">
                                    <thead><tr>{tableHeaders.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {attendanceData.map((row, i) => (
                                            <tr key={i}>
                                                {row.map((cell, j) => {
                                                    // Column 0 is Subject Name
                                                    if (j === 0) {
                                                        const abbr = cell.length > 20 ? cell.replace(/[^A-Z]/g, '') : cell;
                                                        // Use acronym if len > 20, else keep. (e.g. "Software Engineering" -> "SE")
                                                        // Better fallback: First letter of each word
                                                        const smartAbbr = cell.length > 15
                                                            ? cell.split(' ')
                                                                .filter(w => w.length > 0 && !['and', 'of', 'the', 'in', 'to'].includes(w.toLowerCase()))
                                                                .map(w => w[0].toUpperCase())
                                                                .join('')
                                                            : cell;

                                                        return <td key={j} title={cell}>{smartAbbr.length < 2 ? cell.substring(0, 15) + '...' : smartAbbr}</td>;
                                                    }
                                                    return <td key={j}>{cell}</td>;
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>Select filters and click Go</div>
                )}
            </div>
        );
    }

    return null;
};

export default LoginForm;
