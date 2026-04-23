import React from 'react';
import { parseAttendanceData } from '../utils/attendanceParser';

const AttendanceSmartView = ({ data, headers, overallData, isMonthly }) => {
    const { subjects, overall } = parseAttendanceData(data, headers);

    // Parse the overall/semester data if available to get the true global message
    const globalStats = overallData ? parseAttendanceData(overallData.attendance_data, overallData.headers).overall : null;

    // If monthly, use a simple status. If overall, use global stats (or fallback to current)
    let displayMessage = '';
    let displayStatus = 'safe';

    if (isMonthly) {
        displayStatus = overall.percent >= 75 ? 'safe' : 'danger';
        displayMessage = overall.percent >= 75 ? 'Good Attendance 👍' : 'Low Attendance ⚠️';
    } else {
        displayMessage = globalStats ? globalStats.message : overall.message;
        displayStatus = globalStats ? globalStats.status : overall.status;
    }

    if (!overall) return <div className="no-data">No attendance data available</div>;

    const getColor = (p) => p >= 75 ? '#4caf50' : '#f44336';
    const getBgColor = (p) => p >= 75 ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)';

    return (
        <div className="smart-view">
            {/* Global Advice Alert (Always visible if we have overall data) */}
            {displayMessage && (
                <div style={{
                    marginBottom: '20px',
                    padding: '15px',
                    background: displayStatus === 'safe' ? '#e8f5e9' : '#ffebee',
                    border: `1px solid ${displayStatus === 'safe' ? '#4caf50' : '#ef5350'}`,
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    color: displayStatus === 'safe' ? '#2e7d32' : '#c62828',
                    textAlign: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', marginBottom: '5px', opacity: 0.8 }}>
                        {isMonthly ? 'Monthly Status' : 'Semester Status'}
                    </div>
                    {displayMessage}
                </div>
            )}

            {/* Current View Summary Card */}
            <div className="summary-card" style={{
                background: getBgColor(overall.percent),
                border: `1px solid ${getColor(overall.percent)}`,
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'center',
                marginBottom: '20px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <h3 style={{ margin: 0, color: '#666' }}>Attendance Summary</h3>
                <div style={{
                    fontSize: '48px',
                    fontWeight: 'bold',
                    color: getColor(overall.percent),
                    margin: '10px 0'
                }}>
                    {overall.percent}%
                </div>
                <div style={{ fontSize: '14px', color: '#888' }}>
                    {overall.attended} / {overall.held} Classes
                </div>
            </div>

            {/* Subject List */}
            <div className="subject-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {subjects.map((sub, idx) => (
                    <div key={idx} className="subject-card" style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '15px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        borderLeft: `5px solid ${getColor(sub.percent)}`
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <div style={{ fontWeight: '600', fontSize: '16px', color: '#333' }}>
                                {sub.name.split('[')[0]} {/* Remove code like [CST01] */}
                            </div>
                            <div style={{ fontWeight: 'bold', color: getColor(sub.percent) }}>
                                {sub.percent}%
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div style={{
                            height: '6px',
                            background: '#eee',
                            borderRadius: '3px',
                            overflow: 'hidden',
                            marginBottom: '8px'
                        }}>
                            <div style={{
                                width: `${sub.percent}%`,
                                height: '100%',
                                background: getColor(sub.percent)
                            }} />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
                            <span>{sub.attended}/{sub.held}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AttendanceSmartView;
