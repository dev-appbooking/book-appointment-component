import { useEffect, useState } from 'react';
import { httpRequest } from '../HttpRequest';
import { QuantityPicker } from './QuantityPicker.jsx';
import { priceLabel, typePrice, selectedUnits, selectionTotal, roomForType, isTypeAvailable, quotaLeft, lowestPrice } from './eventData.js';

/*
The number of places of an event with no venue, e.g. a training: one place covers every session. The
places left come from seating/availability (capacity - taken). There is a number of places per ticket type
(ABB-162), e.g. standard and early bird: the selection is { quantity: { serviceSkuId: places } }, at most
the lower of the event's maxSeatsPerBooking and the places left in all, and per type its maxPerBooking and
what is left of its quota.
props: apiBase, integrationId, option (the event and its ticket types), selection, onChangeSelection(selection),
onLiveTypes(liveTypes), ticketTypeStatus(type, liveTypes), refreshKey, notice, ltext, rawTextByKey.
*/
export function ChoosePlaces(props) {
    const option = props.option;
    const event = option.event;
    const selection = props.selection;
    const [ data, setData ] = useState({ status: 'loading', left: null, liveTypes: {} });

    useEffect(() => {
        let active = true;
        setData(prev => ({ ...prev, status: 'loading' }));
        httpRequest('POST', props.apiBase + '/api/integration/' + props.integrationId + '/seating/availability', { seatEventId: event.id }, { 'content-type': 'application/json' })
            .then( availability => {
                if (!active) {
                    return;
                }
                let capacity = (availability.capacity !== null && availability.capacity !== undefined) ? availability.capacity : event.capacity;
                let left = Math.max(0, (capacity || 0) - (availability.taken || 0));
                let liveTypes = availability.ticketTypes || {};
                setData({ status: 'success', left: left, liveTypes: liveTypes });
                if (props.onLiveTypes) {
                    props.onLiveTypes(liveTypes);
                }
                // the selection never asks for more than is left
                let quantity = { ...(selection.quantity || {}) };
                let changed = false;
                let excess = selectedUnits(selection) - left;
                Object.keys(quantity).reverse().forEach( skuId => {
                    let type = option.ticketTypes.find( item => String(item.sku.id) === String(skuId) );
                    let typeLeft = type ? quotaLeft(type, liveTypes) : null;
                    let value = quantity[skuId] || 0;
                    if ((typeLeft !== null) && (value > typeLeft)) {
                        excess -= value - typeLeft;
                        value = typeLeft;
                    }
                    if (excess > 0) {
                        let cut = Math.min(excess, value);
                        value -= cut;
                        excess -= cut;
                    }
                    if (value !== quantity[skuId]) {
                        quantity[skuId] = value;
                        changed = true;
                    }
                });
                if (changed) {
                    props.onChangeSelection({ ...selection, quantity }, true);
                }
            })
            .catch( () => {
                // the count is only a hint: the hold tells for sure
                if (active) {
                    setData({ status: 'error', left: null, liveTypes: {} });
                }
            });
        return () => { active = false; };
    }, [event.id, props.refreshKey]);

    function text(key, ...args) {
        return props.ltext.textValue(props.rawTextByKey(key), ...args);
    }

    const liveTypes = data.liveTypes;
    const maxPerBooking = event.maxSeatsPerBooking || 1;
    const units = selectedUnits(selection);
    const total = selectionTotal(option, selection);
    const several = option.ticketTypes.length > 1;

    function leftText() {
        if (data.status === 'loading') {
            return props.rawTextByKey('loading');
        }
        if (data.left === null) {
            return null;
        }
        return data.left > 0 ? text('events.places.left', data.left) : props.rawTextByKey('events.places.full');
    }

    function changeQuantity(type, value) {
        props.onChangeSelection({ ...selection, quantity: { ...(selection.quantity || {}), [type.sku.id]: value } });
    }

    function typeRow(type) {
        let current = (selection.quantity || {})[type.sku.id] || 0;
        let room = roomForType(option, selection, type, liveTypes);
        if (data.left !== null) {
            room = Math.min(room, Math.max(0, data.left - units));
        }
        let max = current + room;
        let available = isTypeAvailable(type, liveTypes);
        let status = available ? null : props.ticketTypeStatus(type, liveTypes);
        let left = quotaLeft(type, liveTypes);
        let info = [ text('events.event.perPlace', priceLabel(typePrice(type))), status,
                     (available && (left !== null)) ? text('events.ticketType.left', left) : null,
                     (available && type.maxPerBooking) ? text('events.ticketType.max', type.maxPerBooking) : null ].filter(Boolean).join(' · ');
        // with a single ticket type at least one place is chosen, as before ticket types existed
        let min = (!several && (max > 0)) ? 1 : 0;
        return (
            <div key={type.sku.id} className={"appBookingPlaces appBookingPlacesType" + (available ? "" : " appBookingTicketTypeUnavailable")} data-sku-id={type.sku.id}>
                <div className="appBookingPlacesInfo">
                    <span className="appBookingPlacesLabel"> { several ? type.sku.name : props.rawTextByKey('events.qty.label') } </span>
                    <span className="appBookingTextNotImportant appBookingPlacesLeft"> { info } </span>
                </div>
                <QuantityPicker value={current} min={min} max={max}
                                onChange={ (quantity) => changeQuantity(type, quantity) }
                                disabled={(max === 0) && (current === 0)}
                                label={(several ? type.sku.name + ': ' : '') + props.rawTextByKey('events.qty.label')}
                                decreaseLabel={props.rawTextByKey('events.qty.decrease')}
                                increaseLabel={props.rawTextByKey('events.qty.increase')} />
            </div>
        );
    }

    let fromPrice = lowestPrice(option.ticketTypes);

    return (
        <div className="appBookingPlacesContainer">
            <div className="appBookingPlacesInfo" aria-busy={data.status === 'loading'}>
                <span className={(data.left === 0 ? "appBookingWarningText " : "appBookingTextNotImportant ") + "appBookingPlacesLeft"}> { leftText() } </span>
            </div>
            { option.ticketTypes.map(typeRow) }
            <div className="appBookingPlacesPrice">
                { (!total && fromPrice) && <span className="appBookingTextNotImportant"> { text(fromPrice.several ? 'events.event.from' : 'events.event.perPlace', priceLabel(fromPrice)) } </span> }
                { total && <span className="appBookingPlacesTotal"> { text('events.tickets.total', priceLabel(total)) } </span> }
            </div>
            <div className="appBookingTextNotImportant appBookingPlacesHint"> { text('events.tickets.max.training', maxPerBooking) } </div>
            { props.notice && ( <div className="appBookingSlotNotice appBookingWarningText"> { props.notice } </div> ) }
            { props.children }
        </div>
    );
}
