import { SeatMap, sanitizeSeatMap, codesOfMap } from '../utils/SeatMap.jsx';

export { sanitizeSeatMap as sanitizeDeskMap };

// the desk codes marked on the map
export function seatCodesOfMap(cleanMap) {
    return codesOfMap(cleanMap).seats;
}

/*
The floor map. Each element with a data-seat-code is a desk: it gets the appBookingDeskMapSeat class plus its
state (_free, _taken, _closed, or _unknown for a code that is not in the layout) and
appBookingDeskMapSeatSelected. A free desk is a button: clicking it, or Enter / Space, calls onSelectDesk(desk).
props: cleanMap (from sanitizeDeskMap), desks ([ { seat, area } ]), stateOf(seat), selectedSeatCode,
labelOf(desk) (the accessible name), detailsOf(desk) (the line shown while the desk is hovered or focused),
disabled, hint, onSelectDesk.
*/
export function DeskMap(props) {
    return (
        <SeatMap classPrefix="appBookingDeskMap" cleanMap={props.cleanMap} items={props.desks}
                 stateOf={ desk => props.stateOf(desk.seat) }
                 isSelected={ desk => !!props.selectedSeatCode && (props.selectedSeatCode === desk.seat.code) }
                 canChoose={ desk => props.stateOf(desk.seat) === 'free' }
                 labelOf={props.labelOf} detailsOf={props.detailsOf}
                 disabled={props.disabled} hint={props.hint} onSelect={props.onSelectDesk} />
    );
}
