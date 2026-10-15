import { format, startOfDay, isEqual } from 'date-fns';
import { useState, useEffect } from 'react';
import { httpRequest } from './HttpRequest';
import {formatLocalizedDateTime} from "./utils/formatters";
import { MonthlyCalendar } from './MonthlyCalendar.jsx';
import { WeekCalendar } from './WeekCalendar.jsx';

// the parts of the day the slots are grouped in, by the hour they start before
const dayParts = [ { id: 'morning', untilHour: 12 }, { id: 'afternoon', untilHour: 17 }, { id: 'evening', untilHour: 24 } ];

/*
The selected slot is held for this user, so the free slot search may leave it out.
Put it back in time order, in place of any other slot at the same start, so it stays visible and selected.
*/
function insertHeldSlotIntoFreeSlots(slots, selectedBookingSlot) {
    if (!selectedBookingSlot || !selectedBookingSlot.slot) {
        return slots;
    }
    let held = selectedBookingSlot.slot;
    let heldTime = new Date(held.startDate).getTime();
    let result = slots.filter(slot => new Date(slot.startDate).getTime() !== heldTime);
    let index = result.findIndex(slot => new Date(slot.startDate).getTime() > heldTime);
    result.splice(index < 0 ? result.length : index, 0, held);
    return result;
}

let ChooseAppSlot = function(props) {
    const [suggestedEvents, setSuggestedEvents] = useState([]);
    const [fetchingData, setFetchingData] = useState({ fetching: true, status: 'not_fetched' });
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
                { props.rawTextByKey('error.generic') }
            </div>
        )
    }
    
    function noSlotsContent() {
        return (
            <div className="appBookingTimeSlotsContainer" >
                <span className="appBookingWarningText"> { props.rawTextByKey('step.slot.noSlots') } </span>
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

        let daySlots = [];
        let usedSlots = {};
        suggestedEvents.forEach( (slot) => {
            if (!isEqual(selectedDay, startOfDay(slot.startDate)) || (slot.startDate in usedSlots)) {
                return;
            }
            usedSlots[slot.startDate] = 1;
            daySlots.push({ slot: slot, day: formatLocalizedDateTime(new Date(slot.startDate), ltext.locale), time: format( new Date(slot.startDate), "HH:mm") });
        });
        daySlots.sort( (a, b) => new Date(a.slot.startDate).getTime() - new Date(b.slot.startDate).getTime() );
        if (daySlots.length === 0) {
            return noSlotsContent();
        }

        const isSelected = (slot) => (props.selectedBookingSlot != null) && (props.selectedBookingSlot.slot.startDate === slot.slot.startDate);
        const showAll = showMoreDays[daySlots[0].day] || daySlots.slice(props.initialSlotsPerDay).some(isSelected);
        const visibleSlots = showAll ? daySlots : daySlots.slice(0, props.initialSlotsPerDay);

        const groups = dayParts.map( part => ({ ...part, slots: [] }) );
        visibleSlots.forEach( slot => {
            groups.find( group => new Date(slot.slot.startDate).getHours() < group.untilHour ).slots.push(slot);
        });
        const shownGroups = groups.filter( group => group.slots.length > 0 );

        return (
            <div className="appBookingTimeSlotsContainer">
                <div className="appBookingDateLine"> {daySlots[0].day} </div>
                { shownGroups.map( (group, index) => (
                    <div key={group.id} className={"appBookingTimeSlotsGroup appBookingTimeSlotsGroup_" + group.id}>
                        <div className="appBookingTimeSlotsGroupLabel"> { props.rawTextByKey('step.slot.' + group.id) } </div>
                        <div className="appBookingTimeSlotsGrid">
                            { group.slots.map( (slot) => {
                                    let buttonClass = "appBookingTimeSlotButton" + (isSelected(slot) ? " appBookingTimeSlotSelectedButton" : "");
                                    return ( <button className={buttonClass} type="button" key={slot.slot.startDate} aria-pressed={isSelected(slot)} onClick={() => { selectSlot(slot) }}> { slot.time } </button> )
                                })
                            }
                            { (index === shownGroups.length - 1) && (visibleSlots.length < daySlots.length) && (
                                    <button className="appBookingTimeSlotButton appBookingTimeSlotMoreButton" type="button" onClick={() => { selectShowMoreSlots(daySlots[0].day) }}> ... </button>
                                )
                            }
                        </div>
                    </div>
                )) }
            </div>
        )
    }

    useEffect( () => {
        ( async () => { 
            try {

                setFetchingData({ fetching: true, status: 'not_fetched' });
                const itemId = 'slots';
                let bodyReq = {
                    filterSkuData: [ { id: itemId, skuId: props.skuId, scheduleIds: props.scheduleIds || [] } ],
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    organizationId: props.organizationId
                }
                let slotsByItem = await httpRequest('POST', props.apiBase + "/api/integration/" + props.integrationId + "/appointment/nextFreeSlotWithFilter2", bodyReq, { 'content-type': 'application/json'});
                let res = insertHeldSlotIntoFreeSlots((slotsByItem && slotsByItem[itemId]) || [], props.selectedBookingSlot);
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
    }, [props.skuId, props.specialistId, (props.scheduleIds || []).join(','), props.startDate] );

    // while loading, the calendar has no available day and placeholders take the place of the slots
    function loadingSlotsContent() {
        return (
            <div className="appBookingTimeSlotsContainer appBookingLoading" aria-busy="true">
                <div className="appBookingDateLine appBookingTextNotImportant"> { props.rawTextByKey('loading') } </div>
                { ['morning', 'afternoon'].map( part => (
                    <div key={part} className="appBookingTimeSlotsGroup">
                        <div className="appBookingTimeSlotsGroupLabel"> { props.rawTextByKey('step.slot.' + part) } </div>
                        <div className="appBookingTimeSlotsGrid">
                            { [0, 1, 2, 3, 4, 5].map( index => ( <div key={index} className="appBookingSkeleton appBookingTimeSlotSkeleton"></div> )) }
                        </div>
                    </div>
                )) }
            </div>
        );
    }

    let availableDays = getAvailableDays();
    return (
        <div className="appBookingChooseDateContainer">
            <div className="appBookingChooseDate">
                <div className="appBookingChooseDateCal">
                    <MonthlyCalendar availableDays={availableDays} ltext={ltext} onSelectDay={onSelectDayInMonthlyCal} selectedDate={selectedDay} />
                    <WeekCalendar availableDays={availableDays} ltext={ltext} rawTextByKey={props.rawTextByKey} onSelectDay={onSelectDayInMonthlyCal} selectedDate={selectedDay} />
                </div>
                <div className="appBookingChooseDateSlots"> { fetchingData.fetching ? loadingSlotsContent() : getSuggestedSlotsContent() } </div>
            </div>
            { props.notice && ( <div className="appBookingSlotNotice appBookingWarningText"> { props.notice } </div> ) }
            { props.children }
        </div>
    )
}

export { ChooseAppSlot }
