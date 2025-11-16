export function capitalizeFirst(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function formatLocalizedDateTime(date, language = 'ro') {
    const locales = {
        ro: 'ro-RO',
        en: 'en-GB'
    };

    const locale = locales[language] || 'ro-RO';

    const datePart = new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: 'long',
    }).format(date);

    const weekday = new Intl.DateTimeFormat(locale, {
        weekday: 'long',
    }).format(date);

    const dmy = new Intl.DateTimeFormat(locale).format(date);

    const [day, month] = datePart.split(' ');
    const monthCap = month ? capitalizeFirst(month) : '';
    const weekdayCap = capitalizeFirst(weekday);

    return `${weekdayCap}, ${day} ${monthCap} (${dmy})`;
}