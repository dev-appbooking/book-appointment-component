/*
Helpers for the desk booking widget: the desk services of seating/catalog, desk prices and the plain days
(YYYY-MM-DD, in the location's time zone) the seating calls take.
*/

// a booking is one desk for at most this many days
export const maxDeskDays = 31;

// used when the catalog gives no booking horizon
const defaultHorizonDays = 60;

/*
The choices of the service step, one per desk service and floor:
[ { id, sku, venue, seatPricing, horizonDays } ]. A desk service with no floor is in unavailableSkus.
Only services of type DeskSku are kept.
*/
export function deskOptionsFromCatalog(catalogSkus) {
    let options = [];
    let unavailableSkus = [];
    (catalogSkus || []).forEach( item => {
        if (!item || !item.sku || (item.sku.type !== 'DeskSku')) {
            return;
        }
        let venues = item.venues || [];
        if (venues.length === 0) {
            unavailableSkus.push(item.sku);
            return;
        }
        venues.forEach( venue => {
            options.push({ id: item.sku.id + ':' + venue.id, sku: item.sku, venue: venue, seatPricing: item.seatPricing || {},
                           horizonDays: item.bookingHorizonDays || defaultHorizonDays });
        });
    });
    return { options, unavailableSkus };
}

/*
The option to start on from the deep-link params: skuid is the human-readable sku.skuid, venueId the floor id.
Returns { options (the ones in scope), option (the preselected one or null) }.
*/
export function preselectDeskOption(options, skuidParam, venueIdParam) {
    const norm = (v) => (v === null || v === undefined || v === '') ? null : String(v);
    let skuid = norm(skuidParam);
    let venueId = norm(venueIdParam);
    let inScope = skuid ? options.filter( option => String(option.sku.skuid) === skuid ) : options;
    if (inScope.length === 0) {
        // an unknown skuid is ignored
        inScope = options;
    }
    let option = null;
    if (venueId) {
        option = inScope.find( item => String(item.venue.id) === venueId ) || null;
    }
    if (!option && (inScope.length === 1)) {
        option = inScope[0];
    }
    return { options: inScope, option };
}

// the price of one day at a desk of the price category: { price, currency }
export function deskPrice(option, priceCategory) {
    let categoryPrice = priceCategory && option.seatPricing ? option.seatPricing[priceCategory] : null;
    if (categoryPrice) {
        return categoryPrice;
    }
    return { price: option.sku.price, currency: option.sku.currency };
}

// the lowest price of a day at a desk of this option
export function lowestDeskPrice(option) {
    let prices = [ deskPrice(option, null) ].concat(Object.values(option.seatPricing || {}));
    return prices.filter( p => p && (p.price !== undefined) && (p.price !== null) )
                 .reduce( (lowest, p) => (!lowest || (parseFloat(p.price) < parseFloat(lowest.price))) ? p : lowest, null );
}

// true when the desk categories cost more than one price
export function hasSeveralPrices(option) {
    let prices = {};
    [ deskPrice(option, null) ].concat(Object.values(option.seatPricing || {})).forEach( p => {
        if (p && (p.price !== undefined) && (p.price !== null)) {
            prices[parseFloat(p.price) + ' ' + p.currency] = true;
        }
    });
    return Object.keys(prices).length > 1;
}

export function priceLabel(price) {
    return price ? `${price.price} ${price.currency}` : '';
}

function pad(n) {
    return String(n).padStart(2, '0');
}

// the plain day of a local Date, e.g. "2026-10-26"
export function dayKeyOf(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// the local Date at the start of a plain day
export function dateOfDayKey(dayKey) {
    let [ year, month, day ] = dayKey.split('-').map( part => parseInt(part, 10) );
    return new Date(year, month - 1, day);
}

export function addDaysToKey(dayKey, days) {
    let date = dateOfDayKey(dayKey);
    date.setDate(date.getDate() + days);
    return dayKeyOf(date);
}

// the plain day of a date-time in the time zone, e.g. the location's
export function dayKeyIn(timeZone, dateTime) {
    let date = dateTime ? new Date(dateTime) : new Date();
    let parts = {};
    try {
        new Intl.DateTimeFormat('en-GB', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' })
            .formatToParts(date).forEach( part => { parts[part.type] = part.value; } );
        return `${parts.year}-${parts.month}-${parts.day}`;
    } catch (e) {
        // an unknown time zone: the browser's day
        return dayKeyOf(date);
    }
}

// today in the time zone
export function todayKeyIn(timeZone) {
    return dayKeyIn(timeZone);
}

// the wall-clock time of a UTC date-time in the time zone, e.g. "08:00"
export function timeIn(dateTime, timeZone) {
    try {
        return new Intl.DateTimeFormat('en-GB', { timeZone: timeZone || undefined, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
            .format(new Date(dateTime));
    } catch (e) {
        return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(dateTime));
    }
}

// "08:00" plus minutes, as a wall-clock time
export function addMinutesToTime(time, minutes) {
    let [ hours, mins ] = time.split(':').map( part => parseInt(part, 10) );
    let total = (hours * 60 + mins + (minutes || 0)) % (24 * 60);
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

// the free desks of the venue per day of a seating/availability/summary response: { dayKey: free }
export function freeDesksPerDay(summary, venueId) {
    let result = {};
    ((summary && summary.days) || []).forEach( day => {
        let venue = (day.venues || []).find( item => String(item.venueId) === String(venueId) );
        result[day.date] = venue ? (venue.free || 0) : 0;
    });
    return result;
}

// the desks of a layout, in the layout's order: [ { seat, area } ]
export function desksOfLayout(layout) {
    let result = [];
    ((layout && layout.areas) || []).forEach( area => {
        (area.seats || []).forEach( seat => result.push({ seat, area }) );
    });
    return result;
}

// "monitor: dual", "window" for the free-form attributes of a desk
export function deskAttributesText(attributes) {
    if (!attributes || (typeof attributes !== 'object')) {
        return [];
    }
    return Object.keys(attributes).map( key => {
        let value = attributes[key];
        if ((value === true) || (value === null) || (value === undefined) || (value === '')) {
            return key;
        }
        if (value === false) {
            return null;
        }
        return `${key}: ${value}`;
    }).filter(Boolean);
}
