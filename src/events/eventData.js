import { dayKeyIn, timeIn, dateOfDayKey, addDaysToKey, priceLabel } from '../desks/deskData.js';

/*
Helpers for the event booking widget: the seat events (concerts, trainings) of seating/catalog, their
ticket types (ABB-162) and prices, schedule and the units (seats, standing places, places) a booking holds.
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
The choices of the event step, one per upcoming event of seating/catalog: [ { id, event, ticketTypes } ],
soonest first. Each ticket type (ABB-162) is its own SeatEventSku service with one price; ticketTypes is in
display order. eventType ('concert' | 'training') keeps only that kind of event.
*/
export function eventOptionsFromCatalog(catalogEvents, eventType) {
    let options = [];
    (catalogEvents || []).forEach( event => {
        if (!event || !event.id) {
            return;
        }
        if ((eventType === 'training') && !isTraining(event)) {
            return;
        }
        if ((eventType === 'concert') && hasNoVenue(event)) {
            return;
        }
        let ticketTypes = (event.ticketTypes || []).filter( type => type && type.sku && type.sku.id );
        if (ticketTypes.length === 0) {
            return;
        }
        options.push({ id: String(event.id), event: event, ticketTypes: ticketTypes });
    });
    return options.sort( (a, b) => String(a.event.startDate).localeCompare(String(b.event.startDate)) );
}

// the event can be booked: on sale, with at least one of the option's ticket types on sale
export function isOptionOnSale(option) {
    return !!option && !!option.event.onSale && option.ticketTypes.some( type => type.onSale );
}

/*
The event to start on from the deep-link params: skuid is the human-readable sku.skuid of a ticket type,
eventId the seat event id. A skuid keeps only the events selling that ticket type, and only that type in
them. Returns { options (the ones in scope), option (the preselected one or null) }.
An event that is not on sale is never preselected.
*/
export function preselectEventOption(options, skuidParam, eventIdParam) {
    const norm = (v) => (v === null || v === undefined || v === '') ? null : String(v);
    let skuid = norm(skuidParam);
    let eventId = norm(eventIdParam);
    let inScope = options;
    if (skuid) {
        inScope = options
            .map( option => ({ ...option, ticketTypes: option.ticketTypes.filter( type => String(type.sku.skuid) === skuid ) }) )
            .filter( option => option.ticketTypes.length > 0 );
        if (inScope.length === 0) {
            // an unknown skuid is ignored
            inScope = options;
        }
    }
    let option = null;
    if (eventId) {
        option = inScope.find( item => String(item.event.id) === eventId ) || null;
    }
    if (!option && (inScope.length === 1)) {
        option = inScope[0];
    }
    if (option && !isOptionOnSale(option)) {
        option = null;
    }
    return { options: inScope, option };
}

export function typePrice(type) {
    return type ? { price: type.price !== undefined && type.price !== null ? type.price : type.sku.price,
                    currency: type.currency || type.sku.currency } : null;
}

export function ticketTypeById(option, skuId) {
    return option.ticketTypes.find( type => String(type.sku.id) === String(skuId) ) || null;
}

/*
The ticket types that can sell a unit of the price category (the layout's seat or area priceCategory), in
display order. A type with no priceCategories sells any seat or place. An event with no venue has no
categories: every type sells its places.
*/
export function typesForCategory(option, priceCategory) {
    if (hasNoVenue(option.event)) {
        return option.ticketTypes;
    }
    return option.ticketTypes.filter( type => {
        let categories = type.priceCategories || [];
        return (categories.length === 0) || (!!priceCategory && categories.includes(priceCategory));
    });
}

/*
How many more units of the ticket type can be sold, by its quota: the live count of seating/availability
(liveTypes, keyed by service id) when it has one, else the catalog's remaining. null: no quota.
*/
export function quotaLeft(type, liveTypes) {
    let live = liveTypes && liveTypes[type.sku.id];
    if (live && (live.quota !== undefined) && (live.quota !== null)) {
        return Math.max(0, (live.quota || 0) - (live.taken || 0));
    }
    if ((type.quota === null) || (type.quota === undefined)) {
        return null;
    }
    return (type.remaining === null || type.remaining === undefined) ? type.quota : Math.max(0, type.remaining);
}

