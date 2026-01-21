import { format, startOfDay, isEqual } from 'date-fns';
import { useState, useEffect } from 'react';
import { httpRequest } from './HttpRequest';
import {formatLocalizedDateTime} from "./utils/formatters";
import { MonthlyCalendar } from './MonthlyCalendar.jsx';

let ChooseAppSlot = function(props) {
    const [suggestedEvents, setSuggestedEvents] = useState([]);
    const [fetchingData, setFetchingData] = useState({ fetching: false, status: 'not_fetched' });
    const [showMoreDays, setShowMoreDays] = useState({});
    const [ selectedDay, setSelectedDay ] = useState(null);
    let ltext = props.ltext;

    function selectSlot(slot) {
        if (props.onSelectSlot) {
            props.onSelectSlot(slot);
        }
    }

    function selectShowMoreSlots(dayStr) {
        setShowMoreDays( {...showMoreDays, [dayStr]: true } );
    }

    function errorContent() {
        return (
            <div className="appBookingTimeSlotsContainer" >
                { ltext.text('error.generic') }
            </div>
        )
    }
    
    function noSlotsContent() {
        return (
            <div className="appBookingTimeSlotsContainer" >
                <span className="appBookingWarningText"> { ltext.text('step.slot.noSlots') } </span>
            </div>
        )
    }

    function getAvailableDays() {
        if (fetchingData.status !== 'success') {
            return [];
        }
        let result = [];
        suggestedEvents.forEach( slot => {
            let aday = startOfDay(slot.startDate);
            if (result.length === 0) {
                result.push(aday);
            } else {
                if (!isEqual(aday, result[result.length-1])) {
                    result.push(aday);
                }
            }
        })
        return result;
    }
    function onSelectDayInMonthlyCal(aday) {
        //
        setSelectedDay(aday);
    }

    function getSuggestedSlotsContent() {
        if (fetchingData.status !== 'success') {
            return errorContent();
        }
        
        if (suggestedEvents.length === 0) {
            return noSlotsContent();
        }

        let daysArray = [];
        let usedSlots = {};
        
        suggestedEvents.forEach( (slot) => {
            if (!isEqual(selectedDay, startOfDay(slot.startDate))) {
                return;
            }

            let day = formatLocalizedDateTime(new Date(slot.startDate), props.ltext.locale);
            //let day = format( new Date(slot.startDate), "dd-LL-yyyy");
            if ((daysArray.length === 0) || ((daysArray.length > 0) && (daysArray[daysArray.length - 1][0].day !== day))) {
                
                if (props.maxDaysToShow && (props.maxDaysToShow === daysArray.length)) {
                    return;
                }
                daysArray.push([]);
            }
            if (slot.startDate in usedSlots) {
                return;
            }
            usedSlots[slot.startDate] = 1;
            // need to insert this slot into the right order
            let x = 0;
            for(x = 0; x < daysArray[daysArray.length-1].length; x++) {
                if (new Date(daysArray[daysArray.length-1][x].slot.startDate).getTime() >= (new Date(slot.startDate).getTime())) {
                    break;
                }
            }

            daysArray[daysArray.length-1].splice(x, 0, { slot: slot, day: day, time: format( new Date(slot.startDate), "kk:mm") });
            
        });
        return (
            <div className="appBookingTimeSlotsContainer">
                <div className="appBookingTimeSlotsTitle"> { ltext.text('step.slot.chooseSlot') } </div>
            { 
                daysArray.map( (daySlots) => {
                    let isThisDaySelected = props.selectedBookingSlot && (daySlots[0].day === props.selectedBookingSlot.day);
                    let foundSelection = false;
                    return (
                            <div key={daySlots[0].day} >

                                <div className="appBookingDateLine">
                                    {daySlots[0].day}
                                </div>
                                <div class="appBookingItemsHorizontal appBookingItemsGrow1 appBookingItemsWrap">
                                    { daySlots.map ( (slot, index) => {
                                            if ((!showMoreDays[slot.day]) && (index >= props.initialSlotsPerDay)) {
                                                if (!isThisDaySelected) {
                                                    return; 
                                                }
                                                if (isThisDaySelected && foundSelection) {
                                                    return;
                                                }
                                            }
                                            
                                            let selected = (props.selectedBookingSlot != null) && (slot.day === props.selectedBookingSlot.day) && (slot.time === props.selectedBookingSlot.time);
                                            foundSelection = foundSelection || selected;
                                            let buttonClass = "appBookingTimeSlotButton";
                                            if (selected) {
                                                buttonClass = "appBookingTimeSlotButton appBookingTimeSlotSelectedButton";
                                            }
                                            return ( <button className={buttonClass} type="button" key={slot.time} onClick={() => { selectSlot(slot) }}> { slot.time } </button> )
                                        
                                        }) 
                                    }
                                    {
                                        ((! showMoreDays[daySlots[0].day] ) && (daySlots.length > props.initialSlotsPerDay)) && (
                                                <button className="appBookingTimeSlotButton" type="button" onClick={() => { selectShowMoreSlots(daySlots[0].day) }}> ... </button>
                                            )
                                    }
                                </div>
                            </div>
                    )
                } )
            }
            </div>
        )
    }

    useEffect( () => {
        ( async () => { 
            try {

                setFetchingData({ fetching: true, status: 'not_fetched' });
                let bodyReq = {
                    serviceSkuId: props.skuId,
                    specialistId: props.specialistId,
                    locationId: props.locationId,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    organizationId: props.organizationId
                }
                let res = await httpRequest('POST', props.apiBase + "/api/appointment/nextFreeSlot", bodyReq, { 'content-type': 'application/json'});
                setSuggestedEvents(res);
                //set the selection as the first option 
                if (props.selectedBookingSlot && props.selectedBookingSlot.slot.startDate) {
                    setSelectedDay(startOfDay(props.selectedBookingSlot.slot.startDate));
                } else
                if (res.length > 0 ) {
                    let firstOptionDay = startOfDay(res[0].startDate);
                    setSelectedDay(firstOptionDay);
                 }
                setFetchingData({ fetching: false, status: 'success' });
            } catch (e) {
                setFetchingData({ fetching: false, status: 'error' });
            }
        }) ();
    }, [props.specialistId, props.startDate, props.selectedBookingSlot] );

    return (
        <div class="appBookingChooseDate">
            {  !fetchingData.fetching && ( <div className="appBookingChooseDateCal"> 
                                            <MonthlyCalendar availableDays={getAvailableDays()} ltext={ltext} onSelectDay={onSelectDayInMonthlyCal} selectedDate={selectedDay} /> 
                                        </div>) }
            { !fetchingData.fetching && ( <div className="appBookingChooseDateSlots"> { getSuggestedSlotsContent() }  </div> ) }
            { !fetchingData.fetching && ( <div className="appBookingReserveBlockIcon"> </div> ) } 
        </div>
    )
}

export { ChooseAppSlot }