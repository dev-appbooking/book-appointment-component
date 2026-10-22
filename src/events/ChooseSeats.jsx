import { useEffect, useState } from 'react';
import { httpRequest } from '../HttpRequest';
import { QuantityPicker } from './QuantityPicker.jsx';
import { unitPrice, priceLabel, rowsOfArea, selectedUnits, selectionTotal } from './eventData.js';

// the layouts already loaded, by venue: the browser's HTTP cache (Cache-Control, ETag) covers reloads
const layoutCache = {};

function loadLayout(apiBase, integrationId, venueId) {
    if (!layoutCache[venueId]) {
        layoutCache[venueId] = httpRequest('GET', apiBase + '/api/integration/' + integrationId + '/seating/venue/' + encodeURIComponent(venueId) + '/layout')
            .catch( e => {
                delete layoutCache[venueId];
                throw e;
            });
    }
    return layoutCache[venueId];
}

// the seat kinds marked on the map, besides regular seats
const markedSeatKinds = ['wheelchair', 'companion', 'restricted_view'];

/*
The seats and standing places of an event held at a venue. Seated areas show their seats by row: a seat
held, sold or blocked can't be chosen. Standing areas take a number of places. The selection is
{ seats: { seatCode: { seat, area } }, standing: { areaCode: quantity } }; at most the event's
maxSeatsPerBooking units in all.
props: apiBase, integrationId, option (the sku and event), selection, onChangeSelection(selection),
refreshKey, notice, ltext, rawTextByKey.
*/
export function ChooseSeats(props) {
    const option = props.option;
    const event = option.event;
    const selection = props.selection;
    const [ data, setData ] = useState({ status: 'loading', layout: null, taken: {}, standing: {} });

    useEffect(() => {
        let active = true;
        setData(prev => ({ ...prev, status: 'loading' }));
        Promise.all([
            loadLayout(props.apiBase, props.integrationId, event.venueId),
            httpRequest('POST', props.apiBase + '/api/integration/' + props.integrationId + '/seating/availability', { seatEventId: event.id }, { 'content-type': 'application/json' })
        ]).then( ([ layout, availability ]) => {
            if (!active) {
                return;
            }
            let taken = {};
            Object.values(availability.seated || {}).forEach( codes => (codes || []).forEach( code => { taken[code] = true; }) );
            setData({ status: 'success', layout: layout, taken: taken, standing: availability.standing || {} });
        }).catch( () => {
            if (active) {
                setData(prev => ({ ...prev, status: 'error' }));
            }
        });
        return () => { active = false; };
    }, [event.id, props.refreshKey]);

    function text(key, ...args) {
        return props.ltext.textValue(props.rawTextByKey(key), ...args);
    }

    const units = selectedUnits(selection);
    const maxUnits = event.maxSeatsPerBooking || 0;

    function isTaken(seat) {
        // a seat already in the selection stays the customer's until a hold says otherwise
        return !selection.seats[seat.code] && !!data.taken[seat.code];
    }

    function placesLeft(area) {
        let standing = data.standing[area.code];
        if (!standing) {
            return area.capacity || 0;
        }
        return Math.max(0, (standing.capacity || 0) - (standing.taken || 0));
    }

    function toggleSeat(seat, area) {
        let seats = { ...selection.seats };
        if (seats[seat.code]) {
            delete seats[seat.code];
        } else {
            if (units >= maxUnits) {
                return;
            }
            seats[seat.code] = { seat, area };
        }
        props.onChangeSelection({ ...selection, seats });
    }

    function changeStanding(area, quantity) {
        props.onChangeSelection({ ...selection, standing: { ...selection.standing, [area.code]: quantity } });
    }

    function seatButton(seat, area) {
        let taken = isTaken(seat);
        let isSelected = !!selection.seats[seat.code];
        let price = priceLabel(unitPrice(option, seat.priceCategory || area.priceCategory));
        let kindText = markedSeatKinds.includes(seat.kind) ? props.rawTextByKey('events.seat.kind.' + seat.kind) : null;
        let label = [ seat.label || seat.code, kindText, price, taken ? props.rawTextByKey('events.seat.taken') : null ].filter(Boolean).join(', ');
        let classValue = "appBookingSeat appBookingSeat_" + (seat.kind || 'regular') + (taken ? " appBookingSeatTaken" : "") + (isSelected ? " appBookingSeatSelected" : "");
        return (
            <button key={seat.code} type="button" className={classValue} data-seat-code={seat.code}
                    disabled={taken} aria-pressed={isSelected} aria-label={label} title={label}
                    onClick={ () => toggleSeat(seat, area) }>
                { seat.seatNumber || seat.code }
            </button>
        );
    }

    function areaHeader(area, freeText) {
        let price = priceLabel(unitPrice(option, area.priceCategory));
        return (
            <div className="appBookingDeskAreaHeader appBookingSeatAreaHeader">
                { area.color && <span className="appBookingDeskAreaColor" style={{ backgroundColor: area.color }} aria-hidden="true"></span> }
                <span className="appBookingSeatAreaName"> { area.name || area.code } </span>
                { price && <span className="appBookingSeatAreaPrice"> { price } </span> }
                <span className="appBookingDeskAreaFree appBookingTextNotImportant"> { freeText } </span>
            </div>
        );
    }

    function seatedArea(area) {
        let free = (area.seats || []).filter( seat => !isTaken(seat) ).length;
        return (
            <div key={area.code} className="appBookingSeatArea appBookingSeatArea_seated" data-area-code={area.code}>
                { areaHeader(area, free > 0 ? text('events.area.free', free) : props.rawTextByKey('events.area.full')) }
                <div className="appBookingSeatRows">
                    { rowsOfArea(area).map( row => (
                        <div key={row.rowLabel} className="appBookingSeatRow">
                            { row.rowLabel && <span className="appBookingSeatRowLabel" aria-hidden="true"> { row.rowLabel } </span> }
                            <div className="appBookingSeatRowSeats" role="group" aria-label={row.rowLabel ? text('events.seat.row', row.rowLabel) : undefined}>
                                { row.seats.map( seat => seatButton(seat, area) ) }
                            </div>
                        </div>
                    )) }
                </div>
            </div>
        );
    }

    function standingArea(area) {
        let left = placesLeft(area);
        let current = selection.standing[area.code] || 0;
        // the places of this area plus the rest of the selection stay within maxSeatsPerBooking
        let max = Math.min(left, maxUnits - (units - current));
        return (
            <div key={area.code} className="appBookingSeatArea appBookingSeatArea_standing" data-area-code={area.code}>
                { areaHeader(area, left > 0 ? text('events.places.left', left) : props.rawTextByKey('events.area.full')) }
                <div className="appBookingSeatStanding">
                    <span className="appBookingTextNotImportant"> { props.rawTextByKey('events.area.standing') } </span>
                    <QuantityPicker value={current} min={0} max={max} onChange={ (quantity) => changeStanding(area, quantity) }
                                    disabled={left === 0 && current === 0}
                                    label={(area.name || area.code) + ': ' + props.rawTextByKey('events.qty.label')}
                                    decreaseLabel={props.rawTextByKey('events.qty.decrease')}
                                    increaseLabel={props.rawTextByKey('events.qty.increase')} />
                </div>
            </div>
        );
    }

    function legend(areas) {
        let kinds = markedSeatKinds.filter( kind => areas.some( area => (area.seats || []).some( seat => seat.kind === kind ) ) );
        if (!areas.some( area => area.kind === 'seated' )) {
            return null;
        }
        return (
            <div className="appBookingSeatLegend" aria-hidden="true">
                <span className="appBookingSeatLegendItem"> <span className="appBookingSeat appBookingSeatSample"></span> { props.rawTextByKey('events.seat.legend.free') } </span>
                <span className="appBookingSeatLegendItem"> <span className="appBookingSeat appBookingSeatSample appBookingSeatSelected"></span> { props.rawTextByKey('events.seat.legend.selected') } </span>
                <span className="appBookingSeatLegendItem"> <span className="appBookingSeat appBookingSeatSample appBookingSeatTaken"></span> { props.rawTextByKey('events.seat.legend.taken') } </span>
                { kinds.map( kind => (
                    <span key={kind} className="appBookingSeatLegendItem"> <span className={"appBookingSeat appBookingSeatSample appBookingSeat_" + kind}></span> { props.rawTextByKey('events.seat.kind.' + kind) } </span>
                )) }
            </div>
        );
    }

    function selectionLine() {
        let total = selectionTotal(option, selection, data.layout);
        return (
            <div className="appBookingDeskDaysSelection appBookingSeatSelection">
                <span className="appBookingTextNotImportant">
                    { units >= maxUnits ? props.rawTextByKey('events.tickets.maxReached') : text('events.tickets.max', maxUnits) }
                </span>
                { units > 0 && (
                    <span className="appBookingDeskDaysCount">
                        { text('events.tickets.selected', units) }{ total ? ' · ' + text('events.tickets.total', priceLabel(total)) : '' }
                        <button type="button" className="appBookingLinkButton" onClick={ () => props.onChangeSelection({ ...selection, seats: {}, standing: {} }) }>
                            { props.rawTextByKey('events.tickets.clear') }
                        </button>
                    </span>
                ) }
            </div>
        );
    }

    function loadingContent() {
        return (
            <div className="appBookingDeskGrid appBookingLoading" aria-busy="true">
                { [0, 1, 2, 3, 4, 5].map( index => ( <div key={index} className="appBookingSkeleton appBookingDeskSkeleton"></div> )) }
            </div>
        );
    }

    function areasContent() {
        if (!data.layout && (data.status === 'loading')) {
            return loadingContent();
        }
        if (data.status === 'error') {
            return ( <div className="appBookingErrorText appBookingMessage"> { props.rawTextByKey('error.generic') } </div> );
        }
        let areas = ((data.layout && data.layout.areas) || []).slice().sort( (a, b) => (a.position || 0) - (b.position || 0) );
        return (
            <div className="appBookingSeatAreas" aria-busy={data.status === 'loading'}>
                { legend(areas) }
                { areas.map( area => (area.kind === 'standing' ? standingArea(area) : seatedArea(area)) ) }
            </div>
        );
    }

    return (
        <div className="appBookingSeatContainer">
            { selectionLine() }
            { props.notice && ( <div className="appBookingSlotNotice appBookingWarningText"> { props.notice } </div> ) }
            { areasContent() }
            { props.children }
        </div>
    );
}
