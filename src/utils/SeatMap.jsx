import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';

/*
A venue's SVG map (layout.venue.mapContent), sanitised again before it is put in the page, as the API asks.
A <style> element is dropped: in an inline SVG it would restyle the whole host page.
Returns null when there is nothing usable to show.
*/
export function sanitizeSeatMap(mapContent) {
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

// the seat codes and area codes marked on the map: { seats: { code: true }, areas: { code: true } }
export function codesOfMap(cleanMap) {
    let codes = { seats: {}, areas: {} };
    if (!cleanMap) {
        return codes;
    }
    let doc = new DOMParser().parseFromString(cleanMap, 'image/svg+xml');
    doc.querySelectorAll('[data-seat-code]').forEach( element => { codes.seats[element.getAttribute('data-seat-code')] = true; });
    doc.querySelectorAll('[data-area-code]').forEach( element => { codes.areas[element.getAttribute('data-area-code')] = true; });
    return codes;
}

// removes the classes this component set before (they all start with the prefix)
function resetClasses(element, prefix) {
    Array.from(element.classList).filter( name => name.startsWith(prefix) ).forEach( name => element.classList.remove(name) );
}

function setButton(element, { label, selected, usable, focusable }) {
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', focusable ? '0' : '-1');
    element.setAttribute('aria-label', label);
    if (selected !== undefined) {
        element.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
    if (usable) {
        element.removeAttribute('aria-disabled');
    } else {
        element.setAttribute('aria-disabled', 'true');
    }
}

function clearButton(element) {
    [ 'role', 'tabindex', 'aria-label', 'aria-pressed', 'aria-disabled' ].forEach( name => element.removeAttribute(name) );
}

/*
An SVG seat map, shared by the desk and the event widgets. The class names start with classPrefix
(e.g. appBookingDeskMap, appBookingEventMap):
- the map: <prefix>Container, <prefix>, <prefix>Hint, <prefix>Details
- each element with a data-seat-code: <prefix>Seat, <prefix>Seat_<state> (or _unknown for a code that is not in
  items), <prefix>SeatSelected, plus extraSeatClassesOf(item)
- when areas are given, each element with a data-area-code (and no data-seat-code): <prefix>Area,
  <prefix>Area_<state> (or _unknown), plus extraAreaClassesOf(area)
A seat or area that can be chosen is a button: clicking it, or Enter / Space, calls onSelect(item) / onSelectArea(area).
props: classPrefix, cleanMap (from sanitizeSeatMap), items ([ { seat, area } ]), stateOf(item), isSelected(item),
canChoose(item), labelOf(item) (the accessible name), detailsOf(item) (the line shown while it is hovered or
focused), extraSeatClassesOf(item), onSelect(item);
areas, areaStateOf(area), areaColorOf(area) (a CSS colour, set as --appBookingMapAreaColor on the area's element),
canChooseArea(area), areaLabelOf(area), areaDetailsOf(area), extraAreaClassesOf(area),
onSelectArea(area); disabled, hint.
*/
export function SeatMap(props) {
    const prefix = props.classPrefix;
    const containerRef = useRef(null);
    const [ active, setActive ] = useState(null);
    const html = useMemo( () => ({ __html: props.cleanMap }), [props.cleanMap]);

    const itemByCode = {};
    (props.items || []).forEach( item => { itemByCode[item.seat.code] = item; });
    const areaByCode = {};
    (props.areas || []).forEach( area => { areaByCode[area.code] = area; });

    const canChoose = (item) => !props.disabled && !!item && props.canChoose(item);
    const canChooseArea = (area) => !props.disabled && !!area && !!props.canChooseArea && props.canChooseArea(area);

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

    // the state of each seat and area, after every render: availability and selection change without a new map
    useLayoutEffect(() => {
        if (!containerRef.current) {
            return;
        }
        containerRef.current.querySelectorAll('[data-seat-code]').forEach( element => {
            let item = itemByCode[element.getAttribute('data-seat-code')];
            resetClasses(element, prefix + 'Seat');
            element.classList.add(prefix + 'Seat');
            if (!item) {
                element.classList.add(prefix + 'Seat_unknown');
                clearButton(element);
                return;
            }
            let selected = !!props.isSelected(item);
            let state = props.stateOf(item);
            element.classList.add(prefix + 'Seat_' + state);
            if (selected) {
                element.classList.add(prefix + 'SeatSelected');
            }
            (props.extraSeatClassesOf ? props.extraSeatClassesOf(item) : []).forEach( name => element.classList.add(name) );
            let usable = canChoose(item);
            setButton(element, { label: props.labelOf(item), selected, usable, focusable: usable || selected });
        });
        if (!props.areas) {
            return;
        }
        containerRef.current.querySelectorAll('[data-area-code]:not([data-seat-code])').forEach( element => {
            let area = areaByCode[element.getAttribute('data-area-code')];
            resetClasses(element, prefix + 'Area');
            element.classList.add(prefix + 'Area');
            if (!area) {
                element.classList.add(prefix + 'Area_unknown');
                clearButton(element);
                return;
            }
            element.classList.add(prefix + 'Area_' + props.areaStateOf(area));
            let color = props.areaColorOf ? props.areaColorOf(area) : null;
            if (color && window.CSS && CSS.supports('color', color)) {
                element.style.setProperty('--appBookingMapAreaColor', color);
            } else {
                element.style.removeProperty('--appBookingMapAreaColor');
            }
            (props.extraAreaClassesOf ? props.extraAreaClassesOf(area) : []).forEach( name => element.classList.add(name) );
            // only an area that can be chosen is a button: a seated area holds the seat buttons
            if (props.onSelectArea && props.canChooseArea && props.canChooseArea(area)) {
                let usable = canChooseArea(area);
                setButton(element, { label: props.areaLabelOf(area), usable, focusable: usable });
            } else {
                clearButton(element);
            }
        });
    });

    // the seat, or else the area, the event happened on: { kind: 'seat', item } | { kind: 'area', area } | null
    function targetOfEvent(e) {
        let target = e.target && e.target.closest ? e.target : null;
        if (!target || !containerRef.current) {
            return null;
        }
        let seatElement = target.closest('[data-seat-code]');
        if (seatElement && containerRef.current.contains(seatElement)) {
            let item = itemByCode[seatElement.getAttribute('data-seat-code')];
            return item ? { kind: 'seat', code: item.seat.code, item } : null;
        }
        if (!props.areas) {
            return null;
        }
        let areaElement = target.closest('[data-area-code]');
        if (areaElement && containerRef.current.contains(areaElement)) {
            let area = areaByCode[areaElement.getAttribute('data-area-code')];
            return area ? { kind: 'area', code: area.code, area } : null;
        }
        return null;
    }

    function choose(target) {
        if (!target) {
            return false;
        }
        if ((target.kind === 'seat') && canChoose(target.item) && props.onSelect) {
            props.onSelect(target.item);
            return true;
        }
        if ((target.kind === 'area') && canChooseArea(target.area) && props.onSelectArea) {
            props.onSelectArea(target.area);
            return true;
        }
        return false;
    }

    function onKeyDown(e) {
        if ((e.key === 'Enter') || (e.key === ' ')) {
            let target = targetOfEvent(e);
            if (target) {
                e.preventDefault();
                choose(target);
            }
        }
    }

    function onPoint(e) {
        let target = targetOfEvent(e);
        setActive(target ? { kind: target.kind, code: target.code } : null);
    }

    function detailsText() {
        if (!active) {
            return ' ';
        }
        if (active.kind === 'seat') {
            let item = itemByCode[active.code];
            return item ? props.detailsOf(item) : ' ';
        }
        let area = areaByCode[active.code];
        return (area && props.areaDetailsOf) ? props.areaDetailsOf(area) : ' ';
    }

    return (
        <div className={prefix + 'Container'}>
            { props.hint && <div className={prefix + 'Hint appBookingTextNotImportant'}> { props.hint } </div> }
            <div ref={containerRef} className={prefix} dangerouslySetInnerHTML={html}
                 onClick={ e => choose(targetOfEvent(e)) } onKeyDown={onKeyDown}
                 onMouseOver={onPoint} onFocus={onPoint}
                 onMouseLeave={ () => setActive(null) } onBlur={ () => setActive(null) }>
            </div>
            <div className={prefix + 'Details'} aria-hidden="true">
                { detailsText() }
            </div>
        </div>
    );
}
