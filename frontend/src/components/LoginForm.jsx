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

    // Load Profiles on Mount
    useEffect(() => {
        const savedProfiles = JSON.parse(localStorage.getItem('ums_profiles') || '[]');
        setProfiles(savedProfiles);

        // Check for active session
        const storedSession = localStorage.getItem('ums_session');
        if (storedSession) {
            try {
                const parsed = JSON.parse(storedSession);
                // Check if session has the new dropdown data. If not, force re-login.
                if (parsed.studentData && parsed.sessionYears && parsed.sessionYears.length > 0) {
                    restoreSession(parsed);
                    setView('dashboard');
                } else {
                    // Stale session, clear it
                    console.log("Stale session detected, clearing...");
                    localStorage.removeItem('ums_session');
                }
            } catch (e) {
                localStorage.removeItem('ums_session');
            }
        }
    }, []);

    const restoreSession = (parsed) => {
        setSessionId(parsed.sessionId);
        setStudentData(parsed.studentData);
        setSessionYears(parsed.sessionYears || []);
        setYears(parsed.years || []);
        if (parsed.semesters) setSemesters(parsed.semesters);

        // Restore defaults
        if (parsed.sessionYears?.length > 0) setSelectedSessionYear(parsed.sessionYears[0].Value);
        if (parsed.years?.length > 0) setSelectedYear(parsed.years[0].Value);
    };

    const handleProfileSelect = (profile) => {
        setActiveProfile(profile);
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
            const updated = profiles.filter((_, i) => i !== index);
            setProfiles(updated);
            localStorage.setItem('ums_profiles', JSON.stringify(updated));
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

                localStorage.setItem('ums_session', JSON.stringify({
                    sessionId: sessionId,
                    studentData: data.student_data,
                    sessionYears: data.session_years,
                    years: data.years,
                    roll_no: loginId,
                    dob: password
                }));

                fetchSemesters(sessionId);
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

    const fetchSemesters = async (sid) => {
        try {
            const res = await fetch(`${API_BASE}/api/semesters?session_id=${sid}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setSemesters(data);
                const stored = JSON.parse(localStorage.getItem('ums_session') || '{}');
                localStorage.setItem('ums_session', JSON.stringify({ ...stored, semesters: data }));
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
        const stored = JSON.parse(localStorage.getItem('ums_session') || '{}');
        const rNo = loginId || stored.roll_no;
        const dOb = password || stored.dob;

        console.log("Fetching attendance from:", `${API_BASE}/api/attendance`);
        console.log("Session ID:", sessionId);

        try {
            const res = await fetch(`${API_BASE}/api/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    semester_id: selectedSemester,
                    roll_no: rNo,
                    dob: dOb,
                    month_id: selectedMonth,
                    year: selectedYear,
                    session_year: selectedSessionYear
                })
            });
            const data = await res.json();
            if (data.attendance_data) {
                setAttendanceData(data.attendance_data);
                setTableHeaders(data.headers || []);
            }
            if (data.attendance_data && selectedMonth === '0') {
                setOverallData(data); // Cache overall data for smart view
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
        if (sessionId && selectedSemester && selectedSessionYear && selectedYear) {
            // Logic to fetch overall stats silently could go here
        }
    }, [sessionId, selectedSemester, selectedSessionYear, selectedYear]);




    // --- RENDER ---

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
        {
            !activeProfile && (
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
            )
        }

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
                        localStorage.removeItem('ums_session');
                        setView('profiles');
                        setStudentData(null);
                    }} style={{ background: '#f5f5f5', color: '#333', padding: '8px 12px', fontSize: '14px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                        Logout
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
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                    <div className="spinner" style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #007bff',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 20px'
                    }}></div>
                    Fetching Attendance...
                    <style>{`@keyframes spin { 0 % { transform: rotate(0deg); } 100 % { transform: rotate(360deg); } } `}</style>
                </div>
            ) : studentData && attendanceData.length > 0 ? (
                <div className="attendance-wrapper">
                    <div className="view-toggle" style={{ marginBottom: '15px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => setViewMode(viewMode === 'smart' ? 'table' : 'smart')} style={{ background: 'none', border: '1px solid #ccc', padding: '5px 10px', borderRadius: '4px' }}>
                            {viewMode === 'smart' ? 'Show Table' : 'Show Smart View'}
                        </button>
                    </div>
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
                            <tbody>{attendanceData.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
                        </table>
                    )}
                </div>
            ) : (
                <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>Select filters and click Go</div>
            )}
        </div>
    );
}

return null;
};

export default LoginForm;
