import { useEffect, useMemo, useRef, useState } from 'react';
import { httpRequest } from '../HttpRequest';
import { QuantityPicker } from './QuantityPicker.jsx';
import { priceLabel, rowsOfArea, selectedUnits, selectionTotal, typesForCategory, roomForType, isTypeAvailable,
         categoryPrice, typePrice, ticketTypeById, standingUnits } from './eventData.js';
import { TicketTypesLegend } from './TicketTypes.jsx';
import { SeatMap, sanitizeSeatMap, codesOfMap } from '../utils/SeatMap.jsx';

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
The seats and standing places of an event held at a venue, on the venue's map (layout.venue.mapContent) when it
has one, or by area and row as a list. With a map the customer can switch between the map and the list; the
standing areas are listed under the map, and clicking one on the map moves to its picker. A seat
held, sold or blocked can't be chosen, nor one that no ticket type on sale sells (ABB-162: a ticket type sells
the seats whose priceCategory is in its priceCategories, or every seat when it has none). A chosen seat gets the
first ticket type in display order that sells it and has room left; when several types sell it, the customer
can change it in the list of chosen seats. Standing areas take a number of places per ticket type. The
selection is { seats: { seatCode: { seat, area, skuId } }, standing: { areaCode: { skuId: quantity } } }; at most
the event's maxSeatsPerBooking units in all, and per ticket type its maxPerBooking and what is left of its quota.
props: apiBase, integrationId, option (the event and its ticket types), selection, onChangeSelection(selection),
onLiveTypes(liveTypes), ticketTypeStatus(type, liveTypes), refreshKey, notice, ltext, rawTextByKey.
*/
export function ChooseSeats(props) {
    const option = props.option;
    const event = option.event;
    const selection = props.selection;
    const [ data, setData ] = useState({ status: 'loading', layout: null, taken: {}, standing: {}, liveTypes: {} });
    const [ view, setView ] = useState('map');
    const containerRef = useRef(null);
    const mapContent = data.layout && data.layout.venue ? data.layout.venue.mapContent : null;
    const cleanMap = useMemo( () => sanitizeSeatMap(mapContent), [mapContent]);
    const mapCodes = useMemo( () => codesOfMap(cleanMap), [cleanMap]);

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
            let liveTypes = availability.ticketTypes || {};
            setData({ status: 'success', layout: layout, taken: taken, standing: availability.standing || {}, liveTypes: liveTypes });
            if (props.onLiveTypes) {
                props.onLiveTypes(liveTypes);
            }
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

    const liveTypes = data.liveTypes;

    function isTaken(seat) {
        // a seat already in the selection stays the customer's until a hold says otherwise
        return !selection.seats[seat.code] && !!data.taken[seat.code];
    }

    function categoryOf(seat, area) {
        return seat.priceCategory || area.priceCategory || null;
    }

    // no ticket type on sale sells the seat
    function isNotForSale(seat, area) {
        return !selection.seats[seat.code] && !typesForCategory(option, categoryOf(seat, area)).some( type => isTypeAvailable(type, liveTypes) );
    }

    // 'free', 'taken' or 'closed' (no ticket type on sale sells it)
    function seatState(seat, area) {
        if (isTaken(seat)) {
            return 'taken';
        }
        return isNotForSale(seat, area) ? 'closed' : 'free';
    }

    // the first ticket type that sells the seat and has room left in the selection
    function typeForNewSeat(seat, area) {
        return typesForCategory(option, categoryOf(seat, area)).find( type => roomForType(option, selection, type, liveTypes) > 0 ) || null;
    }

    function canChooseSeat(seat, area) {
        return !!selection.seats[seat.code] || ((seatState(seat, area) === 'free') && !!typeForNewSeat(seat, area));
    }

    function priceText(price) {
        if (!price) {
            return '';
        }
        return price.several ? text('events.event.from', priceLabel(price)) : priceLabel(price);
    }

    function toggleSeat(seat, area) {
        let seats = { ...selection.seats };
        if (seats[seat.code]) {
            delete seats[seat.code];
        } else {
            let type = typeForNewSeat(seat, area);
            if (!type || (seatState(seat, area) !== 'free')) {
                return;
            }
            seats[seat.code] = { seat, area, skuId: type.sku.id };
        }
        props.onChangeSelection({ ...selection, seats });
    }

    function changeSeatType(seatCode, skuId) {
        let item = selection.seats[seatCode];
        if (!item) {
            return;
        }
        props.onChangeSelection({ ...selection, seats: { ...selection.seats, [seatCode]: { ...item, skuId } } });
    }

    function changeStanding(area, type, quantity) {
        let byType = { ...(selection.standing[area.code] || {}), [type.sku.id]: quantity };
        props.onChangeSelection({ ...selection, standing: { ...selection.standing, [area.code]: byType } });
    }

    function seatInfo(seat, area) {
        let state = seatState(seat, area);
        let chosen = selection.seats[seat.code];
        let chosenType = chosen ? ticketTypeById(option, chosen.skuId) : null;
        let price = chosenType ? priceLabel(typePrice(chosenType)) : priceText(categoryPrice(option, categoryOf(seat, area), liveTypes));
        let kindText = markedSeatKinds.includes(seat.kind) ? props.rawTextByKey('events.seat.kind.' + seat.kind) : null;
        let takenText = state === 'taken' ? props.rawTextByKey('events.seat.taken')
                      : (state === 'closed' ? props.rawTextByKey('events.seat.notForSale') : null);
        let typeText = chosenType && (option.ticketTypes.length > 1) ? chosenType.sku.name : null;
        return { taken: state !== 'free', state, price, kindText, takenText, typeText };
    }

    function seatLabel(seat, area) {
        let { price, kindText, takenText, typeText } = seatInfo(seat, area);
        return [ seat.label || seat.code, kindText, typeText, price, takenText ].filter(Boolean).join(', ');
    }

    function seatButton(seat, area) {
        let { taken } = seatInfo(seat, area);
        let isSelected = !!selection.seats[seat.code];
        let label = seatLabel(seat, area);
        let classValue = "appBookingSeat appBookingSeat_" + (seat.kind || 'regular') + (taken ? " appBookingSeatTaken" : "") + (isSelected ? " appBookingSeatSelected" : "");
        let canChoose = canChooseSeat(seat, area);
        return (
            <button key={seat.code} type="button" className={classValue} data-seat-code={seat.code}
                    disabled={taken} aria-disabled={!taken && !canChoose ? true : undefined} aria-pressed={isSelected} aria-label={label} title={label}
                    onClick={ () => toggleSeat(seat, area) }>
                { seat.seatNumber || seat.code }
            </button>
        );
    }

    function areaHeader(area, freeText) {
        let price = priceText(categoryPrice(option, area.priceCategory, liveTypes));
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
        let free = freeSeatsOf(area);
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

    // the seats of a seated area that can be bought: not taken and sold by a ticket type on sale
    function freeSeatsOf(area) {
        return (area.seats || []).filter( seat => seatState(seat, area) === 'free' ).length;
    }

    function placesLeft(area) {
        let standing = data.standing[area.code];
        if (!standing) {
            return area.capacity || 0;
        }
        return Math.max(0, (standing.capacity || 0) - (standing.taken || 0));
    }

    // the places of a standing area that can be bought: 0 when no ticket type on sale sells it
    function standingFree(area) {
        return typesForCategory(option, area.priceCategory).some( type => isTypeAvailable(type, liveTypes) ) ? placesLeft(area) : 0;
    }

    function standingPicker(area, type, label, left) {
        let current = (selection.standing[area.code] || {})[type.sku.id] || 0;
        let inArea = standingUnits(selection, area.code);
        // within the places left in the area, maxSeatsPerBooking and the ticket type's own limits
        let max = Math.min(current + Math.max(0, left - inArea), current + roomForType(option, selection, type, liveTypes));
        let unavailable = !isTypeAvailable(type, liveTypes);
        return (
            <QuantityPicker value={current} min={0} max={max} onChange={ (quantity) => changeStanding(area, type, quantity) }
                            disabled={(max === 0 && current === 0) || (unavailable && current === 0)}
                            label={label + ': ' + props.rawTextByKey('events.qty.label')}
                            decreaseLabel={props.rawTextByKey('events.qty.decrease')}
                            increaseLabel={props.rawTextByKey('events.qty.increase')} />
        );
    }

    function standingArea(area) {
        let left = placesLeft(area);
        let free = standingFree(area);
        let types = typesForCategory(option, area.priceCategory);
        let areaName = area.name || area.code;
        return (
            <div key={area.code} className="appBookingSeatArea appBookingSeatArea_standing" data-area-code={area.code}>
                { areaHeader(area, free > 0 ? text('events.places.left', left) : props.rawTextByKey(left > 0 ? 'events.area.notForSale' : 'events.area.full')) }
                { types.length <= 1
                    ? ( <div className="appBookingSeatStanding">
                            <span className="appBookingTextNotImportant"> { props.rawTextByKey('events.area.standing') } </span>
                            { types.length === 1 && standingPicker(area, types[0], areaName, left) }
                        </div> )
                    : types.map( type => {
                        let status = isTypeAvailable(type, liveTypes) ? null : props.ticketTypeStatus(type, liveTypes);
                        return (
                            <div key={type.sku.id} className="appBookingSeatStanding appBookingSeatStandingType" data-sku-id={type.sku.id}>
                                <span className="appBookingSeatStandingTypeInfo">
                                    <span className="appBookingTicketTypeName"> { type.sku.name } </span>
                                    <span className="appBookingTextNotImportant"> { [ priceLabel(typePrice(type)), status ].filter(Boolean).join(' · ') } </span>
                                </span>
                                { standingPicker(area, type, areaName + ', ' + type.sku.name, left) }
                            </div>
                        );
                    }) }
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
        let total = selectionTotal(option, selection);
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
        let hasMap = !!cleanMap;
        let showMap = hasMap && (view === 'map');
        return (
            <div className="appBookingSeatAreas" aria-busy={data.status === 'loading'}>
                <TicketTypesLegend option={option} liveTypes={liveTypes} areas={areas}
                                   statusText={ type => props.ticketTypeStatus(type, liveTypes) }
                                   rawTextByKey={props.rawTextByKey} text={text} />
                { hasMap && viewToggle() }
                { showMap ? mapContentOf(areas) : listContent(areas) }
                { selectedSeats() }
            </div>
        );
    }

    function listContent(areas) {
        return (<>
            { legend(areas) }
            { areas.map( area => (area.kind === 'standing' ? standingArea(area) : seatedArea(area)) ) }
        </>);
    }

    function viewToggle() {
        return (
            <div className="appBookingEventViewToggle" role="group" aria-label={props.rawTextByKey('events.view.label')}>
                { [ 'map', 'list' ].map( item => (
                    <button key={item} type="button" aria-pressed={view === item}
                            className={"appBookingChip appBookingEventViewButton" + (view === item ? " appBookingChipSelected" : "")}
                            onClick={ () => setView(item) }>
                        { props.rawTextByKey('events.view.' + item) }
                    </button>
                )) }
            </div>
        );
    }

    // the seats of the seated areas, as { seat, area }
    function seatItems(areas) {
        let items = [];
        areas.filter( area => area.kind !== 'standing' ).forEach( area => (area.seats || []).forEach( seat => items.push({ seat, area }) ) );
        return items;
    }

    function areaFreeText(area) {
        if (area.kind === 'standing') {
            return standingFree(area) > 0 ? text('events.places.left', placesLeft(area)) : props.rawTextByKey('events.area.full');
        }
        let free = freeSeatsOf(area);
        return free > 0 ? text('events.area.free', free) : props.rawTextByKey('events.area.full');
    }

    function areaDetails(area) {
        let price = priceText(categoryPrice(option, area.priceCategory, liveTypes));
        let kindText = area.kind === 'standing' ? props.rawTextByKey('events.area.standing') : null;
        return [ area.name || area.code, kindText, price, areaFreeText(area) ].filter(Boolean).join(' · ');
    }

    // a standing area clicked on the map: its picker under the map gets the focus
    function goToStandingArea(area) {
        let root = containerRef.current;
        let element = root && Array.from(root.querySelectorAll('.appBookingEventMapStanding [data-area-code]'))
            .find( item => item.getAttribute('data-area-code') === area.code );
        if (!element) {
            return;
        }
        if (element.scrollIntoView) {
            element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        let button = Array.from(element.querySelectorAll('button')).reverse().find( item => !item.disabled )
            || element.querySelector('button');
        if (button) {
            button.focus();
        }
    }

    function mapLegend(areas) {
        let kinds = markedSeatKinds.filter( kind => areas.some( area => (area.seats || []).some( seat => seat.kind === kind ) ) );
        let samples = [ [ 'free', 'events.seat.legend.free' ], [ 'selected', 'events.seat.legend.selected' ], [ 'taken', 'events.seat.legend.taken' ] ];
        return (
            <div className="appBookingSeatLegend appBookingEventMapLegend" aria-hidden="true">
                { samples.map( ([ state, key ]) => (
                    <span key={state} className="appBookingSeatLegendItem">
                        <span className={"appBookingEventMapLegendSample appBookingEventMapLegendSample_" + state}></span> { props.rawTextByKey(key) }
                    </span>
                )) }
                { kinds.map( kind => (
                    <span key={kind} className="appBookingSeatLegendItem">
                        <span className={"appBookingEventMapLegendSample appBookingEventMapLegendSample_kind_" + kind}></span> { props.rawTextByKey('events.seat.kind.' + kind) }
                    </span>
                )) }
            </div>
        );
    }

    // the chosen seats, each with its ticket type (a choice when several types on sale sell it) and a remove button
    function selectedSeats() {
        let chosen = Object.values(selection.seats);
        if (chosen.length === 0) {
            return null;
        }
        return (
            <div className="appBookingEventMapSelected appBookingEventSelectedSeats">
                { chosen.map( ({ seat, area, skuId }) => {
                    let types = typesForCategory(option, categoryOf(seat, area));
                    let current = ticketTypeById(option, skuId);
                    // the other types it can switch to: on sale, with room for one more unit of theirs
                    let otherSeats = { ...selection.seats };
                    delete otherSeats[seat.code];
                    let withoutThis = { ...selection, seats: otherSeats };
                    let choices = types.filter( type => (String(type.sku.id) === String(skuId))
                        || (roomForType(option, withoutThis, type, liveTypes) > 0) );
                    let seatName = seat.label || seat.code;
                    return (
                        <div key={seat.code} className="appBookingEventSelectedSeat" data-seat-code={seat.code}>
                            <span className="appBookingEventSelectedSeatLabel"> { seatName } </span>
                            { choices.length > 1
                                ? ( <select className="appBookingEventTicketTypeSelect" value={skuId}
                                            aria-label={text('events.ticketType.for', seatName)}
                                            onChange={ (e) => changeSeatType(seat.code, e.target.value) }>
                                        { choices.map( type => (
                                            <option key={type.sku.id} value={type.sku.id}> { type.sku.name + ' · ' + priceLabel(typePrice(type)) } </option>
                                        )) }
                                    </select> )
                                : ( <span className="appBookingEventSelectedSeatType appBookingTextNotImportant">
                                        { [ option.ticketTypes.length > 1 && current ? current.sku.name : null, current ? priceLabel(typePrice(current)) : null ].filter(Boolean).join(' · ') }
                                    </span> ) }
                            <button type="button" className="appBookingChip appBookingChipSelected appBookingEventMapSelectedSeat"
                                    aria-label={text('events.map.remove', seatName)} onClick={ () => toggleSeat(seat, area) }>
                                <span aria-hidden="true">×</span>
                            </button>
                        </div>
                    );
                }) }
            </div>
        );
    }

    function mapContentOf(areas) {
        let items = seatItems(areas);
        let missing = items.filter( item => !mapCodes.seats[item.seat.code] ).length;
        let standingAreas = areas.filter( area => area.kind === 'standing' );
        let hasSeats = items.length > 0;
        return (<>
            { hasSeats && mapLegend(areas) }
            <SeatMap classPrefix="appBookingEventMap" cleanMap={cleanMap} items={items} areas={areas}
                     stateOf={ item => seatState(item.seat, item.area) }
                     isSelected={ item => !!selection.seats[item.seat.code] }
                     canChoose={ item => canChooseSeat(item.seat, item.area) }
                     labelOf={ item => seatLabel(item.seat, item.area) }
                     detailsOf={ item => {
                         let { price, kindText, takenText } = seatInfo(item.seat, item.area);
                         return [ item.seat.label || item.seat.code, kindText, takenText || price ].filter(Boolean).join(' · ');
                     }}
                     extraSeatClassesOf={ item => markedSeatKinds.includes(item.seat.kind) ? [ 'appBookingEventMapSeat_kind_' + item.seat.kind ] : [] }
                     onSelect={ item => toggleSeat(item.seat, item.area) }
                     areaStateOf={ area => (area.kind === 'standing' ? standingFree(area) : freeSeatsOf(area)) > 0 ? 'free' : 'full' }
                     areaColorOf={ area => area.color }
                     extraAreaClassesOf={ area => [ 'appBookingEventMapArea_' + (area.kind === 'standing' ? 'standing' : 'seated') ] }
                     canChooseArea={ area => area.kind === 'standing' }
                     areaLabelOf={areaDetails} areaDetailsOf={areaDetails}
                     onSelectArea={goToStandingArea}
                     disabled={data.status === 'loading'}
                     hint={props.rawTextByKey(hasSeats ? 'events.map.hint' : 'events.map.hint.standing')} />
            { missing > 0 && (
                <div className="appBookingEventMapMissing appBookingTextNotImportant">
                    { text('events.map.missing', missing) }
                    { ' ' }
                    <button type="button" className="appBookingLinkButton" onClick={ () => setView('list') }>
                        { props.rawTextByKey('events.view.showList') }
                    </button>
                </div> ) }
            { standingAreas.length > 0 && (
                <div className="appBookingEventMapStanding">
                    { standingAreas.map( area => standingArea(area) ) }
                </div> ) }
        </>);
    }

    return (
        <div className="appBookingSeatContainer" ref={containerRef}>
            { selectionLine() }
            { props.notice && ( <div className="appBookingSlotNotice appBookingWarningText"> { props.notice } </div> ) }
            { areasContent() }
            { props.children }
        </div>
    );
}
