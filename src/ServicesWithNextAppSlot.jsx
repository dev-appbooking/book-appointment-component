import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { httpRequest } from './HttpRequest';
import {formatLocalizedDateTime} from "./utils/formatters";
import { CustomList } from './CustomList.jsx';
import { FacetedFilter } from './FacetedFilter.jsx';
import { configurableText } from './utils/Utils.js';
import { ClockIcon } from './utils/Utils.js';
import { LocationIcon } from './utils/Utils.js';
import { XCircle } from './utils/Utils.js';

let ServicesWithNextAppSlot = function(props) {
    const [suggestedEvents, setSuggestedEvents] = useState([]);
    const [fetchingData, setFetchingData] = useState({ fetching: false, status: 'not_fetched' });
    const [showMoreDays, setShowMoreDays] = useState({});

    let ltext = props.ltext;
    let specialists = {};
    let locations = {};
    let inScopeSkusData = [];
    let selectedItemId = null;

        // if true it uses a single service sku no matter how many specialists asscociated
    let oneServicePerSkuAndSpecialists = ((props.appBookingConfigs && props.appBookingConfigs.oneServicePerSkuAndSpecialists) ? props.appBookingConfigs.oneServicePerSkuAndSpecialists : false );

    props.allSkus.forEach( sku => {
        sku.data.forEach( (itemData, index) => {
            // check if the department from step 1 is set for this sku data
            let foundDepartment = false;
            if (props.departmentId && itemData.departments && (itemData.departments.length > 0)) {
                for(let i = 0;i< itemData.departments.length; i++) {
                    if (itemData.departments[i].id === props.departmentId) {
                        foundDepartment = true;
                        break;
                    }
                }
            }
            if ((! foundDepartment) && props.departmentId) {
                return;
            }

            if (props.specialistId && ((props.specialistId !== itemData.specialist.id) && (props.specialistId !== props.specialistAnyID)))
            {
                return;
            }
            
            let objSku = { id: `${sku.sku.id}_${itemData.location.id}_${itemData.specialist.id}`, sku: sku.sku, location: itemData.location, specialist: itemData.specialist };

            if (!oneServicePerSkuAndSpecialists) {
                specialists[itemData.specialist.id] =  { id:  itemData.specialist.id, value: props.specialistFullName(itemData.specialist) };
                objSku.specialist = itemData.specialist;
            } else {
                objSku.specialist = { id: null };
            }

            locations[itemData.location.id] = { id: itemData.location.id, value: `${itemData.location.name} (${itemData.location.city})` };

            if (!oneServicePerSkuAndSpecialists) {
                inScopeSkusData.push( objSku );
            } else {
                // check if inScopeSkusData already has this sku and location
                let foundSku = false;
                for(let i=0; i< inScopeSkusData.length; i++) {
                    if ((inScopeSkusData[i].sku.id === objSku.sku.id) && (inScopeSkusData[i].location.id === objSku.location.id)) {
                        foundSku = true;
                        break;
                    }
                }
                if (!foundSku) {
                    inScopeSkusData.push( objSku );
                }
            }

            if (objSku.sku.id === props.skuId && objSku.location.id === props.locationId && objSku.specialist.id === props.specialistId) {
                selectedItemId = objSku.id;
            }
        });
    });
    if (!selectedItemId && (props.specialistId === props.specialistAnyID)) {
        
    }

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
    function onChangeFacetedFilter(filterGroupId, filterItemId) {
        if (props.onChangeFacetedFilter) {
            props.onChangeFacetedFilter(filterGroupId, filterItemId)
        }
    }

    function filteredServices(skus, filterSelections) {
        // filterSelections is an object whos keys are 'specialists' or 'locations' and each of these map with on object who's keys are the filter selections (ids)
        if (Object.keys(filterSelections).length === 0) {
            // there are no filters so just return everything
            return skus;
        }
        let result = [];
        skus.forEach( sku => {
            if (filterSelections['specialists'] && (! filterSelections['specialists'][sku.specialist.id])) {
                return; // the specialist for this sku is not selected in the filter so just return
            }
            if (filterSelections['locations'] && (! filterSelections['locations'][sku.location.id])) {
                return; // the location for this sku is not selected in the filter so just return
            }
            // we got this far so the sku passes the filter
            result.push(sku);
        });
        return result;
    }

    function onSelectService(serviceItem) {
        if (props.onSelectMoreSlots) {
            props.onSelectMoreSlots(serviceItem);
        }
    }

    function onSelectServiceAnsSlot(serviceItem, slot) {
        if (props.onSelectServiceAndSlot) {
            props.onSelectServiceAndSlot(serviceItem, slot);
        }
    }

    function serviceItemContent(item, isSelected) {
    
        function getSpecialistContent() {
            if (props.configs && (props.configs.showSpecialistNameOnServiceItem === false)) {
                return;
            }
            return (
                <div className="appBokingServiceLineItem appBookingServiceSpecialist"> { props.specialistFullName(item.specialist) } </div>
                )
        }

        function getAvailableSlots(record) {
            if (!(record.id in suggestedEvents)) {
                return ( <> No slots available </>)
            }
            let slotsForItem = suggestedEvents[record.id];
            if ((slotsForItem.length === 0)) {
                return ( <> No slots available </>)
            }
            let selected = false;
            let buttonClass = "appBookingTimeSlotButton";
            if (selected) {
                buttonClass = "appBookingTimeSlotButton appBookingTimeSlotSelectedButton";
            }

            let slots = [];
            let day = null;
            for(let i = 0; i< Math.min(slotsForItem.length, props.maxSlotsPerItem); i++) {
                if (day === null) {
                    day = formatLocalizedDateTime(new Date(slotsForItem[i].startDate), ltext.locale);
                }
                let currentDay = formatLocalizedDateTime(new Date(slotsForItem[i].startDate), ltext.locale);
                if (day !== currentDay) {
                    break;
                }
                slots.push( { slot: slotsForItem[i], day: day, time: format( new Date(slotsForItem[i].startDate), "kk:mm") })
            }
            let hasMoreSlots = slots.length < slotsForItem.length;

            return ( <div className="appBookingItemsVerical appBooking"> 

                        <div className="appBookingDateLine">
                            <div className="appBookingDateLineHeader"> Primul loc disponibil </div>
                            <div className="appBookingDateLineContent"> {day} </div>
                        </div>
                        <div className="appBookingItemsHorizontal" >
                                { slots.map( slot => {
                                    return ( <button className={buttonClass} type="button" key={slot.time} onClick={() => { onSelectServiceAnsSlot(item, slot) }}> { slot.time } </button> )
                                }) }
                                { hasMoreSlots && <button className="appBookingTimeSlotButton" type="button" onClick={() => { onSelectService(item) }}> ... </button> }
                        </div>
            </div> );
        }

        return (<div className="appBookingServiceContainer">
            <div className="appBokingServiceLineItem appBookingServiceHeader">
                <div className="appBookingContentGrow"> { item.sku.name } </div>
                { isSelected && <div className="appBookingSelectedItemIcon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    </div>
                }
            </div>
            { getSpecialistContent() }

            <div className="appBokingServiceLineItem">
                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrIcon">
                        <ClockIcon />
                    </div>
                    <div className="appBookingServiceAttrContent">
                            { item.sku.duration } minute
                    </div>

                </div>

                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrIcon">
                        <LocationIcon />
                    </div>
                    <div className="appBookingServiceAttrContent">
                        { item.location.name }
                    </div>
                </div>
            </div>
            <div className="appBokingServiceLineItem appBookingServicePrice"> { item.sku.price } { item.sku.currency } </div>

            <div className="appBokingServiceLineItem"> 
                { getAvailableSlots(item) }
            </div>

        </div>)
    }

    function getServicesContent() {
        let hasFilters = (Object.keys(specialists).length > 1) || (Object.keys(locations).length > 1);
        let filterData = { items: props.allSkus, filterItems: [ { id: 'specialists', title_key: 'filter.specialists', values: Object.values(specialists) },
                                                                { id: 'locations', title_key: 'filter.locations', values: Object.values(locations) } ],
                                filterSelections: props.filterSelections
                            } ;
        return (
        <div>
            <div className="appBookingStepTitle appBookingActiveStepTitle"> { ltext.textValue(configurableText('step.service', props.appBookingConfigs, ltext),  1) } </div>
                { (hasFilters) && <FacetedFilter filterData={ filterData } onChange={onChangeFacetedFilter} ltext={ltext}/> }
                <CustomList
                    items={ filteredServices(inScopeSkusData, props.filterSelections) } onSelectItem1={onSelectService}
                    expand={true}
                    itemContent={serviceItemContent}
                    selectedId={selectedItemId}
                    ltext={ltext} />
        </div>
        )
    }

    useEffect( () => {
        ( async () => { 
            try {

                setFetchingData({ fetching: true, status: 'not_fetched' });
                let bodyReq = {
                    filterSkuData: [],
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    organizationId: props.organizationId
                }
                inScopeSkusData.forEach( skuData => {
                    bodyReq.filterSkuData.push( { id: skuData.id,
                                            serviceSkuId: skuData.sku.id,
                                            specialistId: skuData.specialist.id,
                                            locationId: skuData.location.id
                                        });
                });
                let res = await httpRequest('POST', props.apiBase + "/api/appointment/nextFreeSlotWithFilter", bodyReq, { 'content-type': 'application/json'});
                setSuggestedEvents(res);
                setFetchingData({ fetching: false, status: 'success' });
            } catch (e) {
                setFetchingData({ fetching: false, status: 'error' });
            }
        }) ();
    }, [props.skuId, props.locationId, props.specialistId, props.startDate] );

    return (<>
        { !fetchingData.fetching && getServicesContent() }
        { fetchingData.fetching && (<div>...</div>) }
    </>)
}

export { ServicesWithNextAppSlot }