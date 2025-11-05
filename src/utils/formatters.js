export function capitalizeFirst(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function formatRoDateTime(d) {
    const datePart = new Intl.DateTimeFormat('ro-RO', {
        day: '2-digit',
        month: 'long',
    }).format(d);

    const weekday = new Intl.DateTimeFormat('ro-RO', {
        weekday: 'long',
    }).format(d);

    const timePart = new Intl.DateTimeFormat('ro-RO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(d);

    const [day, month] = datePart.split(' ');
    const monthCap = month ? capitalizeFirst(month) : '';
    const weekdayCap = capitalizeFirst(weekday);

    return `${day} ${monthCap} (${weekdayCap}) - ${timePart}`;
}