import { dayKeyIn, timeIn, dateOfDayKey, addDaysToKey, priceLabel } from '../desks/deskData.js';

/*
Helpers for the event booking widget: the seat events (concerts, trainings) of seating/catalog, their
prices, schedule and the units (seats, standing places, places) a booking holds.
An event with a venue has a seat map (seated areas) and/or standing areas; an event with no venue
(e.g. a training) only has a capacity.
*/

export { priceLabel };

// an event with no venue: no seat map, only a number of places
export function hasNoVenue(event) {
    return !event.venueId;
}

// a training: an event with no venue and a capacity
export function isTraining(event) {
    return hasNoVenue(event) && (event.capacity !== null) && (event.capacity !== undefined);
}

/*
The choices of the event step, one per upcoming event of the ticket services: [ { id, sku, event } ],
soonest first. eventType ('concert' | 'training') keeps only that kind of event.
*/
export function eventOptionsFromCatalog(catalogSkus, eventType) {
    let options = [];
    (catalogSkus || []).forEach( item => {
        if (!item || !item.sku || (item.sku.type !== 'SeatEventSku')) {
            return;
        }
        (item.events || []).forEach( event => {
            if ((eventType === 'training') && !isTraining(event)) {
                return;
            }
            if ((eventType === 'concert') && hasNoVenue(event)) {
                return;
            }
            options.push({ id: event.id, sku: item.sku, event: event });
        });
    });
    return options.sort( (a, b) => String(a.event.startDate).localeCompare(String(b.event.startDate)) );
}

/*
The event to start on from the deep-link params: skuid is the human-readable sku.skuid, eventId the
seat event id. Returns { options (the ones in scope), option (the preselected one or null) }.
An event that is not on sale is never preselected.
*/
export function preselectEventOption(options, skuidParam, eventIdParam) {
    const norm = (v) => (v === null || v === undefined || v === '') ? null : String(v);
    let skuid = norm(skuidParam);
    let eventId = norm(eventIdParam);
    let inScope = skuid ? options.filter( option => String(option.sku.skuid) === skuid ) : options;
    if (inScope.length === 0) {
        // an unknown skuid is ignored
        inScope = options;
    }
    let option = null;
    if (eventId) {
        option = inScope.find( item => String(item.event.id) === eventId ) || null;
    }
    if (!option && (inScope.length === 1)) {
        option = inScope[0];
    }
    if (option && !option.event.onSale) {
        option = null;
    }
    return { options: inScope, option };
}

/*
The price of one unit of the price category: the event's pricing of the category, else the service's price.
*/
export function unitPrice(option, priceCategory) {
    let pricing = option.event.pricing || {};
    if (priceCategory && pricing[priceCategory]) {
        return pricing[priceCategory];
    }
    return { price: option.sku.price, currency: option.sku.currency };
}

// the sum of prices, e.g. of the selected units: { price, currency } or null
export function sumPrices(prices) {
    let valid = prices.filter( p => p && (p.price !== undefined) && (p.price !== null) );
    if (valid.length === 0) {
        return null;
    }
    let total = valid.reduce( (sum, p) => sum + parseFloat(p.price), 0 );
    return { price: total.toFixed(2), currency: valid[0].currency };
}

// the sessions of the event in order; an event listed without sessions is one session from start to end
export function sessionsOf(event) {
    let sessions = (event.sessions || []).slice().sort( (a, b) => (a.position || 0) - (b.position || 0) );
    if (sessions.length === 0) {
        return [ { id: event.id, position: 1, startDate: event.startDate, endDate: event.endDate } ];
    }
    return sessions;
}

/*
The plain days (YYYY-MM-DD, in the time zone) the event takes place on. A session may span several days.
*/
export function eventDayKeys(event) {
    let days = {};
    sessionsOf(event).forEach( session => {
        let first = dayKeyIn(event.timeZone, session.startDate);
        // the end is exclusive: a session ending at midnight does not run on the next day
        let lastDate = new Date(new Date(session.endDate || session.startDate).getTime() - 1);
        let last = session.endDate ? dayKeyIn(event.timeZone, lastDate) : first;
        if (last < first) {
            last = first;
        }
        for (let day = first; day <= last; day = addDaysToKey(day, 1)) {
            days[day] = true;
        }
    });
    return Object.keys(days).sort();
}

