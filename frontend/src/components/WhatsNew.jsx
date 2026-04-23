import React, { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// ADD NEW ENTRIES HERE when shipping a meaningful feature.
// Each entry needs a unique `id` (used for localStorage dismissal key),
// a short `label`, and an optional `date` string.
// The banner shows the LATEST (first) entry only.
// ─────────────────────────────────────────────────────────────────────────────
const FEATURES = [
    {
        id: 'attendance-table-v1',
        label: 'Attendance table view — tap "Show Table" after fetching data to see a full date-by-date breakdown.',
        date: 'Apr 2026',
    },
];

const STORAGE_KEY = (id) => `ums_whats_new_dismissed_${id}`;

const WhatsNew = () => {
    const latest = FEATURES[0];
    const [dismissed, setDismissed] = useState(
        () => localStorage.getItem(STORAGE_KEY(latest.id)) === 'true'
    );

    if (dismissed) return null;

    const handleDismiss = () => {
        localStorage.setItem(STORAGE_KEY(latest.id), 'true');
        setDismissed(true);
    };

    return (
        <div className="whats-new-banner">
            <span className="whats-new-badge">New</span>
            <p className="whats-new-text">{latest.label}</p>
            <button
                className="whats-new-dismiss"
                onClick={handleDismiss}
                aria-label="Dismiss"
            >
                ✕
            </button>
        </div>
    );
};

export default WhatsNew;