/*
The most units of the ticket type one booking can take: the lower of its maxPerBooking and its quota left.
null: only the event's maxSeatsPerBooking applies.
*/
export function typeLimit(type, liveTypes) {
    let limits = [ type.maxPerBooking, quotaLeft(type, liveTypes) ].filter( value => (value !== null) && (value !== undefined) );
    return limits.length > 0 ? Math.min(...limits) : null;
}

// the ticket type can be sold now: on sale and with some of its quota left
export function isTypeAvailable(type, liveTypes) {
    let left = quotaLeft(type, liveTypes);
    return !!type.onSale && ((left === null) || (left > 0));
}

// the units of each ticket type in a selection: { serviceSkuId: count }
export function unitsByType(selection) {
    let counts = {};
    const add = (skuId, count) => {
        if (skuId && (count > 0)) {
            counts[skuId] = (counts[skuId] || 0) + count;
        }
    };
    Object.values(selection.seats || {}).forEach( item => add(item.skuId, 1) );
    Object.values(selection.standing || {}).forEach( byType => Object.keys(byType || {}).forEach( skuId => add(skuId, byType[skuId]) ) );
    Object.keys(selection.quantity || {}).forEach( skuId => add(skuId, selection.quantity[skuId]) );
    return counts;
}

/*
How many more units of the ticket type the selection can take: within the event's maxSeatsPerBooking in
all and the type's own limit. 0 when the type is not available.
*/
export function roomForType(option, selection, type, liveTypes) {
    if (!isTypeAvailable(type, liveTypes)) {
        return 0;
    }
    let room = (option.event.maxSeatsPerBooking || 0) - selectedUnits(selection);
    let limit = typeLimit(type, liveTypes);
    if (limit !== null) {
        room = Math.min(room, limit - (unitsByType(selection)[type.sku.id] || 0));
    }
    return Math.max(0, room);
}

/*
The price shown for a unit of the price category: { price, currency, several } with the lowest price of the
ticket types that can sell it now (else of all that can sell it), several when they don't all cost the
same. null when no ticket type sells the category.
*/
export function categoryPrice(option, priceCategory, liveTypes) {
    let types = typesForCategory(option, priceCategory);
    let available = types.filter( type => isTypeAvailable(type, liveTypes) );
    return lowestPrice(available.length > 0 ? available : types);
}

