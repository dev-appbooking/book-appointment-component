import { useEffect, useRef, useState } from 'react';
import { httpRequest } from '../HttpRequest';
import { weekDayLabels } from '../MonthlyCalendar.jsx';
import { LeftArrowIcon, RightArrowIcon } from '../utils/Utils';
import { formatLocalizedDayMonth } from '../utils/formatters';
import { maxDeskDays, dayKeyOf, dateOfDayKey, addDaysToKey, todayKeyIn, addMinutesToTime, freeDesksPerDay } from './deskData.js';

// the parts of the day the start times are grouped in, by the hour they start before
const dayParts = [ { id: 'morning', untilHour: 12 }, { id: 'afternoon', untilHour: 17 }, { id: 'evening', untilHour: 24 } ];

// waits for the customer to stop clicking days before asking for the start times
const timesDelayMs = 350;

function monthKeyOf(dayKey) {
    return dayKey.slice(0, 7) + '-01';
}

function addMonthsToKey(monthKey, months) {
    let date = dateOfDayKey(monthKey);
    date.setMonth(date.getMonth() + months);
    return dayKeyOf(date);
}

function lastDayOfMonthKey(monthKey) {
    let date = dateOfDayKey(monthKey);
    return dayKeyOf(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

/*
The days and start time of a desk booking. The calendar picks several days (at most maxDeskDays) and shows
the days with a free desk, from seating/availability/summary. The start times on offer on every chosen
day come from seating/availability/times; choosing one calls onSelectTime(timeItem, days), where
timeItem = { time, starts, free } and starts holds the UTC start of each day, in the order of days.
props: apiBase, integrationId, option (the service and floor), selectedDays (sorted plain days),
selectedTime, onChangeDays(days), onSelectTime, refreshKey, ltext, rawTextByKey.
*/
export function ChooseDeskDays(props) {
    const ltext = props.ltext;
    const option = props.option;
    const timeZone = option.venue.timeZone;
    const todayKey = todayKeyIn(timeZone);
    const lastKey = addDaysToKey(todayKey, option.horizonDays);
    const selectedDays = props.selectedDays || [];

    const [ monthKey, setMonthKey ] = useState(monthKeyOf(selectedDays[0] || todayKey));
    // per month: { status: 'loading' | 'success' | 'error', free: { dayKey: count } }
    const [ summaries, setSummaries ] = useState({});
    const [ times, setTimes ] = useState({ status: 'idle', daysKey: '', data: null });
    const timesRequestRef = useRef(0);

    const daysKey = selectedDays.join(',');

    useEffect(() => {
        setSummaries({});
    }, [option.id, props.refreshKey]);

    useEffect(() => {
        if (summaries[monthKey]) {
            return;
        }
        let from = monthKey < todayKey ? todayKey : monthKey;
        let monthEnd = lastDayOfMonthKey(monthKey);
        let to = monthEnd > lastKey ? lastKey : monthEnd;
        if (from > to) {
            setSummaries(prev => ({ ...prev, [monthKey]: { status: 'success', free: {} } }));
            return;
        }
        setSummaries(prev => ({ ...prev, [monthKey]: { status: 'loading', free: {} } }));
        let body = { serviceSkuId: option.sku.id, venueId: option.venue.id, from: from, to: to };
        httpRequest('POST', props.apiBase + '/api/integration/' + props.integrationId + '/seating/availability/summary', body, { 'content-type': 'application/json' })
            .then( summary => setSummaries(prev => ({ ...prev, [monthKey]: { status: 'success', free: freeDesksPerDay(summary, option.venue.id) } })) )
            .catch( () => setSummaries(prev => ({ ...prev, [monthKey]: { status: 'error', free: {} } })) );
    }, [monthKey, summaries, option.id]);

    useEffect(() => {
        let requestId = ++timesRequestRef.current;
        if (selectedDays.length === 0) {
            setTimes({ status: 'idle', daysKey: '', data: null });
            return;
        }
        setTimes(prev => ({ ...prev, status: 'loading', daysKey: daysKey }));
        let timer = setTimeout(() => {
            let body = { serviceSkuId: option.sku.id, venueId: option.venue.id, dates: selectedDays };
            httpRequest('POST', props.apiBase + '/api/integration/' + props.integrationId + '/seating/availability/times', body, { 'content-type': 'application/json' })
                .then( data => {
                    if (requestId === timesRequestRef.current) {
                        setTimes({ status: 'success', daysKey: daysKey, data: data });
                    }
                })
                .catch( () => {
                    if (requestId === timesRequestRef.current) {
                        setTimes({ status: 'error', daysKey: daysKey, data: null });
                    }
                });
        }, timesDelayMs);
        return () => clearTimeout(timer);
    }, [daysKey, option.id, props.refreshKey]);

    function text(key, ...args) {
        return ltext.textValue(props.rawTextByKey(key), ...args);
    }

    function freeOn(dayKey) {
        let summary = summaries[monthKeyOf(dayKey)];
        return (summary && (dayKey in summary.free)) ? summary.free[dayKey] : null;
    }

    function onToggleDay(dayKey) {
        let days;
        if (selectedDays.includes(dayKey)) {
            days = selectedDays.filter( day => day !== dayKey );
        } else {
            if (selectedDays.length >= maxDeskDays) {
                return;
            }
            days = selectedDays.concat([dayKey]).sort();
        }
        props.onChangeDays(days);
    }

    function dayButton(dayKey, inMonth) {
        let date = dateOfDayKey(dayKey);
        if (!inMonth) {
            return ( <div key={dayKey} className="appBookingCalDay"> <button type="button" disabled className="appBookingCalDayBtn appBookingCalDayBtnOtherMonth"> { date.getDate() } </button> </div> );
        }
        let isSelected = selectedDays.includes(dayKey);
        let free = freeOn(dayKey);
        let inRange = (dayKey >= todayKey) && (dayKey <= lastKey);
        let isAvailable = inRange && (free !== null) && (free > 0);
        let full = selectedDays.length >= maxDeskDays;
        let classValue = "appBookingCalDayBtn" + (isAvailable ? " appBookingCalDayBtnAvailable" : "") + (isSelected ? " appBookingCalDayBtnSelected" : "");
        let freeText = (free === null) ? '' : (free > 0 ? text('desk.days.free', free) : props.rawTextByKey('desk.days.noneFree'));
        let label = formatLocalizedDayMonth(date, ltext.locale) + (freeText ? ', ' + freeText : '');
        return (
            <div key={dayKey} className="appBookingCalDay">
                <button type="button" className={classValue} aria-pressed={isSelected} aria-label={label} title={freeText || undefined}
                        disabled={!isSelected && (!isAvailable || full)} onClick={ () => onToggleDay(dayKey) }>
                    { date.getDate() }
                </button>
            </div>
        );
    }

    function calendar() {
        let monthDate = dateOfDayKey(monthKey);
        let startOffset = (monthDate.getDay() + 6) % 7;
        let firstShown = addDaysToKey(monthKey, -startOffset);
        let monthEnd = lastDayOfMonthKey(monthKey);
        let cells = [];
        let dayKey = firstShown;
        while ((dayKey <= monthEnd) || (cells.length % 7 !== 0)) {
            cells.push({ dayKey, inMonth: (dayKey >= monthKey) && (dayKey <= monthEnd) });
            dayKey = addDaysToKey(dayKey, 1);
        }
        let canGoBack = monthKey > monthKeyOf(todayKey);
        let canGoForward = addMonthsToKey(monthKey, 1) <= lastKey;
        let summary = summaries[monthKey];
        return (
            <div className="appBookingCal appBookingDeskCal" aria-busy={summary && summary.status === 'loading'}>
                <div className="appBookingCalHeader">
                    <button type="button" aria-label="<" className="appBookingCalNavBtn" disabled={!canGoBack} onClick={ () => setMonthKey(addMonthsToKey(monthKey, -1)) }> <div className="appBookingCalNavIcon"> <LeftArrowIcon /> </div> </button>
                    <div className="appBookingCalHeaderText"> { ltext.text('cal.month.' + monthDate.getMonth()) } { monthDate.getFullYear() } </div>
                    <button type="button" aria-label=">" className="appBookingCalNavBtn" disabled={!canGoForward} onClick={ () => setMonthKey(addMonthsToKey(monthKey, 1)) }> <div className="appBookingCalNavIcon"> <RightArrowIcon /> </div> </button>
                </div>
                <div className="appBookingCalDays appBookingCalWeekDays">
                    { weekDayLabels(ltext).map( day => ( <div key={day} className="appBookingCalDay"> { day } </div> )) }
                </div>
                <div className="appBookingCalDays">
                    { cells.map( cell => dayButton(cell.dayKey, cell.inMonth) ) }
                </div>
                { summary && summary.status === 'error' && <div className="appBookingErrorText appBookingDeskCalError"> { props.rawTextByKey('error.generic') } </div> }
            </div>
        );
    }

    function selectionLine() {
        return (
            <div className="appBookingDeskDaysSelection">
                <span className="appBookingTextNotImportant">
                    { selectedDays.length >= maxDeskDays ? props.rawTextByKey('desk.days.max') : text('desk.days.hint', maxDeskDays) }
                </span>
                { selectedDays.length > 0 && (
                    <span className="appBookingDeskDaysCount">
                        { text('desk.days.selected', selectedDays.length) }
                        <button type="button" className="appBookingLinkButton" onClick={ () => props.onChangeDays([]) }> { props.rawTextByKey('desk.days.clear') } </button>
                    </span>
                ) }
            </div>
        );
    }

    function loadingTimes() {
        return (
            <div className="appBookingTimeSlotsContainer appBookingLoading" aria-busy="true">
                <div className="appBookingDateLine appBookingTextNotImportant"> { props.rawTextByKey('loading') } </div>
                <div className="appBookingTimeSlotsGrid">
                    { [0, 1, 2, 3, 4, 5].map( index => ( <div key={index} className="appBookingSkeleton appBookingTimeSlotSkeleton"></div> )) }
                </div>
            </div>
        );
    }

    function timesContent() {
        if (selectedDays.length === 0) {
            return ( <div className="appBookingTimeSlotsContainer appBookingTextNotImportant"> { props.rawTextByKey('desk.days.none') } </div> );
        }
        if ((times.status === 'loading') || (times.daysKey !== daysKey)) {
            return loadingTimes();
        }
        if (times.status === 'error') {
            return ( <div className="appBookingTimeSlotsContainer appBookingErrorText"> { props.rawTextByKey('error.generic') } </div> );
        }
        let items = (times.data && times.data.times) || [];
        if (items.length === 0) {
            return ( <div className="appBookingTimeSlotsContainer"> <span className="appBookingWarningText"> { props.rawTextByKey('desk.times.noTimes') } </span> </div> );
        }
        let duration = times.data.duration || option.sku.duration;
        const isSelected = (item) => !!props.selectedTime && (props.selectedTime.time === item.time);
        let groups = dayParts.map( part => ({ ...part, items: [] }) );
        items.forEach( item => {
            let hour = parseInt(item.time.split(':')[0], 10);
            groups.find( group => hour < group.untilHour ).items.push(item);
        });
        return (
            <div className="appBookingTimeSlotsContainer">
                <div className="appBookingDateLine"> { props.rawTextByKey('desk.times.title') } </div>
                { groups.filter( group => group.items.length > 0 ).map( group => (
                    <div key={group.id} className={"appBookingTimeSlotsGroup appBookingTimeSlotsGroup_" + group.id}>
                        <div className="appBookingTimeSlotsGroupLabel"> { props.rawTextByKey('step.slot.' + group.id) } </div>
                        <div className="appBookingTimeSlotsGrid">
                            { group.items.map( item => (
                                <button key={item.time} type="button" disabled={!(item.free > 0)} aria-pressed={isSelected(item)}
                                        className={"appBookingTimeSlotButton appBookingDeskTimeButton" + (isSelected(item) ? " appBookingTimeSlotSelectedButton" : "")}
                                        title={text('desk.times.range', item.time, addMinutesToTime(item.time, duration))}
                                        onClick={ () => props.onSelectTime({ ...item, duration: duration }, selectedDays) }>
                                    <span className="appBookingDeskTimeValue"> { item.time } </span>
                                    <span className="appBookingDeskTimeFree"> { item.free > 0 ? text('desk.times.free', item.free) : props.rawTextByKey('desk.times.noneFree') } </span>
                                </button>
                            )) }
                        </div>
                    </div>
                )) }
            </div>
        );
    }

    return (
        <div className="appBookingChooseDateContainer appBookingDeskDays">
            { selectionLine() }
            <div className="appBookingChooseDate">
                <div className="appBookingDeskDaysCal"> { calendar() } </div>
                <div className="appBookingChooseDateSlots"> { timesContent() } </div>
            </div>
            { props.children }
        </div>
    );
}
