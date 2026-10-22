import { useEffect, useState } from 'react';
import { httpRequest } from '../HttpRequest';
import { deskPrice, priceLabel, desksOfLayout, deskAttributesText } from './deskData.js';

// the layouts already loaded, by venue and layout version: a layout only changes with its version
const layoutCache = {};

function loadLayout(apiBase, integrationId, venue) {
    let cacheKey = venue.id + ':' + venue.layoutVersion;
    if (!layoutCache[cacheKey]) {
        layoutCache[cacheKey] = httpRequest('GET', apiBase + '/api/integration/' + integrationId + '/seating/venue/' + encodeURIComponent(venue.id) + '/layout')
            .catch( e => {
                delete layoutCache[cacheKey];
                throw e;
            });
    }
    return layoutCache[cacheKey];
}

/*
The desks of the floor, grouped by area. A desk that is taken or closed on at least one of the chosen days
can't be chosen. Choosing a desk calls onSelectDesk({ seat, area }).
props: apiBase, integrationId, option (the service and floor), starts (the UTC start of each chosen day),
heldSeatCode (the desk this customer holds: it shows as taken in the availability, but is theirs),
selectedSeatCode, refreshKey, notice, ltext, rawTextByKey.
*/
export function ChooseDesk(props) {
    const option = props.option;
    const [ data, setData ] = useState({ status: 'loading', layout: null, taken: {} });
    const startsKey = (props.starts || []).join(',');

    useEffect(() => {
        let active = true;
        setData(prev => ({ ...prev, status: 'loading' }));
        let body = { serviceSkuId: option.sku.id, venueId: option.venue.id, intervals: props.starts };
        Promise.all([
            loadLayout(props.apiBase, props.integrationId, option.venue),
            httpRequest('POST', props.apiBase + '/api/integration/' + props.integrationId + '/seating/availability/seats', body, { 'content-type': 'application/json' })
        ]).then( ([ layout, availability ]) => {
            if (!active) {
                return;
            }
            let taken = {};
            (availability.closed || []).forEach( code => { taken[code] = 'closed'; });
            (availability.taken || []).forEach( code => { taken[code] = 'taken'; });
            setData({ status: 'success', layout: layout, taken: taken });
        }).catch( () => {
            if (active) {
                setData({ status: 'error', layout: null, taken: {} });
            }
        });
        return () => { active = false; };
    }, [option.id, startsKey, props.refreshKey]);

    function text(key, ...args) {
        return props.ltext.textValue(props.rawTextByKey(key), ...args);
    }

    function stateOf(seat) {
        if (props.heldSeatCode && (seat.code === props.heldSeatCode)) {
            return 'free';
        }
        return data.taken[seat.code] || 'free';
    }

    function select(desk) {
        if (props.onSelectDesk) {
            props.onSelectDesk(desk);
        }
    }

    function deskButton(desk) {
        let { seat, area } = desk;
        let state = stateOf(seat);
        let isSelected = !!props.selectedSeatCode && (props.selectedSeatCode === seat.code);
        let price = priceLabel(deskPrice(option, seat.priceCategory || area.priceCategory));
        let attributes = deskAttributesText(seat.attributes);
        let stateText = state === 'free' ? null : props.rawTextByKey('desk.seat.' + state);
        let classValue = "appBookingDeskButton appBookingDeskButton_" + state + (isSelected ? " appBookingDeskButtonSelected" : "");
        let label = [ seat.label || seat.code, seat.kind === 'standing_desk' ? props.rawTextByKey('desk.seat.standing') : null,
                      attributes.join(', '), price, stateText ].filter(Boolean).join(', ');
        return (
            <button key={seat.code} type="button" className={classValue} data-seat-code={seat.code} disabled={state !== 'free'}
                    aria-pressed={isSelected} aria-label={label} onClick={ () => select(desk) }>
                <span className="appBookingDeskLabel"> { seat.seatNumber || seat.label || seat.code } </span>
                { seat.kind === 'standing_desk' && <span className="appBookingDeskKind"> { props.rawTextByKey('desk.seat.standing') } </span> }
                { attributes.length > 0 && <span className="appBookingDeskAttrs"> { attributes.join(' · ') } </span> }
                <span className="appBookingDeskPrice"> { stateText || price } </span>
            </button>
        );
    }

    function loadingContent() {
        return (
            <div className="appBookingDeskGrid appBookingLoading" aria-busy="true">
                { [0, 1, 2, 3, 4, 5, 6, 7].map( index => ( <div key={index} className="appBookingSkeleton appBookingDeskSkeleton"></div> )) }
            </div>
        );
    }

    function desksContent() {
        if (data.status === 'loading' && !data.layout) {
            return loadingContent();
        }
        if (data.status === 'error') {
            return ( <div className="appBookingErrorText appBookingMessage"> { props.rawTextByKey('error.generic') } </div> );
        }
        let desks = desksOfLayout(data.layout);
        let freeDesks = desks.filter( desk => stateOf(desk.seat) === 'free' );
        let areas = ((data.layout && data.layout.areas) || []).filter( area => (area.seats || []).length > 0 );
        return (
            <div className="appBookingDeskAreas" aria-busy={data.status === 'loading'}>
                { freeDesks.length === 0
                    ? <div className="appBookingWarningText"> { props.rawTextByKey('desk.seat.noneFree') } </div>
                    : <div className="appBookingDeskAny">
                          <button type="button" className="appBookingSecondaryButton" disabled={data.status === 'loading'} onClick={ () => select(freeDesks[0]) }>
                              { props.rawTextByKey('desk.seat.any') }
                          </button>
                      </div> }
                { areas.map( area => (
                    <div key={area.code} className="appBookingDeskArea" data-area-code={area.code}>
                        <div className="appBookingDeskAreaHeader">
                            { area.color && <span className="appBookingDeskAreaColor" style={{ backgroundColor: area.color }} aria-hidden="true"></span> }
                            <span className="appBookingDeskAreaName"> { area.name || area.code } </span>
                            <span className="appBookingDeskAreaFree appBookingTextNotImportant">
                                { text('desk.times.free', area.seats.filter( seat => stateOf(seat) === 'free' ).length) }
                            </span>
                        </div>
                        <div className="appBookingDeskGrid">
                            { area.seats.map( seat => deskButton({ seat, area }) ) }
                        </div>
                    </div>
                )) }
            </div>
        );
    }

    return (
        <div className="appBookingDeskContainer">
            { desksContent() }
            { props.notice && ( <div className="appBookingSlotNotice appBookingWarningText"> { props.notice } </div> ) }
            { props.children }
        </div>
    );
}