// the lowest price of the ticket types: { price, currency, several } or null
export function lowestPrice(types) {
    let prices = (types || []).map(typePrice).filter( p => p && (p.price !== undefined) && (p.price !== null) && !isNaN(parseFloat(p.price)) );
    if (prices.length === 0) {
        return null;
    }
    let lowest = prices.reduce( (low, p) => (parseFloat(p.price) < parseFloat(low.price)) ? p : low );
    let several = new Set(prices.map( p => parseFloat(p.price) + ' ' + p.currency )).size > 1;
    return { ...lowest, several };
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

/*
A ticket selection:
- seats: { seatCode: { seat, area, skuId } }, the ticket type of each chosen seat
- standing: { areaCode: { serviceSkuId: quantity } }, places in standing areas per ticket type
- quantity: { serviceSkuId: quantity }, places of an event with no venue per ticket type
*/
export function emptySelection(option, liveTypes) {
    let quantity = {};
    if (option && hasNoVenue(option.event)) {
        let available = option.ticketTypes.filter( type => isTypeAvailable(type, liveTypes) );
        if (available.length === 1) {
            quantity[available[0].sku.id] = 1;
        }
    }
    return { seats: {}, standing: {}, quantity };
}

function sumValues(object) {
    return Object.values(object || {}).reduce( (sum, value) => sum + (value || 0), 0 );
}

// the places chosen in a standing area, every ticket type together
export function standingUnits(selection, areaCode) {
    return sumValues((selection.standing || {})[areaCode]);
}

// the number of units (seats and places) of a ticket selection
export function selectedUnits(selection) {
    let standing = Object.keys(selection.standing || {}).reduce( (sum, areaCode) => sum + standingUnits(selection, areaCode), 0 );
    return Object.keys(selection.seats || {}).length + standing + sumValues(selection.quantity);
}

/*
The items of seating/reservation for a ticket selection, each with its ticket type (serviceSkuId): one per
seat, one per standing area and type with a quantity, or one quantity per type for an event with no venue.
*/
export function reservationItems(selection) {
    let items = Object.keys(selection.seats || {}).map( seatCode => ({ seatCode: seatCode, serviceSkuId: selection.seats[seatCode].skuId }) );
    Object.keys(selection.standing || {}).forEach( areaCode => {
        let byType = selection.standing[areaCode] || {};
        Object.keys(byType).forEach( skuId => {
            if (byType[skuId] > 0) {
                items.push({ areaCode: areaCode, quantity: byType[skuId], serviceSkuId: skuId });
            }
        });
    });
    Object.keys(selection.quantity || {}).forEach( skuId => {
        if (selection.quantity[skuId] > 0) {
            items.push({ quantity: selection.quantity[skuId], serviceSkuId: skuId });
        }
    });
    return items;
}

// the price of the selected units, before the hold gives the real total
export function selectionTotal(option, selection) {
    let prices = [];
    Object.entries(unitsByType(selection)).forEach( ([ skuId, count ]) => {
        let price = typePrice(ticketTypeById(option, skuId));
        for (let i = 0; i < count; i++) {
            prices.push(price);
        }
    });
    return sumPrices(prices);
}

// lowers the places of the { serviceSkuId: quantity } map to at most max in all, the last types first
function capQuantities(byType, max) {
    let result = { ...(byType || {}) };
    let excess = sumValues(result) - Math.max(0, max);
    Object.keys(result).reverse().forEach( skuId => {
        if (excess > 0) {
            let cut = Math.min(excess, result[skuId] || 0);
            result[skuId] = (result[skuId] || 0) - cut;
            excess -= cut;
        }
    });
    return result;
}

/*
The selection without what a 409 of seating/reservation says is taken: a taken seat is dropped, a
standing area or the event's places are lowered to the places still available, and a ticket type past its
quota (serviceSkuId) is lowered to what is left of it (places first, then the last chosen seats).
*/
export function selectionWithoutConflicts(selection, conflicts) {
    let seats = { ...(selection.seats || {}) };
    let standing = { ...(selection.standing || {}) };
    let quantity = { ...(selection.quantity || {}) };
    (conflicts || []).forEach( conflict => {
        let available = Math.max(0, conflict.available || 0);
        if (conflict.seatCode) {
            delete seats[conflict.seatCode];
        } else if (conflict.serviceSkuId) {
            let skuId = String(conflict.serviceSkuId);
            let excess = (unitsByType({ seats, standing, quantity })[skuId] || 0) - available;
            const cut = (count) => {
                let removed = Math.min(excess, count || 0);
                excess -= removed;
                return (count || 0) - removed;
            };
            if ((excess > 0) && quantity[skuId]) {
                quantity[skuId] = cut(quantity[skuId]);
            }
            Object.keys(standing).forEach( areaCode => {
                if ((excess > 0) && standing[areaCode] && standing[areaCode][skuId]) {
                    standing[areaCode] = { ...standing[areaCode], [skuId]: cut(standing[areaCode][skuId]) };
                }
            });
            Object.keys(seats).reverse().forEach( seatCode => {
                if ((excess > 0) && (String(seats[seatCode].skuId) === skuId)) {
                    delete seats[seatCode];
                    excess -= 1;
                }
            });
        } else if (conflict.areaCode) {
            standing[conflict.areaCode] = capQuantities(standing[conflict.areaCode], available);
        } else if ((conflict.available !== undefined) && (conflict.available !== null)) {
            quantity = capQuantities(quantity, available);
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
standing area (or event with no venue) and ticket type with the number of places:
[ { key, label, ticketType, count, price, currency, isPlaces } ].
*/
export function groupSeatItems(items) {
    let lines = [];
    (items || []).forEach( item => {
        let ticketType = item.ticketType || null;
        if (item.seatCode) {
            lines.push({ key: 'seat:' + item.seatCode, label: item.label || item.seatCode, ticketType, count: 1, price: item.price, currency: item.currency });
            return;
        }
        let key = 'area:' + (item.areaCode || '') + ':' + (item.serviceSkuId || '');
        let line = lines.find( entry => entry.key === key );
        if (line) {
            line.count += 1;
        } else {
            lines.push({ key: key, label: item.areaName || item.label, ticketType, count: 1, price: item.price, currency: item.currency, isPlaces: true });
        }
    });
    return lines;
}
