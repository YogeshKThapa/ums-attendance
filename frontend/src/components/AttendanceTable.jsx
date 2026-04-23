import React from 'react';
import '../styles/AttendanceTable.css';

const AttendanceTable = ({ data, headers }) => {
    if (!data || data.length === 0) return <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No attendance data available for the table view.</div>;

    return (
        <table className="ums-attendance-table">
                <thead>
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className={i === 0 ? 'sticky-col' : ''}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row, i) => {
                        let displayRow = [...row];
                        // If row has fewer columns than headers (like in overall view), pad the middle with empty cells
                        if (displayRow.length < headers.length && displayRow.length >= 4) {
                            // Extract the last 3 elements (Held, Attended, %)
                            const stats = displayRow.splice(displayRow.length - 3, 3); 
                            const paddingNeeded = headers.length - displayRow.length - stats.length;
                            for (let k = 0; k < paddingNeeded; k++) {
                                displayRow.push('');
                            }
                            displayRow = displayRow.concat(stats);
                        }

                        return (
                            <tr key={i}>
                                {displayRow.map((cell, j) => {
                                    // Subject column
                                    if (j === 0) return <td key={j} className="sticky-col subject-cell" title={cell}>{cell}</td>;
                                    
                                    // Last 3 columns (Held, Attended, %)
                                    if (j >= displayRow.length - 3) return <td key={j} className="stats-cell">{cell}</td>;

                                    // Empty padding cells
                                    if (cell === '') return <td key={j} className="date-cell"></td>;

                                    // Date columns (Present/Absent)
                                    let cellClass = 'date-cell';
                                    if (cell === 'P' || cell === 'Present' || cell === '1') cellClass += ' present';
                                    if (cell === 'A' || cell === 'Absent' || cell === '0') cellClass += ' absent';
                                    
                                    return <td key={j} className={cellClass}>{cell}</td>;
                                })}
                            </tr>
                        );
                    })}
                </tbody>
        </table>
    );
};

export default AttendanceTable;
