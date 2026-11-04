import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';

const stateClasses = [ 'appBookingDeskMapSeat_free', 'appBookingDeskMapSeat_taken', 'appBookingDeskMapSeat_closed',
                       'appBookingDeskMapSeat_unknown', 'appBookingDeskMapSeatSelected' ];

/*
The venue's SVG map (layout.venue.mapContent), sanitised again before it is put in the page, as the API asks.
A <style> element is dropped: in an inline SVG it would restyle the whole host page.
Returns null when there is nothing usable to show.
*/
export function sanitizeDeskMap(mapContent) {
    if (!mapContent || (typeof mapContent !== 'string')) {
        return null;
    }
    let clean = DOMPurify.sanitize(mapContent, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: [ 'style', 'foreignObject' ],
        ALLOW_DATA_ATTR: true
    });
    return /<svg[\s>]/i.test(clean) ? clean : null;
}

// the codes marked on the map
export function seatCodesOfMap(cleanMap) {
    let codes = {};
    if (!cleanMap) {
        return codes;
    }
    let doc = new DOMParser().parseFromString(cleanMap, 'image/svg+xml');
    doc.querySelectorAll('[data-seat-code]').forEach( element => { codes[element.getAttribute('data-seat-code')] = true; });
    return codes;
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
    const containerRef = useRef(null);
    const [ activeCode, setActiveCode ] = useState(null);
    const html = useMemo( () => ({ __html: props.cleanMap }), [props.cleanMap]);

    const deskByCode = {};
    (props.desks || []).forEach( desk => { deskByCode[desk.seat.code] = desk; });

    // an SVG with a width and a height but no viewBox would not scale with the widget
    useLayoutEffect(() => {
        let svg = containerRef.current && containerRef.current.querySelector('svg');
        if (svg && !svg.getAttribute('viewBox')) {
            let width = parseFloat(svg.getAttribute('width'));
            let height = parseFloat(svg.getAttribute('height'));
            if ((width > 0) && (height > 0)) {
                svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
            }
        }
        if (svg) {
            svg.setAttribute('focusable', 'false');
            svg.removeAttribute('width');
            svg.removeAttribute('height');
        }
    }, [props.cleanMap]);

    // the state of each desk, after every render: availability and selection change without a new map
    useLayoutEffect(() => {
        if (!containerRef.current) {
            return;
        }
        containerRef.current.querySelectorAll('[data-seat-code]').forEach( element => {
            let desk = deskByCode[element.getAttribute('data-seat-code')];
            element.classList.remove(...stateClasses);
            element.classList.add('appBookingDeskMapSeat');
            if (!desk) {
                element.classList.add('appBookingDeskMapSeat_unknown');
                element.removeAttribute('role');
                element.removeAttribute('tabindex');
                element.removeAttribute('aria-label');
                return;
            }
            let state = props.stateOf(desk.seat);
            let isSelected = !!props.selectedSeatCode && (props.selectedSeatCode === desk.seat.code);
            let usable = (state === 'free') && !props.disabled;
            element.classList.add('appBookingDeskMapSeat_' + state);
            if (isSelected) {
                element.classList.add('appBookingDeskMapSeatSelected');
            }
            element.setAttribute('role', 'button');
            element.setAttribute('tabindex', state === 'free' ? '0' : '-1');
            element.setAttribute('aria-label', props.labelOf(desk));
            element.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            if (usable) {
                element.removeAttribute('aria-disabled');
            } else {
                element.setAttribute('aria-disabled', 'true');
            }
        });
    });

    function deskOfEvent(e) {
        let element = e.target && e.target.closest ? e.target.closest('[data-seat-code]') : null;
        if (!element || !containerRef.current || !containerRef.current.contains(element)) {
            return null;
        }
        return deskByCode[element.getAttribute('data-seat-code')] || null;
    }

    function choose(desk) {
        if (desk && !props.disabled && (props.stateOf(desk.seat) === 'free') && props.onSelectDesk) {
            props.onSelectDesk(desk);
        }
    }

    function onKeyDown(e) {
        if ((e.key === 'Enter') || (e.key === ' ')) {
            let desk = deskOfEvent(e);
            if (desk) {
                e.preventDefault();
                choose(desk);
            }
        }
    }

    function onPoint(e) {
        let desk = deskOfEvent(e);
        setActiveCode(desk ? desk.seat.code : null);
    }

    let activeDesk = activeCode ? deskByCode[activeCode] : null;
    return (
        <div className="appBookingDeskMapContainer">
            { props.hint && <div className="appBookingDeskMapHint appBookingTextNotImportant"> { props.hint } </div> }
            <div ref={containerRef} className="appBookingDeskMap" dangerouslySetInnerHTML={html}
                 onClick={ e => choose(deskOfEvent(e)) } onKeyDown={onKeyDown}
                 onMouseOver={onPoint} onFocus={onPoint}
                 onMouseLeave={ () => setActiveCode(null) } onBlur={ () => setActiveCode(null) }>
            </div>
            <div className="appBookingDeskMapDetails" aria-hidden="true">
                { activeDesk ? props.detailsOf(activeDesk) : ' ' }
            </div>
        </div>
    );
}
