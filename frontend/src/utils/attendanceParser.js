export const parseAttendanceData = (data, headers) => {
    if (!data || !Array.isArray(data) || data.length === 0) return { subjects: [], overall: null };

    const subjects = [];
    let totalHeld = 0;
    let totalAttended = 0;

    // Find indices for key columns
    // "Held" should not be "Total Present"
    const heldIndex = headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower.includes('held') || (lower.includes('total') && !lower.includes('present') && !lower.includes('attended'));
    });

    const attendedIndex = headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower.includes('attended') || lower.includes('present');
    });

    const percentIndex = headers.findIndex(h => h.includes('%') || h.toLowerCase().includes('percentage'));

    console.log("Parser Debug:", { headers, heldIndex, attendedIndex, percentIndex });

    // If we can't find held/attended, we can't do much. Fallback to standard positions if desperate.
    // Standard UMS usually has: Subject, ..., Held, Attended, %
    let idxHeld = heldIndex !== -1 ? heldIndex : (headers.length >= 3 ? headers.length - 3 : -1);
    let idxAttended = attendedIndex !== -1 ? attendedIndex : (headers.length >= 2 ? headers.length - 2 : -1);

    // SAFETY CHECK: If they point to the same column, force standard positions
    if (idxHeld === idxAttended) {
        console.warn("Parser: Held and Attended point to same column. Reverting to standard offsets.");
        idxHeld = headers.length - 3;
        idxAttended = headers.length - 2;
    }

    // For percent, if we didn't find a column, we will calculate it.
    // Don't default to the last column blindly as it might be something else.
    const idxPercent = percentIndex;

    data.forEach((row, i) => {
        // Skip if row is empty or doesn't have enough columns
        if (!row || row.length < 2) return;

        const subjectName = row[0];

        // Skip "Total" and "General Proficiency" (GP)
        if (subjectName.toLowerCase() === 'total' || subjectName.toLowerCase().includes('general proficiency') || subjectName.toUpperCase().includes('GP')) return;

        let held = 0;
        let attended = 0;
        let percent = 0;

        if (idxHeld !== -1 && idxAttended !== -1) {
            held = parseInt(row[idxHeld]) || 0;
            attended = parseInt(row[idxAttended]) || 0;
        }

        // STRICT CALCULATION:
        // The user is right. We should trust the numbers we found (Held/Attended) 
        // more than the % column, which is often empty or wrong in monthly views.
        if (held > 0) {
            percent = parseFloat(((attended / held) * 100).toFixed(2));
        } else {
            // If held is 0, percent is 0 (avoid division by zero)
            percent = 0;
        }

        console.log(`Row ${i}:`, { subjectName, held, attended, calculatedPercent: percent });

        // Per-subject status (just for color coding, no advice)
        let status = percent >= 75 ? 'safe' : 'danger';

        subjects.push({
            name: subjectName,
            held,
            attended,
            percent,
            status
        });

        totalHeld += held;
        totalAttended += attended;
    });

    const overallPercent = totalHeld > 0 ? ((totalAttended / totalHeld) * 100).toFixed(2) : 0;

    // Global Advice Calculation
    let overallMessage = '';
    if (overallPercent < 75) {
        const needed = Math.ceil((0.75 * totalHeld - totalAttended) / 0.25);
        overallMessage = `Attend next ${needed} classes to reach 75%`;
    } else {
        const bunkable = Math.floor((totalAttended - 0.75 * totalHeld) / 0.75);
        if (bunkable > 0) {
            overallMessage = `Safe to bunk ${bunkable} classes`;
        } else {
            overallMessage = `Don't miss the next class!`;
        }
    }

    return {
        subjects,
        overall: {
            held: totalHeld,
            attended: totalAttended,
            percent: overallPercent,
            status: overallPercent >= 75 ? 'safe' : 'danger',
            message: overallMessage
        }
    };
};
