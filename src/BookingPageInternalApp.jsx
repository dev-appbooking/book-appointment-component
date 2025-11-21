import * as React from 'react';
import { LocalizationText } from './LocalizationText';
import { localizationTexts } from './texts.js';
import { CustomList } from './CustomList.jsx';
import { useState, useEffect } from "react";
import { httpRequest } from './HttpRequest';
import { PublicNextAppSlot } from './PublicNextAppSlot.jsx';
import { StandardCustomerForm } from './StandardCustomerForm.jsx';
import { BookingSummary } from './BookingSummary.jsx';
import { FacetedFilter } from './FacetedFilter.jsx';
import { format } from 'date-fns';
import { StepSummary } from './StepSummary.jsx';
import {formatLocalizedDateTime} from "./utils/formatters";
import { BookingEventDetails } from "./BookingEventDetails.jsx";

/*
This booking Page can have several steps depending on what services are setup.
*/
export function BookingPageInternalApp (props) {

    const [ fetchData, setfetchData ] = useState({ fetching: false, status: 'not_fetched', data: [] } );

    const [ bookingData, setBookingData ]  = useState( { step: 'step_choose_department', step_choose_department: { departmentId: null, departmentIndex: null, enforceDepartment: false, showEdit: true, displayChooseDepartment: false },
                                                                  step_choose_service: {  skuId: null,
                                                                            locationId: null,
                                                                            serviceIndex: null,
                                                                            specialistId: null,
                                                                            showEdit: true,
                                                                            filterSelections: { },
                                                                            displayFacetedSearch: false
                                                                         } ,
                                                                  step_choose_slot: { bookingSlot: null, showEdit: true },
                                                                  step_personal_data: { name: '', mobile: '', email: '', acceptTerms: false, errors: { } },
                                                                  step_confirmation: { bookingConfirmationId: null },
                                                                  bookingStatus: 'initial', submitted: false,
                                                                  integrationId: null,
                                                                  organizationId: null } );

    const [ bookingStatus, setBookingStatus] = useState({ submit: false, status: 'initial' });

    const [eventData, setEventData] = useState({fetching: false, status: 'initial', data: null });

    let apiBase = 'https://www.appbooking.ro';
    if (props.appBookingApiBaseUrl) {
        apiBase = props.appBookingApiBaseUrl;
    }
    const ltext = new LocalizationText(localizationTexts, props.locale || 'ro');             

    let mandatoryPersonalData = props.configs.step_personal_data.mandatory_data;
    
    function integrationCountDepartments(skus) {
        let resDepartments = { } ;
        skus = skus || [];
        skus.forEach ( sku => {
            let skuDataArray = sku.data || [];
            skuDataArray.forEach ( skuData => {
                let departments = skuData.departments || [];
                departments.forEach( department => {
                    resDepartments[department.id] = true;
                })
            });
        });
        return Object.keys(resDepartments).length;
    }

    useEffect ( () => {
        (async function() {
            try {
                let integrationId = props.integrationId;
                
                if (integrationId) {
                    setfetchData({  ...fetchData, fetching: true, status: 'not_fetched'});
                    let skusObj = await httpRequest('GET', apiBase + '/api/bookingData/' + integrationId);

                    setfetchData({ fetching: false, status: 'success', data: skusObj.skus || [] });
                    let step = 'step_choose_service';
                    let hasDepartments = integrationCountDepartments(skusObj.skus) > 1;
                    if (hasDepartments) {
                        step = 'step_choose_department';
                    }
                    setBookingData( { ...bookingData, integrationId: integrationId, organizationId: (skusObj.skus[0].sku.organizationId),
                                                    step: step,
                                                    step_choose_service: { ...bookingData.step_choose_service, showEdit: skusObj.skus.length > 1 } ,
                                                    step_choose_department: { ...bookingData.step_choose_department, displayChooseDepartment: hasDepartments }
                        } );

                } else {
                    setfetchData({ ...fetchData, fetching: false, status: 'no_integrationIdParam' });
                }

            }
            catch (e) {
                setfetchData({ ...fetchData,  fetching: false, status: 'error', data: [] });
            }
            })();
        },
    [ ]);

        useEffect(() => {
        if (!props.eventId) {
            return;
        }

        (async function () {
            try {
                setEventData({ fetching: true, status: 'not_fetched', data: null });
                const bookingEvent = await httpRequest(
                    'GET',
                    apiBase + '/api/event/booking/' + props.eventId
                );
                setEventData({ fetching: false, status: 'success', data: bookingEvent });
            } catch (e) {
                const status = e?.status || e?.response?.status;

                if (status === 404) {
                    setEventData({
                        fetching: false,
                        status: 'not_found',
                        data: null
                    });
                } else {
                    setEventData({
                        fetching: false,
                        status: 'error',
                        data: null
                    });
                }
            }
        })();
    }, [props.eventId, apiBase]);


    function onSelectService(serviceItem, index) {
        setBookingData( { ...bookingData, step: 'step_choose_slot', step_choose_service: { ...bookingData.step_choose_service, serviceIndex: index, skuId: serviceItem.sku.id, specialistId: serviceItem.specialist.id, locationId: serviceItem.location.id, filterSelections: {} },
                                                   step_choose_slot: { ...bookingData.step_choose_slot, bookingSlot: null }
                        } );
    }

    function getSpecialistFullName( item ) {
        let x = `${item.title || ''} ${item.firstName || ''} ${item.lastName || ''}`;
        return x.trim();
    }

    function serviceItemContent(item, isSelected) {

        function getSpecialistContent() {
            if (props.configs && (props.configs.showSpecialistNameOnServiceItem === false)) {
                return;
            }
            return (
            <div className="appBokingServiceLineItem"> { getSpecialistFullName(item.specialist) } </div>
            )
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
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"  stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                            </div>
                            <div className="appBookingServiceAttrContent">
                                    { item.sku.duration } minute
                            </div>

                        </div>

                        <div className="appBookingServiceAttr">
                            <div className="appBookingServiceAttrIcon">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"  stroke="currentColor" strokeWidth="1.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                                </svg>
                            </div>
                            <div className="appBookingServiceAttrContent">
                                { item.location.name }
                            </div>
                        </div>
                    </div>

                    <div className="appBokingServiceLineItem appBookingServicePrice"> { item.sku.price } { item.sku.currency } </div>
                </div>)
    }

    function departmentItemContent(item, isSelected) {
        return ( <>
                <div className="appBookingContentGrow"> { item.name } </div>
                { isSelected && <div className="appBookingSelectedItemIcon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                </div> }
                </> );
    }

    function departmentSummaryItemContent(item) {
        return ( <div>  { item.name } </div> )
    }

    function onSelectDepartment(departmentItem, index) {
        setBookingData( { ...bookingData, step: 'step_choose_service', step_choose_department: { ...bookingData.step_choose_department , departmentId: departmentItem.id, departmentIndex: index },
                                                   step_choose_service: { ...bookingData.step_choose_service, serviceIndex: null, skuId: null, specialistId: null, locationId: null, filterSelections: {} },
                                                   step_choose_slot: { ...bookingData.step_choose_slot, bookingSlot: null }
                        } );
    }

    function onSelectBookingSlot(slot) {
        setBookingData( { ...bookingData, step: 'step_personal_data', step_choose_slot: { ...bookingData.step_choose_slot, bookingSlot: slot } } );
    }

    function onChangeCustomerData(property, e) {
        let value = e.target.value;
        let errors = JSON.parse(JSON.stringify(bookingData.step_personal_data.errors));
        if (property === 'acceptTerms') {
            value = ! bookingData.step_personal_data.acceptTerms;
            if (e.target.checked === true) {
                delete errors[property];
            }
        } else {
            if (value.length > 0) {
                delete errors[property];
            }
        }
        setBookingData( { ...bookingData, step: 'step_personal_data', step_personal_data: { ...bookingData.step_personal_data, [property]: value, errors: errors } } );
    }

    function onBlurCustomerData(property, e) {
        let value = e.target.value;
        let errors = JSON.parse(JSON.stringify(bookingData.step_personal_data.errors));
        if (property === 'acceptTerms') {
            if (e.target.checked === false) {
                errors['acceptTerms'] = 'error.terms_not_accepted';
            }
        }  else {
            value = value.trim();
            
            
            if (property === 'name') {
                if ((value.length < 3) && mandatoryPersonalData.includes(property)) {
                        errors['name'] = 'error.name_empty';
                } else if (value.length > 30) {
                    errors['name'] = 'error.name_too_long';
                } else if  (false === (/^[a-zA-Z\-''_0-9 ]{3,}$/.test(value))) {
                    errors['name'] = 'error.name_invalid';
                }

            } else if (property === 'email') {
                if (value.length === 0) { 
                    if (mandatoryPersonalData.includes(property)) {
                        errors['email'] = 'error.email_empty';
                    }
                } else if (false === (/^[a-zA-Z\-\.0-9_\+]{1,64}@[a-zA-Z\-\.0-9_\+]{3,100}$/.test(value))) {
                    errors['email'] = 'error.email_invalid';
                }
            } else if (property === 'mobile') {
                if (value.length === 0) {
                    if (mandatoryPersonalData.includes(property)) {
                        errors['mobile'] = 'error.mobile_empty';
                    }
                } else {
                    let sanitizedValue = '';
                    for(let x = 0; x < value.length; x++) {
                        if (((value[x] >= '0') && (value[x] <= '9')) || (value[x] === '+')) {
                            sanitizedValue = sanitizedValue + value[x];
                        }
                    }
                    if  (false === (/^\+{0,1}([0-9]){9,14}$/.test(sanitizedValue))) {
                        errors['mobile'] = 'error.mobile_invalid';
                    }
                }
            }
        }
        setBookingData( { ...bookingData, step: 'step_personal_data', step_personal_data: { ...bookingData.step_personal_data, errors: errors } } );
    }


    async function createBooking() {

        try {

            setBookingStatus({ submit: true, status: 'not_created' });
            let bodyReq = {
                serviceSkuId: bookingData.step_choose_service.skuId,
                integrationId: bookingData.integrationId,
                specialistId: bookingData.step_choose_service.specialistId,
                scheduleId: bookingData.step_choose_slot.bookingSlot.slot.scheduleId,
                bookingDate: bookingData.step_choose_slot.bookingSlot.slot.startDate,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                name: bookingData.step_personal_data.name,
                language: ltext.locale,
                mobile: bookingData.step_personal_data.mobile,
                email: bookingData.step_personal_data.email
            }
            let res = await httpRequest('POST', apiBase + "/api/appointment/booking", bodyReq, { 'content-type': 'application/json'});
            setBookingData( { ...bookingData, step: 'step_confirmation', step_confirmation: { bookingConfirmationId: res.id },
                                                                step_choose_department: { ...bookingData.step_choose_department, showEdit: false},
                                                                step_choose_service: { ...bookingData.step_choose_service, showEdit: false},
                                                                step_choose_slot: { ...bookingData.step_choose_slot, showEdit: false} } );
            setBookingStatus({ submit: false, status: 'success' });

        } catch (e) {
            setBookingStatus({ submit: false, status: 'error' });
        }
    }

    function onEditStepChooseDepartment() {
        setBookingData( { ...bookingData, step: 'step_choose_department', 'step_choose_service': { ...bookingData.step_choose_service, specialistId: null, serviceIndex: null, skuId: null, locationId: null, filterSelections: {} },
                                                   step_choose_slot: { ...bookingData.step_choose_slot, bookingSlot: null }, step_confirmation: { bookingConfirmationId: null }
                        } );
    }

    function onEditStepChooseService() {
        setBookingData( { ...bookingData, step: 'step_choose_service', 'step_choose_service': { ...bookingData.step_choose_service, bookingSlot: null }, 'step_confirmation': { bookingConfirmationId: null }
                        } );
    }

    function onEditStepChooseSlot() {
        setBookingData( { ...bookingData, step: 'step_choose_slot', 'step_confirmation': { bookingConfirmationId: null } } );
    }

    function onChangeFacetedFilter(filterGroupId, filterItemId) {
        let filterData = JSON.parse(JSON.stringify(bookingData.step_choose_service.filterSelections));

        if (filterGroupId in filterData) {
            if (filterItemId in filterData[filterGroupId]) {
                // this item is selected, so remove it
                delete filterData[filterGroupId][filterItemId];
                if (Object.keys(filterData[filterGroupId]).length === 0) {
                    delete filterData[filterGroupId];
                }
            } else {
                // this item is NOT selected, so add it
                filterData[filterGroupId][filterItemId] = 1;
            }
        } else {
            // this item is NOT selected, so add it
            filterData[filterGroupId] = { [ filterItemId ]: 1 };
        }
        setBookingData( { ...bookingData, step_choose_service: { ...bookingData.step_choose_service, filterSelections: filterData } } );
    }

    function filteredServices(skus, filterSelections) {
        // filterSelections is an object whos kaye are 'specialists' or 'locations' and each of these map with on object who's keys are the filter selections (ids)
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


        function buildEventDetails(event, skus) {
        if (!event) {
            return null;
        }

        const { customData, startDate, duration, specialistId, locationId, serviceSkuId, language } = event;

        let service = null;
        let specialist = null;
        let location = null;

        (skus || []).forEach(skuWrapper => {
            if (!skuWrapper || !skuWrapper.sku || !skuWrapper.data) return;

            if (String(skuWrapper.sku.id) === String(serviceSkuId)) {
                service = skuWrapper.sku;

                skuWrapper.data.forEach(itemData => {
                    if (itemData.specialist && String(itemData.specialist.id) === String(specialistId)) {
                        specialist = itemData.specialist;
                    }
                    if (itemData.location && String(itemData.location.id) === String(locationId)) {
                        location = itemData.location;
                    }
                });
            }
        });

        return {
            customer: customData || {},
            startDate,
            duration,
            language,
            service,
            specialist,
            location
        };
    }




    function getRawTextByKey(key) {
        if (props.configs && props.configs.text && props.configs.text[ltext.locale]) {
            // we have the texts for the current locale, check if we have the mentioned key
            if (key in props.configs.text[ltext.locale]) {
                return props.configs.text[ltext.locale][key];
            }
        }
        return ltext.text(key);
    }

    function contentForStep_category(stepIndex) {

        let departments = {};
        let allDepartmentsData = [];
        let selectedDepartment = null;
        fetchData.data.forEach( sku => {
            sku.data.forEach( (itemData, index) => {

                let dataDepartments = itemData.departments || [];
                dataDepartments.forEach( dataDepartment => {
                    if (dataDepartment.id in departments) {
                        return;
                    }
                    allDepartmentsData.push(dataDepartment);
                    departments[dataDepartment.id] = dataDepartment;
                    if (dataDepartment.id === bookingData.step_choose_department.departmentId) {
                        selectedDepartment = dataDepartment;
                    }
                });
            });
        });

        if (bookingData.step === 'step_choose_department') {
            return (<>
                        <div className="appBookingActiveStepTitle"> { ltext.textValue(getRawTextByKey('step.department'), stepIndex + 1 ) } </div>
                        <CustomList
                        items={ allDepartmentsData } onSelectItem={onSelectDepartment}
                        selectedIndex={bookingData.step_choose_department.departmentIndex}
                        itemContent={departmentItemContent}
                        ltext={ltext} />

                    </>
                    );
        } else {
            if (bookingData.step !== 'step_choose_department') {
            let title = ltext.textValue(getRawTextByKey('step.department.done'), stepIndex + 1);
            return (<StepSummary title={title} onEdit={onEditStepChooseDepartment} showEdit={bookingData.step_choose_department.showEdit} ltext={ltext}>
                        { departmentSummaryItemContent(selectedDepartment) }
                    </StepSummary>)
            }
        }
    }

    function contentForStep_service(stepIndex) {
        let specialists = {};
        let locations = {};
        let allSkuData = [];
        let selectedService = null;

        // if true it uses a single service sku no matter how many specialists asscociated
        let oneServicePerSkuAndSpecialists = ((props.configs && props.configs.oneServicePerSkuAndSpecialists) ? props.configs.oneServicePerSkuAndSpecialists : false );

        fetchData.data.forEach( sku => {
            sku.data.forEach( (itemData, index) => {
                // check if the department from step 1 is set for this sku data
                let foundDepartment = false;
                if (bookingData.step_choose_department.departmentId && itemData.departments && (itemData.departments.length > 0)) {
                    for(let i = 0;i< itemData.departments.length; i++) {
                        if (itemData.departments[i].id === bookingData.step_choose_department.departmentId) {
                            foundDepartment = true;
                            break;
                        }
                    }
                }
                if ((! foundDepartment) && bookingData.step_choose_department.displayChooseDepartment) {
                    return;
                }
                let objSku = { sku: sku.sku, location: itemData.location, specialist: itemData.specialist };

                if (!oneServicePerSkuAndSpecialists) {
                    specialists[itemData.specialist.id] =  { id:  itemData.specialist.id, value: getSpecialistFullName(itemData.specialist) };
                    objSku.specialist = itemData.specialist;
                } else {
                    objSku.specialist = { id: null };
                }

                locations[itemData.location.id] = { id: itemData.location.id, value: `${itemData.location.name} (${itemData.location.city})` };

                if (!oneServicePerSkuAndSpecialists) {
                    allSkuData.push( objSku );
                } else {
                    // check if allSkuData already has this sku and location
                    let foundSku = false;
                    for(let i=0; i< allSkuData.length; i++) {
                        if ((allSkuData[i].sku.id === objSku.sku.id) && (allSkuData[i].location.id === objSku.location.id)) {
                            foundSku = true;
                            break;
                        }
                    }
                    if (!foundSku) {
                        allSkuData.push( objSku );
                    }
                }

                if (objSku.sku.id === bookingData.step_choose_service.skuId && objSku.location.id === bookingData.step_choose_service.locationId && objSku.specialist.id === bookingData.step_choose_service.specialistId) {
                    selectedService = objSku;
                }
            });
        });
        if (bookingData.step === 'step_choose_service') {
            let hasFilters = (Object.keys(specialists).length > 1) || (Object.keys(locations).length > 1);
            let filterData = { items: fetchData.data, filterItems: [ { id: 'specialists', title_key: 'filter.specialists', values: Object.values(specialists) },
                                                                     { id: 'locations', title_key: 'filter.locations', values: Object.values(locations) } ],
                                    filterSelections: bookingData.step_choose_service.filterSelections
                                } ;
            return (
            <div>
                <div className="appBookingActiveStepTitle"> { ltext.text('step.service', stepIndex + 1) } </div>
                    { (hasFilters) && <FacetedFilter filterData={ filterData } onChange={onChangeFacetedFilter} ltext={ltext}/> }
                    <CustomList
                        items={ filteredServices(allSkuData, bookingData.step_choose_service.filterSelections) } onSelectItem={onSelectService}
                        selectedIndex={bookingData.step_choose_service.serviceIndex}
                        expand={true}
                        itemContent={serviceItemContent}
                        ltext={ltext} />
            </div>
            )
        } else if ((bookingData.step !== 'step_choose_service') && selectedService) {
            let title = ltext.text('step.service.done', stepIndex + 1);
            return (<StepSummary title={title} onEdit={onEditStepChooseService} showEdit={bookingData.step_choose_service.showEdit} ltext={ltext}>
                        { serviceItemContent(selectedService) }
                    </StepSummary>)
        }  else {
            return (
                    <div className="appBookingStepTitle"> { ltext.text('step.service', stepIndex + 1) } </div>
                    )
        }
    }

    function contentForStep_dateAndTime(stepIndex) {
        if ((bookingData.step === 'step_choose_slot') && bookingData.step_choose_service.skuId) {
            return (
                <div>
                    <div className="appBookingActiveStepTitle"> { ltext.textValue(getRawTextByKey('step.slot'), stepIndex + 1) } </div>
                    <PublicNextAppSlot apiBase={apiBase} skuId={bookingData.step_choose_service.skuId}
                                        specialistId={bookingData.step_choose_service.specialistId} locationId={bookingData.step_choose_service.locationId} organizationId={bookingData.organizationId}
                                        maxDaysToShow={3}
                                        initialSlotsPerDay={5}
                                        onSelectSlot={onSelectBookingSlot}
                                        selectedBookingSlot={bookingData.step_choose_slot.bookingSlot}
                                        ltext={ltext}
                                        rawTextByKey={getRawTextByKey}
                    />
                </div>
            )
        } else if ((bookingData.step != 'step_choose_slot') && bookingData.step_choose_slot.bookingSlot) {

            let startDate = new Date(bookingData.step_choose_slot.bookingSlot.slot.startDate);
            let timeStr = ltext.textValue(ltext.text('step.slot.hour'), format(startDate, "HH:mm"));
            
            let title = ltext.textValue(getRawTextByKey('step.slot.done'), stepIndex + 1);

            const pretty = formatLocalizedDateTime(startDate, ltext.locale);

            return (<StepSummary title={title} onEdit={onEditStepChooseSlot} showEdit={bookingData.step_choose_slot.showEdit} ltext={ltext}>
                        <div className="appBookingAttributesLine">{pretty}</div>
                        <div className="appBookingAttributesLine"> {timeStr} </div>
                    </StepSummary>)
        } else {
            return (
                        <div className="appBookingStepTitle"> { ltext.textValue(getRawTextByKey('step.slot'), stepIndex + 1) } </div>
                    )
        }
    }

    function getSubmitBookingBtnStatus() {
        //take into consideration if name, email and mobile are mandatory
        return ( (bookingData.step_personal_data.name.length > 0) || (! mandatoryPersonalData.includes('name')) ) &&
                ((bookingData.step_personal_data.email.length > 0) || (! mandatoryPersonalData.includes('email')) ) && 
                ((bookingData.step_personal_data.mobile.length > 0) || (! mandatoryPersonalData.includes('mobile')) ) && 
                ((bookingData.step_personal_data.acceptTerms === true) &&
                (Object.keys(bookingData.step_personal_data.errors).length === 0) && ! bookingStatus.submit );
    }

    function contentForStep_personalData(stepIndex) {
        if (bookingData.step === 'step_personal_data') {
            return ( 
                <div>
                        <div className="appBookingActiveStepTitle"> 
                            { ltext.text('step.personalInfo', stepIndex + 1) } 
                        </div>
                        < StandardCustomerForm customerData={bookingData.step_personal_data} onChange={onChangeCustomerData} 
                                                            onBlur={onBlurCustomerData} ltext={ltext} 
                                                            rawTextByKey={getRawTextByKey}
                                                            configs={props.configs}
                                                            />
                        <div>
                            {bookingStatus.status === 'error' && ( <div className="appBookingErrorText"> { ltext.text('error.generic')} </div>) }
                        </div>
                        <div className="appBookingCtaContainer">
                            <button disabled={ ! getSubmitBookingBtnStatus() } className="appBookingCtaButton" onClick={createBooking} > { ltext.text('ctaBooking') }</button>
                        </div>
                </div>
            );
        } else if (((bookingData.step_personal_data.name.length > 0) || (bookingData.step_personal_data.mobile.length > 0) || (bookingData.step_personal_data.email.length > 0)) && bookingData.step_personal_data.acceptTerms) {
            let title = ltext.text('step.personalInfo.done', stepIndex + 1);
            return (<StepSummary title={title} showEdit={false} ltext={ltext} > 
                        <>
                            <div className="appBookingAttributesLine"> {ltext.text('customer.name')} {bookingData.step_personal_data.name} </div> 
                            <div className="appBookingAttributesLine"> {ltext.text('customer.mobile')} {bookingData.step_personal_data.mobile} </div> 
                            <div className="appBookingAttributesLine"> {ltext.text('customer.email')} {bookingData.step_personal_data.email} </div>
                        </>
                    </StepSummary>)
        } else {
            return (
                <div className=""> 
                    <div className="appBookingStepTitle"> { ltext.text('step.personalInfo', stepIndex + 1) } </div>
                </div> 
            )
        }

    }

    function contentForStep_confirmation(stepIndex) {
        if (bookingData.step === 'step_confirmation') {
            if (bookingStatus.status === 'initial')
            return;

            if ( ['error', 'success'].includes(bookingStatus.status)) {
                let title = ltext.text('step.confirmation', stepIndex + 1);
                return (<StepSummary title={title} showEdit={false} ltext={ltext} > 
                                { (bookingStatus.status === 'error') &&  (<div className="appBookingErrorText">
                                                                             { ltext.text('booking.error') }
                                                                        </div>)
                                }
                                { (bookingStatus.status === 'success') &&  (<>
                                                        <div className="appBookingAttributesLine">
                                                            { ltext.text('booking.success') }
                                                        </div>
                                                        <div className="appBookingAttributesLine">
                                                            { ltext.text('booking.ref') } <span className="text-xl"> {bookingData.step_confirmation.bookingConfirmationId} </span>
                                                        </div>
                                                    </>)
                                }
                        </StepSummary>)
            }
        } else {
            return (
                <div className="appBookingStepTitle"> { ltext.text('step.confirmation', stepIndex + 1) } </div> 
            )
        }
    }

    function contentForSummary(stepName, stepIndex) {
        switch (stepName) {
            case 'step_choose_department': {
                return contentForStep_category(stepIndex);
            }
            case 'step_choose_service': {
                return contentForStep_service(stepIndex);
            }
            case 'step_choose_slot': {
                return contentForStep_dateAndTime(stepIndex);
            }
            case 'step_personal_data': {
                return contentForStep_personalData(stepIndex);
            }
            case 'step_confirmation': {
                return contentForStep_confirmation(stepIndex);
            }
        }
    }

        function getMainContent() {
        if (props.eventId) {
            if (eventData.fetching || eventData.status === 'initial' || fetchData.fetching || fetchData.status === 'not_fetched') {
                return <div>{ltext.text('loading.bookingDetails')}</div>;
            }

            if (eventData.status === 'not_found') {
                return <div>Programarea nu există sau a expirat.</div>;
            }

            if (eventData.status === 'error' || fetchData.status === 'error') {
                return <div>A apărut o eroare. Te rugăm să încerci mai târziu.</div>;
            }


            if (eventData.status === 'success' && fetchData.status === 'success') {
                const baseDetails = buildEventDetails(eventData.data, fetchData.data);

                if (!baseDetails) {
                    return <div>Nu am găsit detaliile programării.</div>;
                }

                const startDateObj = new Date(baseDetails.startDate);
                const languageForDate = baseDetails.language || ltext.locale;

                const prettyDateTime = formatLocalizedDateTime(startDateObj, languageForDate);
                const timeStr = format(startDateObj, "HH:mm");

                const detailsWithFormatted = {
                    ...baseDetails,
                    prettyDateTime,
                    timeStr
                };

                return (
                    <BookingEventDetails
                        details={detailsWithFormatted}
                        ltext={ltext}
                    />
                );
            }

            return null;
        }

        if (fetchData.status !== 'success') {
            return;
        }

        let steps = ['step_choose_service', 'step_choose_slot', 'step_personal_data', 'step_confirmation'];
        if (bookingData.step_choose_department && bookingData.step_choose_department.displayChooseDepartment) {
            steps.unshift('step_choose_department');
        }

        return (
            <div className="appBookingContainer">
                <BookingSummary contentForStep={contentForSummary} steps={steps} ltext={ltext} configs={props.configs} />
            </div>
        );
    }


   return (
       <React.StrictMode>
           <div className="appBookingWidget">
               { getMainContent() }

               { (fetchData.status === 'no_integrationIdParam') &&
                   (<div> Invalid config params </div> )
               }
           </div>
       </React.StrictMode>
   );}
