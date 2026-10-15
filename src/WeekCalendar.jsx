import { addDays, differenceInCalendarDays, endOfWeek, getMonth, getYear, isEqual, startOfDay, startOfWeek } from "date-fns";
import { useEffect, useRef, useState } from "react";
import { LeftArrowIcon, RightArrowIcon } from "./utils/Utils";
import { weekDayLabels } from "./MonthlyCalendar.jsx";

/*
A row of days, one week wide, that is swiped sideways from week to week: the short alternative to the
monthly calendar on narrow layouts. It spans the weeks from today to the last available day.
props: availableDays (start of day dates), selectedDate, onSelectDay(date), ltext, rawTextByKey.
*/
export function WeekCalendar(props) {
    const ltext = props.ltext;
    const rowRef = useRef(null);
    const [ visibleWeek, setVisibleWeek ] = useState(0);

    const availableDays = props.availableDays || [];
    const firstDay = startOfWeek(startOfDay(new Date()), { weekStartsOn: 1 });
    const lastAvailable = availableDays.length > 0 ? availableDays[availableDays.length - 1] : firstDay;
    const lastDay = endOfWeek(lastAvailable > firstDay ? lastAvailable : firstDay, { weekStartsOn: 1 });
    const daysCount = differenceInCalendarDays(lastDay, firstDay) + 1;
    const weeksCount = Math.ceil(daysCount / 7);

    let days = [];
    for (let x = 0; x < daysCount; x++) {
        days.push(addDays(firstDay, x));
    }

    const labels = weekDayLabels(ltext);
    const selectedDate = props.selectedDate ? startOfDay(props.selectedDate) : null;
    const selectedWeek = selectedDate ? Math.floor(differenceInCalendarDays(selectedDate, firstDay) / 7) : 0;

    function weekWidth() {
        let row = rowRef.current;
        let gap = parseFloat(window.getComputedStyle(row).columnGap) || 0;
        return row.clientWidth + gap;
    }

    function scrollToWeek(week, smooth) {
        let row = rowRef.current;
        if (!row) {
            return;
        }
        row.scrollTo({ left: week * weekWidth(), behavior: smooth ? 'smooth' : 'auto' });
    }

    // the week of the selected day is the one shown
    useEffect(() => {
        if ((selectedWeek >= 0) && (selectedWeek < weeksCount)) {
            scrollToWeek(selectedWeek, false);
            setVisibleWeek(selectedWeek);
        }
    }, [ selectedDate ? selectedDate.getTime() : null, weeksCount ]);

    function onScroll() {
        let row = rowRef.current;
        if (row && row.clientWidth > 0) {
            setVisibleWeek(Math.min(weeksCount - 1, Math.max(0, Math.round(row.scrollLeft / weekWidth()))));
        }
    }

    function isAvailable(day) {
        return availableDays.some( aDay => isEqual(startOfDay(aDay), day) );
    }

    // the month of the week is the month most of its days are in, the one of its Thursday
    const monthDay = days[Math.min(days.length - 1, visibleWeek * 7 + 3)];

    return (
        <div className="appBookingWeekCal">
            <div className="appBookingCalHeader">
                <button type="button" aria-label={props.rawTextByKey('cal.prevWeek')} className="appBookingCalNavBtn"
                        disabled={visibleWeek <= 0} onClick={ () => scrollToWeek(visibleWeek - 1, true) }>
                    <div className="appBookingCalNavIcon"> <LeftArrowIcon /> </div>
                </button>
                <div className="appBookingCalHeaderText" aria-live="polite"> { ltext.text('cal.month.' + getMonth(monthDay)) } { getYear(monthDay) } </div>
                <button type="button" aria-label={props.rawTextByKey('cal.nextWeek')} className="appBookingCalNavBtn"
                        disabled={visibleWeek >= weeksCount - 1} onClick={ () => scrollToWeek(visibleWeek + 1, true) }>
                    <div className="appBookingCalNavIcon"> <RightArrowIcon /> </div>
                </button>
            </div>
            <div className="appBookingWeekCalDays" ref={rowRef} onScroll={onScroll}>
                { days.map( (day, index) => {
                    let available = isAvailable(day);
                    let selected = !!selectedDate && isEqual(day, selectedDate);
                    let classValue = "appBookingWeekCalDay" + (available ? " appBookingCalDayBtnAvailable" : "") + (selected ? " appBookingCalDayBtnSelected" : "");
                    return (
                        <button key={day.getTime()} type="button" className={classValue} disabled={!available} aria-pressed={selected}
                                onClick={ () => props.onSelectDay && props.onSelectDay(day) }>
                            <span className="appBookingWeekCalDayName"> { labels[index % 7] } </span>
                            <span className="appBookingWeekCalDayNumber"> { day.getDate() } </span>
                        </button>
                    );
                }) }
            </div>
        </div>
    );
}
