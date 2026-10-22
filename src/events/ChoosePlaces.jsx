import { useEffect, useState } from 'react';
import { httpRequest } from '../HttpRequest';
import { QuantityPicker } from './QuantityPicker.jsx';
import { unitPrice, priceLabel, sumPrices } from './eventData.js';

/*
The number of places of an event with no venue, e.g. a training: one place covers every session. The
places left come from seating/availability (capacity - taken). The selection is { quantity }, at most the
lower of the event's maxSeatsPerBooking and the places left.
props: apiBase, integrationId, option (the sku and event), selection, onChangeSelection(selection),
refreshKey, notice, ltext, rawTextByKey.
*/
export function ChoosePlaces(props) {
    const option = props.option;
    const event = option.event;
    const selection = props.selection;
    const [ data, setData ] = useState({ status: 'loading', left: null });

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
                setData({ status: 'success', left: left });
                // the selection never asks for more than is left
                if ((selection.quantity || 0) > left) {
                    props.onChangeSelection({ ...selection, quantity: left }, true);
                }
            })
            .catch( () => {
                // the count is only a hint: the hold tells for sure
                if (active) {
                    setData({ status: 'error', left: null });
                }
            });
        return () => { active = false; };
    }, [event.id, props.refreshKey]);

    function text(key, ...args) {
        return props.ltext.textValue(props.rawTextByKey(key), ...args);
    }

    const maxPerBooking = event.maxSeatsPerBooking || 1;
    const max = (data.left === null) ? maxPerBooking : Math.min(maxPerBooking, data.left);
    const price = unitPrice(option, null);
    const total = sumPrices(Array.from({ length: selection.quantity || 0 }, () => price));

    function leftText() {
        if (data.status === 'loading') {
            return props.rawTextByKey('loading');
        }
        if (data.left === null) {
            return null;
        }
        return data.left > 0 ? text('events.places.left', data.left) : props.rawTextByKey('events.places.full');
    }

    return (
        <div className="appBookingPlacesContainer">
            <div className="appBookingPlaces" aria-busy={data.status === 'loading'}>
                <div className="appBookingPlacesInfo">
                    <span className="appBookingPlacesLabel"> { props.rawTextByKey('events.qty.label') } </span>
                    <span className={(data.left === 0 ? "appBookingWarningText " : "appBookingTextNotImportant ") + "appBookingPlacesLeft"}> { leftText() } </span>
                </div>
                <QuantityPicker value={selection.quantity || 0} min={max > 0 ? 1 : 0} max={max}
                                onChange={ (quantity) => props.onChangeSelection({ ...selection, quantity }) }
                                disabled={max === 0}
                                label={props.rawTextByKey('events.qty.label')}
                                decreaseLabel={props.rawTextByKey('events.qty.decrease')}
                                increaseLabel={props.rawTextByKey('events.qty.increase')} />
                <div className="appBookingPlacesPrice">
                    <span className="appBookingTextNotImportant"> { text('events.event.perPlace', priceLabel(price)) } </span>
                    { total && <span className="appBookingPlacesTotal"> { text('events.tickets.total', priceLabel(total)) } </span> }
                </div>
            </div>
            <div className="appBookingTextNotImportant appBookingPlacesHint"> { text('events.tickets.max.training', maxPerBooking) } </div>
            { props.notice && ( <div className="appBookingSlotNotice appBookingWarningText"> { props.notice } </div> ) }
            { props.children }
        </div>
    );
}
