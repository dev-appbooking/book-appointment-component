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
const intlLocales = {
    ro: 'ro-RO',
    en: 'en-GB'
};

function dateParts(date, language, options) {
    const locale = intlLocales[language] || 'ro-RO';
    let parts = {};
    new Intl.DateTimeFormat(locale, options).formatToParts(date).forEach( part => {
        parts[part.type] = part.value;
    });
    return parts;
}

// e.g. "Joi, 19 Februarie"
export function formatLocalizedDayMonth(date, language = 'ro') {
    const parts = dateParts(date, language, { weekday: 'long', day: 'numeric', month: 'long' });
    return `${capitalizeFirst(parts.weekday)}, ${parts.day} ${capitalizeFirst(parts.month)}`;
}

// e.g. "Luni, 16 Februarie 2026"
export function formatLocalizedLongDate(date, language = 'ro') {
    const parts = dateParts(date, language, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `${capitalizeFirst(parts.weekday)}, ${parts.day} ${capitalizeFirst(parts.month)} ${parts.year}`;
}
