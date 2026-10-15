import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { httpRequest } from './HttpRequest';
import { formatLocalizedDateTime } from "./utils/formatters";
import { CustomList } from './CustomList.jsx';
import { QuickFilters } from './QuickFilters.jsx';
import { ClockIcon, LocationIcon, UserIcon, ResourceIcon, ServicePrice } from './utils/Utils.js';
import { optionResources, scheduleIdsForResources } from './utils/bookingData.js';

/*
The services in scope (department, specialist, restricted sku) as cards, each with its first available slots.
Clicking a card selects the service, clicking one of its slots selects the service and that slot.
*/
let ServicesWithNextAppSlot = function(props) {
    const [suggestedEvents, setSuggestedEvents] = useState({});
    const [fetchingData, setFetchingData] = useState({ fetching: false, status: 'not_fetched' });

    let ltext = props.ltext;
    let specialists = {};
    let locations = {};
    let resources = {};
    let inScopeSkusData = [];

        // if true it uses a single service sku no matter how many specialists asscociated
    let oneServicePerSkuAndSpecialists = ((props.appBookingConfigs && props.appBookingConfigs.oneServicePerSkuAndSpecialists) ? props.appBookingConfigs.oneServicePerSkuAndSpecialists : false );

    props.allSkus.forEach( sku => {
        if (props.restrictSkuId && String(sku.sku.skuid) !== String(props.restrictSkuId)) {
            return;
        }
        sku.data.forEach( (itemData) => {
            // check if the department from step 1 is set for this sku data
            if (props.departmentId && !(itemData.departments || []).some( d => d.id === props.departmentId )) {
                return;
            }

            let itemSpecialistId = itemData.specialist ? itemData.specialist.id : null;
            if (props.specialistId && ((props.specialistId !== itemSpecialistId) && (props.specialistId !== props.specialistAnyID)))
            {
                return;
            }

            let objSku = { id: `${sku.sku.skuid}_${itemData.location.id}_${itemSpecialistId}`, sku: sku.sku, location: itemData.location, specialist: itemData.specialist,
                           scheduleIds: itemData.scheduleIds || [], resourceSchedules: itemData.resourceSchedules || [] };

            if (!oneServicePerSkuAndSpecialists) {
                if (itemData.specialist) {
                    specialists[itemSpecialistId] =  { id:  itemSpecialistId, value: props.specialistFullName(itemData.specialist) };
                }
                objSku.specialist = itemData.specialist;
            } else {
                objSku.specialist = { id: null };
            }

            locations[itemData.location.id] = { id: itemData.location.id, value: itemData.location.name };
            optionResources(itemData).forEach( resource => {
                resources[resource.id] = { id: resource.id, value: resource.name || String(resource.id) };
            });

            if (!oneServicePerSkuAndSpecialists) {
                inScopeSkusData.push( objSku );
            } else {
                // check if inScopeSkusData already has this sku and location
                let found = inScopeSkusData.find( item => (item.sku.skuid === objSku.sku.skuid) && (item.location.id === objSku.location.id) );
                if (found) {
                    // one item for all the specialists, so its slots come from all their schedules
                    found.scheduleIds = Array.from(new Set([ ...found.scheduleIds, ...objSku.scheduleIds ]));
                } else {
                    inScopeSkusData.push( objSku );
                }
            }
        });
    });

    // filtering on resources narrows the slot search of every service to the selected resources
    let resourceSelection = props.filterSelections && props.filterSelections['resources'];
    if (resourceSelection) {
        inScopeSkusData = inScopeSkusData.map( objSku => {
            let scheduleIds = scheduleIdsForResources(objSku, resourceSelection);
            return scheduleIds ? { ...objSku, scheduleIds: scheduleIds } : null;
        }).filter(Boolean);
    }

    let selected = props.selectedService || {};
    let selectedItem = inScopeSkusData.find( item => (item.sku.id === selected.skuId) && (item.location.id === selected.locationId) &&
                                                      ((item.specialist ? item.specialist.id : null) === selected.specialistId) );

    function filteredServices(skus, filterSelections) {
        // filterSelections is an object whos keys are 'specialists', 'locations', 'resources' and each of these map with on object who's keys are the filter selections (ids)

        function firstSlotOf(sku) {
            let slots = suggestedEvents[sku.id];
            return (slots && slots.length > 0) ? new Date(slots[0].startDate) : null;
        }

        let result = skus.filter( sku => {
            if (filterSelections['specialists'] && (! sku.specialist || ! filterSelections['specialists'][sku.specialist.id])) {
                return false; // the specialist for this sku is not selected in the filter
            }
            if (filterSelections['locations'] && (! filterSelections['locations'][sku.location.id])) {
                return false; // the location for this sku is not selected in the filter
            }
            return true;
        });

        // order by the first available slot, services without slots last
        return result.sort( (a, b) => {
            let slotA = firstSlotOf(a);
            let slotB = firstSlotOf(b);
            if (slotA && slotB) {
                return slotA - slotB;
            }
            return (slotA ? -1 : 0) + (slotB ? 1 : 0);
        });
    }

    function onSelectService(serviceItem) {
        if (props.onSelectService) {
            props.onSelectService(serviceItem);
        }
    }

    function isSelectedSlot(item, slot) {
        return !!selectedItem && (selectedItem.id === item.id) && !!props.selectedBookingSlot &&
               (props.selectedBookingSlot.slot.startDate === slot.startDate);
    }

    function serviceItemContent(item, isSelected) {

        function getSpecialistContent() {
            if ((props.appBookingConfigs && (props.appBookingConfigs.showSpecialistNameOnServiceItem === false)) || !props.specialistFullName(item.specialist)) {
                return;
            }
            return (
                <div className="appBookingServiceSpecialist"> { props.specialistFullName(item.specialist) } </div>
                )
        }

        function getAvailableSlots(record) {
            if (fetchingData.fetching) {
                return ( <div className="appBookingTextNotImportant"> { props.rawTextByKey('loading') } </div> )
            }
            let slotsForItem = suggestedEvents[record.id] || [];
            if (slotsForItem.length === 0) {
                return ( <div className="appBookingWarningText"> { props.rawTextByKey('step.slot.noSlotShort') } </div> )
            }

            let slots = [];
            let day = null;
            for(let i = 0; i< Math.min(slotsForItem.length, props.maxSlotsPerItem); i++) {
                let currentDay = formatLocalizedDateTime(new Date(slotsForItem[i].startDate), ltext.locale);
                if (day === null) {
                    day = currentDay;
                }
                if (day !== currentDay) {
                    break;
                }
                slots.push( { slot: slotsForItem[i], day: day, time: format( new Date(slotsForItem[i].startDate), "HH:mm") })
            }
            let hasMoreSlots = slots.length < slotsForItem.length;

            return ( <div className="appBookingServiceSlots">
                        <div className="appBookingDateLine">
                            <div className="appBookingDateLineHeader"> { props.rawTextByKey('step.service.firstSlot') } </div>
                            <div className="appBookingDateLineContent"> {day} </div>
                        </div>
                        <div className="appBookingItemsHorizontal" >
                                { slots.map( slot => {
                                    let buttonClass = "appBookingTimeSlotButton" + (isSelectedSlot(item, slot.slot) ? " appBookingTimeSlotSelectedButton" : "");
                                    return ( <button className={buttonClass} type="button" key={slot.time}
                                                     onClick={(e) => { e.stopPropagation(); props.onSelectServiceAndSlot(item, slot) }}> { slot.time } </button> )
                                }) }
                                { hasMoreSlots && <button className="appBookingMoreSlotsButton" type="button"
                                                          onClick={(e) => { e.stopPropagation(); props.onSelectMoreSlots(item) }}> { props.rawTextByKey('step.slot.showMore') } </button> }
                        </div>
            </div> );
        }

        function getLabelContent() {
            if (item.sku.attributes && item.sku.attributes.labels && (item.sku.attributes.labels.length > 0)) {
                return <div className="appBookingServiceLabel"> { item.sku.attributes.labels[0] } </div>
            }
        }
        return (<div className="appBookingServiceContainer">
            { getLabelContent() }
            <div className="appBookingServiceHeader"> { item.sku.name } </div>
            { getSpecialistContent() }

            <div className="appBookingServiceMeta">
                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrIcon">
                        <ClockIcon />
                    </div>
                    <div className="appBookingServiceAttrContent">
                        { ltext.textValue(props.rawTextByKey('service.minutes'), item.sku.duration) }
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
            <ServicePrice sku={ item.sku } />

            { getAvailableSlots(item) }

        </div>)
    }

    useEffect( () => {
        ( async () => {
            try {

                setFetchingData({ fetching: true, status: 'not_fetched' });
                let bodyReq = {
                    filterSkuData: inScopeSkusData.map( skuData => ({ id: skuData.id, skuId: skuData.sku.id, scheduleIds: skuData.scheduleIds }) ),
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    organizationId: props.organizationId
                }
                if (bodyReq.filterSkuData.length === 0) {
                    setSuggestedEvents({});
                    setFetchingData({ fetching: false, status: 'success' });
                    return;
                }
                let res = await httpRequest('POST', props.apiBase + "/api/integration/" + props.integrationId + "/appointment/nextFreeSlotWithFilter2", bodyReq, { 'content-type': 'application/json'});
                setSuggestedEvents(res || {});
                setFetchingData({ fetching: false, status: 'success' });
            } catch (e) {
                setSuggestedEvents({});
                setFetchingData({ fetching: false, status: 'error' });
            }
        }) ();
    }, [props.departmentId, props.specialistId, props.restrictSkuId, props.refreshKey, Object.keys(resourceSelection || {}).sort().join(',')] );

    let filterGroups = [ { id: 'specialists', label_key: 'filter.specialist', title_key: 'filter.specialists', icon: <UserIcon />, values: Object.values(specialists) },
                         { id: 'resources', label_key: 'filter.resource', title_key: 'filter.resources', icon: <ResourceIcon />, values: Object.values(resources) },
                         { id: 'locations', label_key: 'filter.location', title_key: 'filter.locations', icon: <LocationIcon />, values: Object.values(locations) } ];

    return (
        <div className="appBookingServices">
            <QuickFilters groups={filterGroups} filterSelections={props.filterSelections || {}} onChange={props.onChangeFacetedFilter}
                          ltext={ltext} rawTextByKey={props.rawTextByKey} maxVisible={2} />
            <div className="appBookingStepTitle"> { props.title } </div>
            { (fetchingData.status === 'error') && <div className="appBookingErrorText"> { props.rawTextByKey('error.generic') } </div> }
            <CustomList
                variant="cards"
                items={ filteredServices(inScopeSkusData, props.filterSelections || {}) }
                onSelectItem={onSelectService}
                itemContent={serviceItemContent}
                selectedId={selectedItem ? selectedItem.id : null} />
        </div>
    )
}

export { ServicesWithNextAppSlot }
