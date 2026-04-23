import React from 'react';
import '../styles/AttendanceTable.css'; // We'll create this next

const AttendanceTable = ({ data, headers }) => {
    if (!data || data.length === 0) return <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No attendance data available for the table view.</div>;

    return (
        <div className="table-container">
            <table className="ums-attendance-table">
                <thead>
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className={i === 0 ? 'sticky-col' : ''}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => (
                        <tr key={i}>
                            {row.map((cell, j) => {
                                // Subject column
                                if (j === 0) return <td key={j} className="sticky-col subject-cell" title={cell}>{cell}</td>;
                                
                                // Last 3 columns (Held, Attended, %)
                                if (j >= row.length - 3) return <td key={j} className="stats-cell">{cell}</td>;

                                // Date columns (Present/Absent)
                                let cellClass = 'date-cell';
                                if (cell === 'P' || cell === 'Present' || cell === '1') cellClass += ' present';
                                if (cell === 'A' || cell === 'Absent' || cell === '0') cellClass += ' absent';
                                
                                return <td key={j} className={cellClass}>{cell}</td>;
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AttendanceTable;
