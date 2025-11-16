import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { httpRequest } from './HttpRequest';
import {formatLocalizedDateTime} from "./utils/formatters";

let PublicNextAppSlot = function(props) {
    const [suggestedEvents, setSuggestedEvents] = useState([]);
    const [fetchingData, setFetchingData] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [showMoreDays, setShowMoreDays] = useState({});

    function selectSlot(slot) {
        setSelectedSlot(slot);
        if (props.onSelectSlot) {
            props.onSelectSlot(slot);
        }
    }

    function selectShowMoreSlots(dayStr) {
        setShowMoreDays( {...showMoreDays, [dayStr]: true } );
    }

    function getSuggestedSlotsContent() {
        let daysArray = [];
        let usedSlots = {};
        suggestedEvents.forEach( (slot) => {
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
            <>
            { 
                daysArray.map( (daySlots) => {
                    let isThisDaySelected = props.selectedBookingSlot && (daySlots[0].day === props.selectedBookingSlot.day);
                    let foundSelection = false;
                    return (
                        <div key={daySlots[0].day}>
                            <div className="appBookingDateLine">
                                {daySlots[0].day}
                            </div>
                            <div className="appBookingTimeSlotsContainer" >
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
                            <div></div>
                            </div>
                        </div> );
                })
            }
            </>
        )
    }

    useEffect( () => {
        ( async () => { 
            try {

                setFetchingData(true);
                let bodyReq = {
                    serviceSkuId: props.skuId,
                    specialistId: props.specialistId,
                    locationId: props.locationId,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    organizationId: props.organizationId
                }
                let res = await httpRequest('POST', props.apiBase + "/api/appointment/nextFreeSlot", bodyReq, { 'content-type': 'application/json'});
                setSuggestedEvents(res);
                setFetchingData(false);
            } catch (e) {
                setFetchingData(false);
            }
        }) ();
    }, [props.specialistId, props.startDate] );

    return (<>
        { !fetchingData && getSuggestedSlotsContent() }
        { fetchingData && (<div> in progress... </div>) }
    </>)
}

export { PublicNextAppSlot }