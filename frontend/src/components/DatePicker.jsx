import React, { useState, useEffect, useRef } from 'react';

const DatePicker = ({ value, onChange, placeholder = 'DD/MM/YYYY', required = false }) => {
    const [showCalendar, setShowCalendar] = useState(false);
    const containerRef = useRef(null);

    // Initialize calendar view to the selected date, or today
    const [viewDate, setViewDate] = useState(() => {
        if (value) {
            const parts = value.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    return new Date(year, month, day);
                }
            }
        }
        return new Date();
    });

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();

    // Close calendar on outside click
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowCalendar(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, []);

    // Sync viewDate if value changes externally (e.g. profile select)
    useEffect(() => {
        if (value) {
            const parts = value.split('/');
            if (parts.length === 3) {
                const d = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const y = parseInt(parts[2], 10);
                if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
                    setViewDate(new Date(y, m, d));
                }
            }
        }
    }, [value]);

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Generate year range (1960 to current year + 5)
    const startYear = 1960;
    const endYear = new Date().getFullYear() + 2;
    const years = [];
    for (let y = endYear; y >= startYear; y--) {
        years.push(y);
    }

    // Days in current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // First day of current month (0: Sunday, ..., 6: Saturday)
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

    const handleMonthChange = (e) => {
        const m = parseInt(e.target.value, 10);
        setViewDate(new Date(currentYear, m, 1));
    };

    const handleYearChange = (e) => {
        const y = parseInt(e.target.value, 10);
        setViewDate(new Date(y, currentMonth, 1));
    };

    const handlePrevMonth = () => {
        setViewDate(new Date(currentYear, currentMonth - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(currentYear, currentMonth + 1, 1));
    };

    const handleSelectDay = (day) => {
        const paddedDay = String(day).padStart(2, '0');
        const paddedMonth = String(currentMonth + 1).padStart(2, '0');
        const formattedDate = `${paddedDay}/${paddedMonth}/${currentYear}`;
        onChange(formattedDate);
        setShowCalendar(false);
    };

    // Check if a day is the selected day
    const isSelected = (day) => {
        if (!value) return false;
        const parts = value.split('/');
        if (parts.length === 3) {
            return parseInt(parts[0], 10) === day &&
                   parseInt(parts[1], 10) === (currentMonth + 1) &&
                   parseInt(parts[2], 10) === currentYear;
        }
        return false;
    };

    // Render calendar days grid
    const renderDays = () => {
        const cells = [];
        
        // Blank cells for days of the week preceding the 1st of the month
        for (let i = 0; i < firstDayIndex; i++) {
            cells.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const selected = isSelected(day);
            cells.push(
                <button
                    key={`day-${day}`}
                    type="button"
                    className={`calendar-day day ${selected ? 'selected' : ''}`}
                    onClick={() => handleSelectDay(day)}
                >
                    {day}
                </button>
            );
        }

        return cells;
    };

    const handleInputChange = (e) => {
        let val = e.target.value;
        
        // Allow backspace by checking if value length decreases
        if (val.length < value.length) {
            onChange(val);
            return;
        }

        // Keep only digits
        const clean = val.replace(/\D/g, '');
        let formatted = '';
        
        if (clean.length > 0) {
            formatted += clean.substring(0, 2);
        }
        if (clean.length > 2) {
            formatted += '/' + clean.substring(2, 4);
        }
        if (clean.length > 4) {
            formatted += '/' + clean.substring(4, 8);
        }
        
        onChange(formatted);
    };

    return (
        <div className="datepicker-container" ref={containerRef}>
            <div className="datepicker-input-wrapper">
                <input
                    type="text"
                    value={value}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    required={required}
                    onClick={() => setShowCalendar(true)}
                    className="datepicker-input"
                    maxLength={10}
                />
                <button
                    type="button"
                    className="datepicker-icon-btn"
                    onClick={() => setShowCalendar(!showCalendar)}
                    aria-label="Select Date"
                >
                    📅
                </button>
            </div>

            {showCalendar && (
                <div className="m3-datepicker-card">
                    <div className="m3-datepicker-header">
                        <button type="button" onClick={handlePrevMonth} className="m3-nav-btn">◀</button>
                        <div className="m3-selectors">
                            <select value={currentMonth} onChange={handleMonthChange} className="m3-datepicker-select">
                                {months.map((m, i) => (
                                    <option key={m} value={i}>{m}</option>
                                ))}
                            </select>
                            <select value={currentYear} onChange={handleYearChange} className="m3-datepicker-select">
                                {years.map((y) => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                        <button type="button" onClick={handleNextMonth} className="m3-nav-btn">▶</button>
                    </div>

                    <div className="m3-datepicker-weekdays">
                        <div>Su</div>
                        <div>Mo</div>
                        <div>Tu</div>
                        <div>We</div>
                        <div>Th</div>
                        <div>Fr</div>
                        <div>Sa</div>
                    </div>

                    <div className="m3-datepicker-grid">
                        {renderDays()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DatePicker;