// the local Date of the day of a date-time in the event's time zone, for the date formatters
export function localDateOf(event, dateTime) {
    return dateOfDayKey(dayKeyIn(event.timeZone, dateTime));
}

export function localTimeOf(event, dateTime) {
    return timeIn(dateTime, event.timeZone);
}

// the number of units (seats and standing places) of a ticket selection
export function selectedUnits(selection) {
    let standing = Object.values(selection.standing || {}).reduce( (sum, quantity) => sum + (quantity || 0), 0 );
    return Object.keys(selection.seats || {}).length + standing + (selection.quantity || 0);
}

/*
The items of seating/reservation for a ticket selection: one per seat, one per standing area with a
quantity, or a single quantity for an event with no venue.
*/
export function reservationItems(selection) {
    let items = Object.keys(selection.seats || {}).map( seatCode => ({ seatCode: seatCode }) );
    Object.keys(selection.standing || {}).forEach( areaCode => {
        if (selection.standing[areaCode] > 0) {
            items.push({ areaCode: areaCode, quantity: selection.standing[areaCode] });
        }
    });
    if (selection.quantity > 0) {
        items.push({ quantity: selection.quantity });
    }
    return items;
}

// the price of the selected units, before the hold gives the real total
export function selectionTotal(option, selection, layout) {
    let prices = Object.values(selection.seats || {}).map( item => unitPrice(option, item.seat.priceCategory || item.area.priceCategory) );
    Object.keys(selection.standing || {}).forEach( areaCode => {
        let area = layout && (layout.areas || []).find( item => item.code === areaCode );
        for (let i = 0; i < (selection.standing[areaCode] || 0); i++) {
            prices.push(unitPrice(option, area ? area.priceCategory : null));
        }
    });
    for (let i = 0; i < (selection.quantity || 0); i++) {
        prices.push(unitPrice(option, null));
    }
    return sumPrices(prices);
}

/*
The selection without what a 409 of seating/reservation says is taken: the conflicting seats are dropped,
a standing area or the event quantity is lowered to the places still available.
*/
export function selectionWithoutConflicts(selection, conflicts) {
    let seats = { ...(selection.seats || {}) };
    let standing = { ...(selection.standing || {}) };
    let quantity = selection.quantity || 0;
    (conflicts || []).forEach( conflict => {
        if (conflict.seatCode) {
            delete seats[conflict.seatCode];
        } else if (conflict.areaCode) {
            standing[conflict.areaCode] = Math.max(0, Math.min(standing[conflict.areaCode] || 0, conflict.available || 0));
        } else if ((conflict.available !== undefined) && (conflict.available !== null)) {
            quantity = Math.max(0, Math.min(quantity, conflict.available));
        }
    });
    return { ...selection, seats, standing, quantity };
}

// the seats of a seated area grouped by row, in the layout's order: [ { rowLabel, seats } ]
export function rowsOfArea(area) {
    let rows = [];
    (area.seats || []).forEach( seat => {
        let rowLabel = (seat.rowLabel === null || seat.rowLabel === undefined) ? '' : String(seat.rowLabel);
        let row = rows.find( item => item.rowLabel === rowLabel );
        if (!row) {
            row = { rowLabel: rowLabel, seats: [] };
            rows.push(row);
        }
        row.seats.push(seat);
    });
    return rows;
}

/*
The tickets of a hold or a booking (SeatItem list) grouped for display: one line per seat, and one per
standing area or event with no venue with the number of places: [ { key, label, count, price } ].
*/
export function groupSeatItems(items) {
    let lines = [];
    (items || []).forEach( item => {
        if (item.seatCode) {
            lines.push({ key: 'seat:' + item.seatCode, label: item.label || item.seatCode, count: 1, price: item.price, currency: item.currency });
            return;
        }
        let key = 'area:' + (item.areaCode || '');
        let line = lines.find( entry => entry.key === key );
        if (line) {
            line.count += 1;
        } else {
            lines.push({ key: key, label: item.areaName || item.label, count: 1, price: item.price, currency: item.currency, isPlaces: true });
        }
    });
    return lines;
}
