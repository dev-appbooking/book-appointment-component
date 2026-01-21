import { addDays, addMonths, getYear, getDay, getDaysInMonth, getMonth, isValid, startOfMonth, startOfDay, isEqual, format } from "date-fns";
import { useEffect, useState } from "react";
import { LeftArrowIcon, RightArrowIcon } from "./utils/Utils";
export function MonthlyCalendar(props) { 
const ltext = props.ltext;

useEffect ( ()=> {
    // if there is dateToShow then selected Date needs to be same month and same year as dateToShow
    let selectedDate = props.selectedDate;
    let dateToShow = props.dateToShow;
    if (! isValid(selectedDate)) {
        dateToShow = new Date();
        selectedDate = null;
    } else {
        dateToShow = new Date(selectedDate);
    }
    setCalendarData( { selectedDate: selectedDate, 
                      dateToShow: dateToShow } );
} , [ props.selectedDate ] );

const [ calendarData, setCalendarData ] = useState( { selectedDate: props.selectedDate,
                                                      dateToShow: props.dateToShow } );

function onNavigateBefore() {
    setCalendarData({ ...calendarData, dateToShow: addMonths(calendarData.dateToShow, -1) });
}   

function onNavigateAfter() {
    setCalendarData({ ...calendarData, dateToShow: addMonths(calendarData.dateToShow, 1) });
}   

function onSelectDay(aDay) {
    if (props.onSelectDay) {
        props.onSelectDay(aDay);
    }
}

function getDayContent(dayItem) {
    let classContainerVal = "appBookingCalDay ";
    let classBtnVal = "appBookingCalDayBtn ";
    let disabledButton = true;
    if (! dayItem.currentMonth) {
        classBtnVal += "appBookingCalDayBtnOtherMonth ";
    } else {
    // is this an available date ?
        if (props.availableDays) {
            props.availableDays.forEach( aDay => {
                if (isEqual( startOfDay(aDay), startOfDay(dayItem.dayDate)) ) {
                    classBtnVal += "appBookingCalDayBtnAvailable ";
                    disabledButton = false;
                }
            })
        }
    }
    if (calendarData.selectedDate && isEqual(dayItem.dayDate, calendarData.selectedDate)) {
        classBtnVal += "appBookingCalDayBtnSelected ";
    }
    return (<div className={classContainerVal} > <button disabled={disabledButton} className={classBtnVal} onClick={ () => { onSelectDay(dayItem.dayDate) } }> { dayItem.dayIndex } </button> </div>)
}

function getMonthDaysContent() {
    if (!isValid(calendarData.dateToShow)) {
        return;
    }
    const daysCount = getDaysInMonth(calendarData.dateToShow);
    const monthText = ltext.text('cal.month.' + getMonth(calendarData.dateToShow));

    let startDate = startOfMonth(calendarData.dateToShow);

    let dayElements = [];

    //see how many empty days we need to add
    let startIndex = getDay(startDate);
    if (startIndex === 0) {
        // this is Sunday, make it 7
        startIndex = 7;
    }
    let aDay = startDate;
    for(let x = 0; x<startIndex-1; x++) {
         aDay = addDays(aDay, -1);
         dayElements.unshift( { dayIndex: aDay.getDate(), dayDate: aDay, wDay: getDay(aDay), currentMonth: false });
    }
    aDay = startDate;
    for (let x = 0; x< daysCount; x++) {
        dayElements.push( { dayIndex: aDay.getDate(), dayDate: aDay, wDay: getDay(aDay), currentMonth: true });
        aDay = addDays(aDay, 1);
    }
    // check how many items we have and make it multiple of 7
    while ((dayElements.length % 7) != 0) {
        dayElements.push( { dayIndex: aDay.getDate(), dayDate: aDay, wDay: getDay(aDay), currentMonth: false });
        aDay = addDays(aDay, 1);
    }

    let daysHeaderLabel = [ ltext.text('cal.wday.s.Mo'), ltext.text('cal.wday.s.Tu'), ltext.text('cal.wday.s.We'), ltext.text('cal.wday.s.Th'), ltext.text('cal.wday.s.Fr'), ltext.text('cal.wday.s.Su'), ltext.text('cal.wday.s.Sa') ];
    return ( 
        <div> 
            <div className="appBookingItemsHorizontal appBookingCalHeader"> 
                <button className="appBookingCalNavBtn" onClick={ onNavigateBefore }> <div className="appBookingCalNavIcon"> <LeftArrowIcon /> </div> </button>
                <div className="appBookingCalHeaderText"> { monthText } { getYear(calendarData.dateToShow) } </div>
                <button className="appBookingCalNavBtn" onClick={ onNavigateAfter }> <div className="appBookingCalNavIcon"> <RightArrowIcon /> </div> </button>
            </div> 
            <div className="appBookingCalDays">
                { daysHeaderLabel.map( day => { 
                    return ( <div className="appBookingCalDay"> { day } </div> )    
                })}
            </div>
            <div className="appBookingCalDays">
                { dayElements.map( (item) => {
                    return getDayContent(item)
                    } ) 
                }
            </div>
        </div>);
}

return (
    <div className="appBookingCal">
        { getMonthDaysContent() }
    </div>)
}