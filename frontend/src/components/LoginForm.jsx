import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import AttendanceSmartView from './AttendanceSmartView';
import AttendanceTable from './AttendanceTable';
import Leaderboard from './Leaderboard';
import WhatsNew from './WhatsNew';
import DatePicker from './DatePicker';
import { parseAttendanceData } from '../utils/attendanceParser';

const LoginForm = () => {
    // App State
    const [view, setView] = useState('profiles'); // 'profiles', 'login', 'dashboard'
    const [profiles, setProfiles] = useState([]);
    const [activeProfile, setActiveProfile] = useState(null); // The profile currently trying to login

    const rollNoInputRef = useRef(null);
    const captchaInputRef = useRef(null);

    // Login Form State
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [captchaText, setCaptchaText] = useState('');
    const [captchaImage, setCaptchaImage] = useState(null);
    const [sessionId, setSessionId] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Auto-focus logic when login view is active and loading is finished (inputs are rendered in DOM)
    useEffect(() => {
        if (view === 'login' && !loading && captchaImage) {
            const timer = setTimeout(() => {
                if (activeProfile) {
                    if (captchaInputRef.current) {
                        captchaInputRef.current.focus();
                    }
                } else {
                    if (rollNoInputRef.current) {
                        rollNoInputRef.current.focus();
                    }
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [view, activeProfile, loading, captchaImage]);


    // Dashboard State
    const [studentData, setStudentData] = useState(null);
    const [semesters, setSemesters] = useState([]);
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [attendanceHtml, setAttendanceHtml] = useState('');
    const [attendanceData, setAttendanceData] = useState([]);
    const [tableHeaders, setTableHeaders] = useState([]);
    const [overallData, setOverallData] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null); // New State for timestamp

    const [sessionYears, setSessionYears] = useState([]);
    const [years, setYears] = useState([]);
    const [selectedSessionYear, setSelectedSessionYear] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [viewMode, setViewMode] = useState('smart');
    const [showTableModal, setShowTableModal] = useState(false);

    // Lock body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = showTableModal ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [showTableModal]);

    // Load Profiles and Cache on Mount
    useEffect(() => {
        const savedProfiles = JSON.parse(localStorage.getItem('ums_profiles') || '[]');
        setProfiles(savedProfiles);

        // MIGRATION: Convert old 'ums_cache' (monolithic) to new 'ums_data_ROLLNO' (split)
        const oldCacheBlob = localStorage.getItem('ums_cache');
        if (oldCacheBlob) {
            try {
                const parsed = JSON.parse(oldCacheBlob);
                Object.keys(parsed).forEach(rollNo => {
                    // Save individual items if they don't exist
                    if (!localStorage.getItem(`ums_data_${rollNo}`)) {
                        localStorage.setItem(`ums_data_${rollNo}`, JSON.stringify({
                            ...parsed[rollNo],
                            timestamp: Date.now() // Estimate timestamp for migrated data
                        }));
                    }
                });
                console.log("Migrated ums_cache to split keys.");
                localStorage.removeItem('ums_cache');
            } catch (e) {
                console.error("Migration failed", e);
            }
        }

        // MIGRATION: Old session cleanup
        localStorage.removeItem('ums_session');
    }, []);

    const loadFromCache = (rollNo) => {
        try {
            return JSON.parse(localStorage.getItem(`ums_data_${rollNo}`));
        } catch (e) {
            return null;
        }
    };

    const saveToCache = (rollNo, data) => {
        const currentData = loadFromCache(rollNo) || {};
        const newData = {
            ...currentData,
            ...data,
            timestamp: Date.now()
        };
        localStorage.setItem(`ums_data_${rollNo}`, JSON.stringify(newData));
    };

    // Restore state from a cached session object
    const restoreSession = (cachedData) => {
        // Basic Data
        setStudentData(cachedData.studentData);
        setSessionYears(cachedData.sessionYears || []);
        setYears(cachedData.years || []);
        if (cachedData.semesters) setSemesters(cachedData.semesters);
        if (cachedData.timestamp) setLastUpdated(cachedData.timestamp);

        // Session ID Handling with Staleness Check
        // If data is older than 60 mins (3600000 ms), don't trust the session ID
        const isStale = (Date.now() - (cachedData.timestamp || 0)) > 3600000;
        if (!isStale) {
            setSessionId(cachedData.sessionId);
        } else {
            setSessionId(''); // Force new session generation on next action
            console.log("Cached session ID expired/stale. Cleared.");
        }

        // Restore Attendance Data if available
        if (cachedData.attendanceData) {
            setAttendanceData(cachedData.attendanceData);
            setTableHeaders(cachedData.headers || []);
            if (cachedData.overallData?.attendance_data) {
                setOverallData(cachedData.overallData);
            } else {
                setOverallData(null);
            }
            if (cachedData.selectedMonth !== undefined) {
                setSelectedMonth(String(cachedData.selectedMonth));
            }
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
                localStorage.removeItem(`ums_data_${profileToDelete.rollNo}`);
                localStorage.removeItem(`leaderboard_optin_${profileToDelete.rollNo}`);
            }
        }
    };

    // --- Existing Logic (fetchCaptcha, handleSubmit, etc.) ---

    // API Base URL (from environment variable or empty for local proxy)
    const API_BASE = import.meta.env.VITE_API_URL || '';

    const fetchCaptcha = async (clearError = true) => {
        setLoading(true);
        if (clearError) setError('');
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
                await fetchCaptcha(false);
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

                // Auto-select the semester with Value '73' (requested hardcoded default), else last one
                if (data.length > 0) {
                    const defaultSem = data.find(s => s.Value == '73');
                    if (defaultSem) {
                        setSelectedSemester('73');
                    } else {
                        setSelectedSemester(data[data.length - 1].Value);
                    }
                }
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

                const isOverallFetch = String(selectedMonth) === '0';

                // Cache this attendance result!
                const updatePayload = {
                    attendanceData: data.attendance_data,
                    headers: data.headers,
                    selectedMonth: selectedMonth
                };

                if (isOverallFetch) {
                    const parsed = parseAttendanceData(data.attendance_data, data.headers || []);
                    const percentage = parsed.overall ? String(parsed.overall.percent) : "0.00";

                    const verifiedOverallData = {
                        ...data,
                        type: 'overall_semester',
                        calculatedPercentage: percentage
                    };

                    setOverallData(verifiedOverallData); // Cache overall data for smart view and leaderboard
                    updatePayload.overallData = verifiedOverallData;

                    // --- AUTOMATIC LEADERBOARD UPDATE ---
                    // ONLY update if we are fetching overall semester data AND user has opted in
                    if (localStorage.getItem(`leaderboard_optin_${rNo}`) === 'true') {
                        fetch(`${API_BASE}/api/leaderboard/join`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                roll_no: rNo,
                                name: studentData.student_name,
                                percentage: percentage,
                                type: 'overall'
                            })
                        }).catch(err => console.error("Leaderboard update failed", err));
                    }
                }

                saveToCache(rNo, updatePayload);
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
                <WhatsNew />
                <div className="profiles-grid">
                    {profiles.map((p, idx) => (
                        <div key={idx} onClick={() => handleProfileSelect(p)} className="profile-card">
                            <div>
                                <div className="profile-nickname">{p.nickname}</div>
                                <div className="profile-name">{p.name}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={(e) => deleteProfile(e, idx)} className="delete-btn">🗑️</button>
                            </div>
                        </div>
                    ))}

                    <button onClick={handleAddProfile} className="add-profile-btn">
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
                {activeProfile && (
                    <div style={{ marginBottom: '14px', fontSize: '13px', color: '#666', textAlign: 'center' }}>
                        Roll No: <strong>{loginId}</strong> &bull; DOB: <strong>{password}</strong>
                    </div>
                )}
                {error && <div className="error-message">{error}</div>}

                {loading && !captchaImage ? (
                    <p>Loading...</p>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {!activeProfile && (
                            <>
                                <div className="form-group">
                                    <label>Roll Number</label>
                                    <input ref={rollNoInputRef} type="text" value={loginId} onChange={(e) => setLoginId(e.target.value)} required placeholder="Enter Roll No" />
                                </div>
                                <div className="form-group">
                                    <label>Date of Birth</label>
                                    <DatePicker value={password} onChange={setPassword} required />
                                </div>
                            </>
                        )}

                        <div className="form-group captcha-group">
                            <label>Captcha</label>
                            <div className="captcha-control-row">
                                {captchaImage && <img src={captchaImage} alt="Captcha" className="captcha-img" />}
                                <button 
                                    type="button" 
                                    onClick={() => fetchCaptcha(false)} 
                                    className="refresh-captcha-btn"
                                    title="Refresh Captcha"
                                    aria-label="Refresh Captcha"
                                >
                                    ↻
                                </button>
                            </div>
                            <input 
                                ref={captchaInputRef} 
                                type="text" 
                                value={captchaText} 
                                onChange={(e) => setCaptchaText(e.target.value.toUpperCase())} 
                                required 
                                placeholder="Enter code" 
                                autoCapitalize="characters"
                                autoCorrect="off"
                                spellCheck="false"
                                className="captcha-input"
                            />
                        </div>

                        <button type="submit" disabled={loading}>
                            {loading ? 'Verifying...' : 'Login'}
                        </button>
                    </form >
                )}
                {/* ... existing form ... */}

            </div >
        );
    }

    // LEADERBOARD VIEW
    if (view === 'leaderboard') {
        const calculateOverallPercentage = () => {
            // Strictly require overallData to be present and contain attendance records
            if (!overallData?.attendance_data || overallData.attendance_data.length === 0) {
                return null;
            }
            if (overallData.calculatedPercentage !== undefined) {
                return overallData.calculatedPercentage;
            }
            const stats = parseAttendanceData(overallData.attendance_data, overallData.headers || []).overall;
            return stats ? String(stats.percent) : null;
        };

        return (
            <Leaderboard
                studentData={{ ...studentData, roll_no: loginId || activeProfile?.rollNo || studentData?.roll_no || studentData?.RollNo }}
                overallPercentage={calculateOverallPercentage()}
                onBack={() => setView('dashboard')}
            />
        );
    }

    // DASHBOARD VIEW
    if (view === 'dashboard' && studentData) {
        return (
            <div className="login-container" style={{ maxWidth: '800px' }}>
                <div className="dashboard-header">
                    <div className="dashboard-user-info">
                        <h2 className="dashboard-greeting">Hi, {studentData.student_name.split(' ')[0]} 👋</h2>
                        {lastUpdated && (
                            <div className="dashboard-last-updated">
                                Data from: {new Date(lastUpdated).toLocaleTimeString()} ({Math.floor((Date.now() - lastUpdated) / 60000)}m ago)
                            </div>
                        )}
                    </div>
                    <div className="dashboard-header-actions">
                        <button 
                            onClick={() => setView('leaderboard')} 
                            className="dashboard-rank-btn"
                            title="View Student Leaderboard"
                        >
                            🏆 Leaderboard
                        </button>
                        <button 
                            onClick={() => {
                                setView('profiles');
                                setStudentData(null);
                            }} 
                            className="dashboard-nav-btn"
                        >
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
                            <button onClick={() => setShowTableModal(true)} style={{ background: 'none', border: '1px solid #ccc', padding: '5px 10px', borderRadius: '4px' }}>
                                📋 Show Table
                            </button>
                        </div>
                        <div className="attendance-wrapper">
                            <AttendanceSmartView
                                data={attendanceData}
                                headers={tableHeaders}
                                overallData={overallData}
                                isMonthly={selectedMonth !== '0'}
                            />
                        </div>

                        {/* ── Table Modal (Portal → mounts on document.body) ── */}
                        {showTableModal && ReactDOM.createPortal(
                            <div className="table-modal-overlay" onClick={() => setShowTableModal(false)}>
                                <div className="table-modal-content" onClick={e => e.stopPropagation()}>
                                    <div className="table-modal-header">
                                        <span className="table-modal-title">📋 Attendance Table</span>
                                        <button className="table-modal-close" onClick={() => setShowTableModal(false)}>✕</button>
                                    </div>
                                    <div className="table-modal-body">
                                        <AttendanceTable data={attendanceData} headers={tableHeaders} />
                                    </div>
                                </div>
                            </div>,
                            document.body
                        )}
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
