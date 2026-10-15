import * as React from 'react';
import { LocalizationText } from './LocalizationText';
import { localizationTexts } from './texts.js';
import { CustomList } from './CustomList.jsx';
import { useState, useEffect, useRef } from "react";
import { httpRequest } from './HttpRequest';
import { StandardCustomerForm } from './StandardCustomerForm.jsx';
import { format } from 'date-fns';
import { formatLocalizedDateTime, formatLocalizedDayMonth, formatLocalizedLongDate } from "./utils/formatters";
import { BookingEventDetails } from "./BookingEventDetails.jsx";
import { RescheduleBooking } from './RescheduleBooking.jsx';
import { configurableText, hasPrice, ClockIcon, LocationIcon, UserIcon, XCircle, CheckCircleIcon } from './utils/Utils.js';
import { ChooseAppSlot } from './ChooseAppSlot.jsx'
import { ServicesWithNextAppSlot } from './ServicesWithNextAppSlot.jsx';
import { ReservationCountdown } from './ReservationCountdown.jsx';
import { WidgetFrame, FrameNavigation, bringStepIntoView } from './WidgetFrame.jsx';
import { ChoicesSummary } from './ChoicesSummary.jsx';
import { Stepper } from './Stepper.jsx';
import { SelectionCard } from './SelectionCard.jsx';
import { DetailsTable } from './DetailsTable.jsx';
import { bookingOptionsFromV2, buildCatalog, assignedOwnerNames, slotOwnerNames, specialistFullName } from './utils/bookingData.js';

// the steps grouped together by the compact stepper of narrow layouts
const stepGroups = {
    step_choose_department: 'service',
    step_choose_specialist: 'service',
    step_choose_service: 'service',
    step_choose_slot: 'details',
    step_personal_data: 'details',
    step_confirmation: 'confirmation'
};

function emptySelections() {
    return {
        step_choose_department: { departmentId: null },
        step_choose_specialist: { specialistId: null },
        step_choose_service: { skuId: null, locationId: null, specialistId: null, scheduleIds: [], filterSelections: { } },
        step_choose_slot: { bookingSlot: null },
        step_personal_data: { name: '', mobile: '', email: '', acceptTerms: false, errors: { } },
        step_confirmation: { bookingConfirmationId: null }
    };
}

/*
This booking Page can have several steps depending on what services are setup.
Every step is shown on its own: choosing an option selects it and moves to the next step.
Only the personal data step has a button, the one that creates the booking.
*/
export function BookingPageInternalApp (props) {

    const specialistAnyID = 'specialist.any';
    const [ fetchData, setfetchData ] = useState({ fetching: false, status: 'not_fetched', data: [], catalog: null } );

    const [ bookingData, setBookingData ]  = useState( { ...emptySelections(),
                                                                step: null,
                                                                integrationId: null,
                                                                organizationId: null,
                                                                restrictSkuId: null,
                                                                steps: null }
                                                                );

    const [ bookingStatus, setBookingStatus] = useState({ submit: false, status: 'initial' });

    const [eventData, setEventData] = useState({fetching: false, status: 'initial', data: null });

    const [eventMode, setEventMode] = useState( props.eventId ? 'view': 'standard');

    // the inline cancel of a booking: 'idle' | 'confirm' | 'submitting' | 'success' | 'error'
    const [cancelState, setCancelState] = useState('idle');

    // the hold on the selected slot: { id, expiresAt (ms) }
    const [reservation, setReservation] = useState(null);
    // text key of the warning shown above the slots, e.g. when the hold expired
    const [slotNotice, setSlotNotice] = useState(null);
    // changing it reloads the available slots
    const [slotsRefreshKey, setSlotsRefreshKey] = useState(0);
    const reservingRef = useRef(false);
    const submittingRef = useRef(false);
    const widgetRef = useRef(null);
    const shownEventModeRef = useRef(eventMode);


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

    /*
    Counts the specialists of the services in scope: optionally only the ones in the department
    and of the sku the flow is restricted to (human-readable skuid).
    */
    function integrationCountSpecialists(skus, departmentId, restrictSkuId) {
        let resSpecialists = { } ;
        skus = skus || [];
        skus.forEach ( sku => {
            if (restrictSkuId && String(sku.sku.skuid) !== String(restrictSkuId)) {
                return;
            }
            let skuDataArray = sku.data || [];
            skuDataArray.forEach ( skuData => {
                if (!skuData.specialist) {
                    return;
                }
                if (departmentId && !(skuData.departments || []).some( d => d.id === departmentId )) {
                    return;
                }
                resSpecialists[skuData.specialist.id] = true;
            });
        });
        return Object.keys(resSpecialists).length;
    }

    // true when a service in scope is booked without a specialist (on resources only)
    function hasSkusWithoutSpecialist(skus, departmentId, restrictSkuId) {
        return (skus || []).some( sku => {
            if (restrictSkuId && String(sku.sku.skuid) !== String(restrictSkuId)) {
                return false;
            }
            return (sku.data || []).some( skuData => !skuData.specialist &&
                        (!departmentId || (skuData.departments || []).some( d => d.id === departmentId )) );
        });
    }


    /*
    The steps of the flow. The specialist step is left out when it is hidden by the configs, when
    no service in scope has a specialist, or when some service in scope has none.
    */
    function stepsFor(skus, departmentId, restrictSkuId) {
        let steps = ['step_choose_service', 'step_choose_slot', 'step_personal_data', 'step_confirmation'];
        let hideSpecialists = props.configs.step_choose_specialist && props.configs.step_choose_specialist.hide === true;
        if (!hideSpecialists && (integrationCountSpecialists(skus, departmentId, restrictSkuId) > 0) && !hasSkusWithoutSpecialist(skus, departmentId, restrictSkuId)) {
            steps.unshift('step_choose_specialist');
        }
        if (integrationCountDepartments(skus) > 1) {
            steps.unshift('step_choose_department');
        }
        return steps;
    }

    /*
    Resolves the preselection driven by the optional deep-link params:
      - departmentPublicId (lowest priority)
      - preselectSpecialistId
      - preselectSkuId
    When params conflict, the higher priority param wins (specialist > sku > department),
    as described in the issue. Returns null when nothing can be preselected, otherwise an
    object describing the selections and the step the flow should advance to.
    */
    function resolvePreselection(skus, deptPublicId, specialistParam, skuidParam, steps, defaultStep) {
        skus = skus || [];
        const norm = (v) => (v === null || v === undefined || v === '') ? null : String(v);
        deptPublicId = norm(deptPublicId);
        const specParam = norm(specialistParam);
        const skuParam = norm(skuidParam);

        if (!deptPublicId && !specParam && !skuParam) {
            return null;
        }

        const hasSpecialistStep = steps.indexOf('step_choose_specialist') >= 0;

        // Flatten the sku data into individual (sku, specialist, location, departments) entries.
        let entries = [];
        skus.forEach( skuWrapper => {
            (skuWrapper.data || []).forEach( itemData => {
                entries.push({
                    skuid: skuWrapper.sku.skuid,      // human-readable code, used to match the preselectSkuId param
                    skuInternalId: skuWrapper.sku.id, // autogenerated id, used for booking state / slot & booking APIs
                    specialistId: itemData.specialist ? itemData.specialist.id : null,
                    specialistPublicId: itemData.specialist ? itemData.specialist.publicId : null,
                    locationId: itemData.location.id,
                    scheduleIds: itemData.scheduleIds || [],
                    departments: itemData.departments || []
                });
            });
        });

        // Resolve the department publicId to an internal department id.
        let departmentId = null;
        if (deptPublicId) {
            for (const e of entries) {
                const d = e.departments.find( dep => dep.publicId === deptPublicId );
                if (d) { departmentId = d.id; break; }
            }
        }

        const specialistMatches = (e) => specParam !== null && norm(e.specialistPublicId) === specParam;
        const skuMatches = (e) => skuParam !== null && norm(e.skuid) === skuParam;

        const specialistEntries = specParam !== null ? entries.filter(specialistMatches) : [];
        const skuEntries = skuParam !== null ? entries.filter(skuMatches) : [];
        const specialistResolved = specialistEntries.length > 0;
        const skuResolved = skuEntries.length > 0;

        // Case A: specialist + sku both provided and combinable -> pin the full service, go to slot.
        if (specialistResolved && skuResolved) {
            let both = entries.filter( e => specialistMatches(e) && skuMatches(e) );
            if (both.length > 0) {
                let chosen = both.find( e => departmentId && e.departments.some( d => d.id === departmentId ) ) || both[0];
                let chosenDept = (departmentId && chosen.departments.some( d => d.id === departmentId ))
                    ? departmentId
                    : (chosen.departments[0] ? chosen.departments[0].id : null);
                return {
                    departmentId: chosenDept,
                    specialistId: chosen.specialistId,
                    skuId: chosen.skuInternalId,
                    locationId: chosen.locationId,
                    scheduleIds: chosen.scheduleIds,
                    step: 'step_choose_slot',
                    restrictSkuId: null
                };
            }
            // The specialist does not offer this sku: specialist has higher priority, so it wins.
            // Fall through to the specialist-only handling below.
        }

        // Case B: specialist provided -> preselect department + specialist, go to the service step.
        if (specialistResolved) {
            let dept = departmentId;
            let deptConsistent = dept && specialistEntries.some( e => e.departments.some( d => d.id === dept ) );
            if (!deptConsistent) {
                // specialist wins over a conflicting/absent department: use the specialist's own department.
                let withDept = specialistEntries.find( e => e.departments.length > 0 );
                dept = withDept ? withDept.departments[0].id : null;
            }
            return {
                departmentId: dept,
                specialistId: specialistEntries[0].specialistId,
                skuId: null,
                locationId: null,
                step: 'step_choose_service',
                restrictSkuId: null
            };
        }

        // Case C: sku provided only -> restrict departments/specialists/services to that sku.
        if (skuResolved) {
            let dept = (departmentId && skuEntries.some( e => e.departments.some( d => d.id === departmentId ) )) ? departmentId : null;
            let step;
            if (dept) {
                step = hasSpecialistStep ? 'step_choose_specialist' : 'step_choose_service';
            } else {
                step = defaultStep;
            }
            return {
                departmentId: dept,
                specialistId: null,
                skuId: null,
                locationId: null,
                step: step,
                restrictSkuId: skuEntries[0].skuid
            };
        }

        // Case D: department provided only -> preselect department, show the specialist step.
        if (departmentId !== null) {
            return {
                departmentId: departmentId,
                specialistId: null,
                skuId: null,
                locationId: null,
                step: hasSpecialistStep ? 'step_choose_specialist' : 'step_choose_service',
                restrictSkuId: null
            };
        }

        return null;
    }

    /*
    The state of a new booking: the flow starts on its first step. With withPreselection the
    deep-link params preselect the department, specialist or service and the step to start on.
    */
    function initialBookingData(skus, integrationId, withPreselection) {
        let steps = stepsFor(skus, null, null);
        let step = steps[0];
        let selections = emptySelections();
        let restrictSkuId = null;

        let preselection = withPreselection ? resolvePreselection(skus, props.departmentPublicId, props.preselectSpecialistId, props.preselectSkuId, steps, step) : null;
        if (preselection) {
            step = preselection.step;
            restrictSkuId = preselection.restrictSkuId;
            selections.step_choose_department.departmentId = preselection.departmentId;
            selections.step_choose_specialist.specialistId = preselection.specialistId;
            selections.step_choose_service = { ...selections.step_choose_service, skuId: preselection.skuId, specialistId: preselection.specialistId,
                                               locationId: preselection.locationId, scheduleIds: preselection.scheduleIds || [] };
            // the preselected department or sku may have no specialists to choose from
            steps = stepsFor(skus, preselection.departmentId, restrictSkuId);
            if (steps.indexOf(step) < 0) {
                step = 'step_choose_service';
            }
        }

        return { ...selections, integrationId: integrationId, organizationId: (skus[0] ? skus[0].sku.organizationId : null),
                 step: step, steps: steps, restrictSkuId: restrictSkuId };
    }

    useEffect ( () => {
        (async function() {
            try {
                let integrationId = props.integrationId;
                
                if (integrationId) {
                    setfetchData({  ...fetchData, fetching: true, status: 'not_fetched'});
                    let skusObj = await httpRequest('GET', apiBase + '/api/integration/' + integrationId + '/bookingData?version=2');
                    let skus = bookingOptionsFromV2(skusObj.skus);

                    setfetchData({ fetching: false, status: 'success', data: skus, catalog: buildCatalog(skusObj.skus) });
                    setBookingData( initialBookingData(skus, integrationId, true) );
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

    async function loadEvent() {
        try {
            setEventData({ fetching: true, status: 'not_fetched', data: null });
            const bookingEvent = await httpRequest(
                'GET',
                apiBase + '/api/integration/' + props.integrationId + '/event/booking/' + props.eventId
            );
            setEventData({ fetching: false, status: 'success', data: { ...bookingEvent, id: props.eventId } });
        } catch (e) {
            const status = e?.status || e?.response?.status;
            setEventData({ fetching: false, status: (status === 404) ? 'not_found' : 'error', data: null });
        }
    }

    useEffect(() => {
        if (!props.eventId) {
            return;
        }
        loadEvent();
    }, [props.eventId]);

    // switching between the booking details and rescheduling starts at the top of the widget, like a new step
    useEffect(() => {
        if (shownEventModeRef.current === eventMode) {
            return;
        }
        shownEventModeRef.current = eventMode;
        bringStepIntoView(widgetRef.current);
    }, [eventMode]);

    useEffect(() => {
        if (!reservation) {
            return;
        }
        let timer = setTimeout(() => {
            // a booking in flight settles it: success books the slot, a 409 sends the user back
            if (submittingRef.current) {
                return;
            }
            returnToSlotStep('step.slot.reservationExpired');
        }, Math.max(0, reservation.expiresAt - Date.now()));
        return () => clearTimeout(timer);
    }, [reservation]);

    function isReservationValid(res) {
        return !!res && (res.expiresAt > Date.now());
    }

    function releaseReservation(res) {
        if (!isReservationValid(res)) {
            return;
        }
        httpRequest('POST', apiBase + '/api/integration/' + bookingData.integrationId + '/event/reservation/' + encodeURIComponent(res.id) + '/cancel', {}, { 'content-type': 'application/json'})
            .catch(() => { /* the hold expires on its own */ });
    }

    function dropReservation() {
        releaseReservation(reservation);
        setReservation(null);
        setSlotNotice(null);
    }

    function returnToSlotStep(noticeKey, serviceChanges) {
        setReservation(null);
        setSlotNotice(noticeKey);
        setSlotsRefreshKey(k => k + 1);
        setBookingData(prev => ({ ...prev, step: 'step_choose_slot',
                                    step_choose_slot: { ...prev.step_choose_slot, bookingSlot: null },
                                    step_choose_service: { ...prev.step_choose_service, ...serviceChanges } }));
    }

    function isSameSlot(a, b) {
        const schedules = (slot) => (slot.scheduleIds || [slot.scheduleId]).join(',');
        return !!a && !!b && (a.slot.startDate === b.slot.startDate) && (schedules(a.slot) === schedules(b.slot));
    }

    function isSameService(serviceChanges) {
        let current = bookingData.step_choose_service;
        return !serviceChanges || ((serviceChanges.skuId === current.skuId) &&
                                   (serviceChanges.specialistId === current.specialistId) &&
                                   (serviceChanges.locationId === current.locationId));
    }

    /*
    Holds the chosen slot, selects it and moves to the personal data step. Any previous hold is released first.
    serviceChanges is applied to step_choose_service when the slot was picked from the service list.
    */
    async function reserveSlot(slot, serviceChanges) {
        if (reservingRef.current) {
            return;
        }
        if (isSameService(serviceChanges) && isReservationValid(reservation) && isSameSlot(slot, bookingData.step_choose_slot.bookingSlot)) {
            // the user picked the slot they already hold
            setSlotNotice(null);
            goToStep('step_personal_data');
            return;
        }

        reservingRef.current = true;
        releaseReservation(reservation);
        setReservation(null);
        setBookingData(prev => ({ ...prev, step_choose_slot: { ...prev.step_choose_slot, bookingSlot: null },
                                    step_choose_service: { ...prev.step_choose_service, ...serviceChanges } }));
        try {
            let res = await httpRequest('POST', apiBase + '/api/integration/' + bookingData.integrationId + '/event/reservation', { token: slot.slot.token }, { 'content-type': 'application/json'});
            setReservation({ id: res.id, expiresAt: new Date(res.expires_at).getTime() });
            setSlotNotice(null);
            setBookingData(prev => ({ ...prev, step: 'step_personal_data', step_choose_slot: { ...prev.step_choose_slot, bookingSlot: slot } }));
        } catch (e) {
            // 409: taken or held by someone else, 400: the slot token is no longer valid
            let noticeKey = ([400, 409].includes(e && e.status)) ? 'step.slot.unavailable' : 'error.generic';
            returnToSlotStep(noticeKey, serviceChanges);
        } finally {
            reservingRef.current = false;
        }
    }

    function serviceChangesFor(serviceItem) {
        return { skuId: serviceItem.sku.id, specialistId: serviceItem.specialist ? serviceItem.specialist.id : null, locationId: serviceItem.location.id,
                 scheduleIds: serviceItem.scheduleIds || [] };
    }

    function onSelectService(serviceItem) {
        let changes = serviceChangesFor(serviceItem);
        if (isSameService(changes)) {
            goToStep('step_choose_slot');
            return;
        }
        dropReservation();
        setBookingData( { ...bookingData, step: 'step_choose_slot', step_choose_service: { ...bookingData.step_choose_service, ...changes },
                                          step_choose_slot: { ...bookingData.step_choose_slot, bookingSlot: null } } );
    }

    function onSelectMoreSlots(serviceItem) {
        let changes = serviceChangesFor(serviceItem);
        if (!isSameService(changes) || !isReservationValid(reservation)) {
            dropReservation();
            setBookingData( { ...bookingData, step: 'step_choose_slot', step_choose_service: { ...bookingData.step_choose_service, ...changes },
                                              step_choose_slot: { ...bookingData.step_choose_slot, bookingSlot: null } } );
            return;
        }
        setBookingData( { ...bookingData, step: 'step_choose_slot' } );
    }

    function onSelectServiceAndSlot(serviceItem, slot) {
        reserveSlot(slot, serviceChangesFor(serviceItem));
    }

    function getSpecialistFullName( item ) {
        return specialistFullName(item);
    }

    function showSpecialistName() {
        return !(props.configs && (props.configs.showSpecialistNameOnServiceItem === false));
    }

    function specialistNameOf(item) {
        if (item.id === specialistAnyID) {
            return getRawTextByKey('specialist.any');
        }
        return getSpecialistFullName(item);
    }

    function departmentItemContent(item) {
        return ( <div className="appBookingTileText"> { item.name } </div> );
    }

    function specialistItemContent(item) {
        return ( <div className="appBookingTileText"> { specialistNameOf(item) } </div> );
    }

    function onSelectDepartment(departmentItem) {
        if (departmentItem.id === bookingData.step_choose_department.departmentId) {
            goToStep(nextStepOf('step_choose_department', bookingData.steps));
            return;
        }
        dropReservation();
        let steps = stepsFor(fetchData.data, departmentItem.id, bookingData.restrictSkuId);
        setBookingData( { ...bookingData, steps: steps, step: nextStepOf('step_choose_department', steps),
                                                   step_choose_department: { ...bookingData.step_choose_department , departmentId: departmentItem.id },
                                                   step_choose_specialist: { ...bookingData.step_choose_specialist, specialistId: null },
                                                   step_choose_service: { ...bookingData.step_choose_service, skuId: null, specialistId: null, locationId: null, scheduleIds: [], filterSelections: {} },
                                                   step_choose_slot: { ...bookingData.step_choose_slot, bookingSlot: null }
                        } );
    }

    function onSelectSpecialist(specialistItem) {
        if (specialistItem.id === bookingData.step_choose_specialist.specialistId) {
            goToStep(nextStepOf('step_choose_specialist', bookingData.steps));
            return;
        }
        dropReservation();
        setBookingData( { ...bookingData, step: nextStepOf('step_choose_specialist', bookingData.steps),
                                                   step_choose_specialist: {  ...bookingData.step_choose_specialist, specialistId: specialistItem.id },
                                                   step_choose_service: { ...bookingData.step_choose_service, skuId: null, specialistId: null, locationId: null, scheduleIds: [], filterSelections: {} },
                                                   step_choose_slot: { ...bookingData.step_choose_slot, bookingSlot: null }
                        } );
    }

    function onSelectBookingSlot(slot) {
        reserveSlot(slot);
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

        if (!isReservationValid(reservation)) {
            returnToSlotStep('step.slot.reservationExpired');
            return;
        }

        try {

            submittingRef.current = true;
            setBookingStatus({ submit: true, status: 'not_created' });
            let bodyReq = {
                reservationId: reservation.id,
                customData: {
                    name: bookingData.step_personal_data.name,
                    mobile: bookingData.step_personal_data.mobile,
                    email: bookingData.step_personal_data.email
                },
                bookingDate: bookingData.step_choose_slot.bookingSlot.slot.startDate,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: ltext.locale,

                utm_source: props.utm_params && props.utm_params.utm_source ? props.utm_params.utm_source : null,
                utm_medium: props.utm_params && props.utm_params.utm_medium ? props.utm_params.utm_medium : null,
                utm_campaign: props.utm_params && props.utm_params.utm_campaign ? props.utm_params.utm_campaign : null

            }
            let res = await httpRequest('POST', apiBase + "/api/integration/" + bookingData.integrationId + "/appointment/fromReservation", bodyReq, { 'content-type': 'application/json'});
            setReservation(null);
            setBookingData( { ...bookingData, step: 'step_confirmation', step_confirmation: { bookingConfirmationId: res.id } } );
            setBookingStatus({ submit: false, status: 'success' });

        } catch (e) {
            if ((e && e.status === 409) || !isReservationValid(reservation)) {
                // the hold expired or the slot can no longer be booked
                setBookingStatus({ submit: false, status: 'initial' });
                returnToSlotStep('step.slot.reservationExpired');
            } else {
                setBookingStatus({ submit: false, status: 'error' });
            }
        } finally {
            submittingRef.current = false;
        }
    }

    // starts a brand new booking on the first step
    function onNewBooking() {
        dropReservation();
        setBookingStatus({ submit: false, status: 'initial' });
        setBookingData( initialBookingData(fetchData.data, bookingData.integrationId, false) );
    }

    function stepIndexOf(stepName) {
        return (bookingData.steps || []).indexOf(stepName);
    }

    function nextStepOf(stepName, steps) {
        return steps[steps.indexOf(stepName) + 1];
    }

    function goToStep(stepName) {
        setBookingData(prev => ({ ...prev, step: stepName }));
    }

    function goBackToStep(stepName) {
        if (stepIndexOf(stepName) < stepIndexOf('step_choose_slot')) {
            // back to choosing the service: the held slot is let go
            dropReservation();
            setBookingData(prev => ({ ...prev, step: stepName, step_choose_slot: { ...prev.step_choose_slot, bookingSlot: null } }));
            return;
        }
        goToStep(stepName);
    }

    function onBack() {
        let previousStep = bookingData.steps[stepIndexOf(bookingData.step) - 1];
        if (!previousStep) {
            return;
        }
        goBackToStep(previousStep);
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

    function buildEventDetails(event, skus) {
        if (!event) {
            return null;
        }

        const {
            id,
            customData,
            startDate,
            duration,
            specialistId,
            locationId,
            serviceSkuId,
            language,
            status,
            owners
        } = event;
        let integrationId = props.integrationId;
        let service = null;
        let specialist = null;
        let location = null;
        let scheduleIds = null;
        const sameId = (a, b) => (a === null || a === undefined) ? (b === null || b === undefined) : (String(a) === String(b));

        (skus || []).forEach(skuWrapper => {
            if (!skuWrapper || !skuWrapper.sku || !skuWrapper.data) return;

            // here we use the internal sku id (skuWrapper.sku.id) to match the serviceSkuId from the event, because the event only stores the internal sku id, not the human-readable skuid.
            if (String(skuWrapper.sku.id) === String(serviceSkuId)) {
                service = skuWrapper.sku;

                skuWrapper.data.forEach(itemData => {
                    if (itemData.specialist && String(itemData.specialist.id) === String(specialistId)) {
                        specialist = itemData.specialist;
                    }
                    if (itemData.location && String(itemData.location.id) === String(locationId)) {
                        location = itemData.location;
                    }
                    // the same option as the booking: the slot search for a reschedule is narrowed to its schedules
                    if (sameId(itemData.specialist ? itemData.specialist.id : null, specialistId) && itemData.location && sameId(itemData.location.id, locationId)) {
                        scheduleIds = itemData.scheduleIds;
                    }
                });
            }
        });

        if (!scheduleIds) {
            // no longer on offer as booked: keep the booking's own schedules
            scheduleIds = (owners || []).map(owner => owner.ownerEntityScheduleId).filter(Boolean);
        }

        return {
            id,
            integrationId,
            serviceSkuId,
            specialistId,
            locationId,
            customer: customData || {},
            startDate,
            duration,
            language,
            service,
            specialist,
            location,
            scheduleIds,
            assignedNames: assignedOwnerNames(owners, fetchData.catalog, specialistId),
            status
        };
    }

    function onClickReschedule() {
        if (eventData.data && eventData.data.status === 'canceled') {
            setEventMode('standard');    
            return;
        }
        setEventMode('reschedule');
    }

    function onClickCancel() {
        setCancelState('confirm');
    }

    function onDismissCancel() {
        setCancelState('idle');
    }

    async function onConfirmCancel() {
        if (!props.eventId) return;

        setCancelState('submitting');
        try {
            let event = await httpRequest(
                'POST',
                apiBase + `/api/integration/${props.integrationId}/event/booking/${props.eventId}/cancel`,
                { },
                { 'content-type': 'application/json' }
            );
            setEventMode('view');
            setEventData({ fetching: false, status: 'success', data: { ...event, id: props.eventId } });
            setCancelState('success');
        } catch (e) {
            setCancelState('error');
        }
    }

    function onRescheduleDone() {
        setCancelState('idle');
        setEventMode('view');
        loadEvent();
    }

    function getRawTextByKey(key) {
        return configurableText(key, props.configs, ltext);
    }

    function stepTitle(key, stepIndex) {
        return ltext.textValue(getRawTextByKey(key), stepIndex + 1);
    }

    function inScope(sku) {
        return !bookingData.restrictSkuId || (String(sku.sku.skuid) === String(bookingData.restrictSkuId));
    }

    function findDepartment(departmentId) {
        for (const sku of fetchData.data) {
            for (const itemData of sku.data) {
                const found = (itemData.departments || []).find( d => d.id === departmentId );
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }

    function findSpecialist(specialistId) {
        if (specialistId === specialistAnyID) {
            return { id: specialistAnyID };
        }
        for (const sku of fetchData.data) {
            const found = sku.data.find( itemData => itemData.specialist && (itemData.specialist.id === specialistId) );
            if (found) {
                return found.specialist;
            }
        }
        return null;
    }

    // the chosen service: { sku, location, specialist }
    function findSelectedService() {
        const selection = bookingData.step_choose_service;
        const skuWrapper = fetchData.data.find( sku => sku.sku.id === selection.skuId );
        if (!skuWrapper) {
            return null;
        }
        const atLocation = skuWrapper.data.filter( itemData => itemData.location.id === selection.locationId );
        const exact = atLocation.find( itemData => (itemData.specialist ? itemData.specialist.id : null) === selection.specialistId );
        if (exact) {
            return { sku: skuWrapper.sku, location: exact.location, specialist: exact.specialist };
        }
        // one service for all the specialists (oneServicePerSkuAndSpecialists)
        return atLocation.length > 0 ? { sku: skuWrapper.sku, location: atLocation[0].location, specialist: null } : null;
    }

    function serviceTitle(service) {
        let name = service.sku.name;
        if (service.specialist && showSpecialistName() && getSpecialistFullName(service.specialist)) {
            name += ' - ' + getSpecialistFullName(service.specialist);
        }
        return name;
    }

    function priceText(sku) {
        return hasPrice(sku) ? `${sku.price} ${sku.currency}` : null;
    }

    function minutesText(duration) {
        return ltext.textValue(getRawTextByKey('service.minutes'), duration);
    }

    // who else the held slot is booked with (the resources or other specialists of the slot)
    function selectedSlotOwnerNames(service) {
        let bookingSlot = bookingData.step_choose_slot.bookingSlot;
        if (!bookingSlot) {
            return [];
        }
        return slotOwnerNames(bookingSlot.slot, fetchData.catalog, service && service.specialist ? service.specialist.id : null);
    }

    function reservationCountdown() {
        if (!reservation || (bookingData.step === 'step_confirmation')) {
            return null;
        }
        return (<ReservationCountdown expiresAt={reservation.expiresAt} text={getRawTextByKey('step.slot.reservationHeldFor')} />);
    }

    // the line under the stepper recalling the choices of the previous steps; choosing one goes back to its step
    function choicesSummary() {
        if (bookingData.step === 'step_confirmation') {
            return null;
        }
        let currentIndex = stepIndexOf(bookingData.step);
        let items = [];
        function addItem(stepName, value) {
            let index = stepIndexOf(stepName);
            if ((index >= 0) && (index < currentIndex) && value) {
                items.push({ id: stepName, label: getRawTextByKey('stepper.' + stepName), value: value,
                             onSelect: () => { if (!bookingStatus.submit) { goBackToStep(stepName); } } });
            }
        }

        let departmentId = bookingData.step_choose_department.departmentId;
        let department = departmentId ? findDepartment(departmentId) : null;
        addItem('step_choose_department', department && department.name);

        let specialistId = bookingData.step_choose_specialist.specialistId;
        let specialist = specialistId ? findSpecialist(specialistId) : null;
        addItem('step_choose_specialist', specialist && specialistNameOf(specialist));

        let service = findSelectedService();
        let hasSpecialistItem = items.some( item => item.id === 'step_choose_specialist' );
        addItem('step_choose_service', service && (hasSpecialistItem ? service.sku.name : serviceTitle(service)));

        let bookingSlot = bookingData.step_choose_slot.bookingSlot;
        let startDate = bookingSlot ? new Date(bookingSlot.slot.startDate) : null;
        addItem('step_choose_slot', startDate && ltext.textValue(getRawTextByKey('step.slot.dayAtTime'), formatLocalizedDayMonth(startDate, ltext.locale), format(startDate, 'HH:mm')));

        return ( <ChoicesSummary items={items} label={getRawTextByKey('summary.label')}
                                 changeLabel={ (choice) => ltext.textValue(getRawTextByKey('summary.change'), choice) } /> );
    }

    function moreLabel(count) {
        return ltext.textValue(getRawTextByKey('list.showMore'), count);
    }

    function contentForStep_category(stepIndex) {

        let departments = {};
        let allDepartmentsData = [];
        fetchData.data.forEach( sku => {
            if (!inScope(sku)) {
                return;
            }
            sku.data.forEach( itemData => {
                (itemData.departments || []).forEach( dataDepartment => {
                    if (dataDepartment.id in departments) {
                        return;
                    }
                    allDepartmentsData.push(dataDepartment);
                    departments[dataDepartment.id] = dataDepartment;
                });
            });
        });

        return (<>
                    <div className="appBookingStepTitle"> { stepTitle('step.department', stepIndex) } </div>
                    <CustomList
                        variant="tiles"
                        items={ allDepartmentsData } onSelectItem={onSelectDepartment}
                        selectedId={bookingData.step_choose_department.departmentId}
                        itemContent={departmentItemContent} />
                </>);
    }

    function contentForStep_specialist(stepIndex) {

        let specialists = {};
        let allSpecialistsData = [];
        let departmentId = bookingData.step_choose_department.departmentId;
        fetchData.data.forEach( sku => {
            if (!inScope(sku)) {
                return;
            }
            sku.data.forEach( itemData => {
                if (!itemData.specialist || (itemData.specialist.id in specialists)) {
                    return;
                }
                if (departmentId && !(itemData.departments || []).some( d => d.id === departmentId )) {
                    return;
                }
                allSpecialistsData.push(itemData.specialist);
                specialists[itemData.specialist.id] = true;
            });
        });
        if (allSpecialistsData.length > 1) {
            // add the option for 'any specialist'.
            allSpecialistsData.splice(0, 0, { id: specialistAnyID });
        }
        return (<>
                    <div className="appBookingStepTitle"> { stepTitle('step.specialist', stepIndex) } </div>
                    <CustomList
                        variant="tiles"
                        items={ allSpecialistsData } onSelectItem={onSelectSpecialist}
                        selectedId={bookingData.step_choose_specialist.specialistId}
                        itemContent={specialistItemContent}
                        maxVisible={8} moreLabel={moreLabel} />
                </>);
    }

    function contentForStep_service(stepIndex) {
        return (<>
                <ServicesWithNextAppSlot allSkus={fetchData.data}
                                         appBookingConfigs={props.configs}
                                         restrictSkuId={bookingData.restrictSkuId}
                                         departmentId={bookingData.step_choose_department.departmentId}
                                         specialistId={bookingData.step_choose_specialist.specialistId}
                                         specialistFullName={getSpecialistFullName}
                                         specialistAnyID={specialistAnyID}
                                         selectedService={bookingData.step_choose_service}
                                         selectedBookingSlot={bookingData.step_choose_slot.bookingSlot}
                                         onChangeFacetedFilter={onChangeFacetedFilter}
                                         onSelectService={onSelectService}
                                         onSelectMoreSlots={onSelectMoreSlots}
                                         onSelectServiceAndSlot={onSelectServiceAndSlot}
                                         filterSelections={bookingData.step_choose_service.filterSelections}
                                         apiBase={apiBase}
                                         integrationId={bookingData.integrationId}
                                         organizationId={bookingData.organizationId}
                                         refreshKey={slotsRefreshKey}
                                         maxSlotsPerItem={2}
                                         maxVisible={4}
                                         moreLabel={moreLabel}
                                         title={stepTitle('step.service', stepIndex)}
                                         ltext={ltext}
                                         rawTextByKey={getRawTextByKey} />
                { reservationCountdown() }
            </>);
    }

    // the duration, location and price of the chosen service
    function serviceMeta(service) {
        return (
            <div className="appBookingServiceMeta">
                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrIcon"> <ClockIcon /> </div>
                    <div className="appBookingServiceAttrContent"> { minutesText(service.sku.duration) } </div>
                </div>
                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrIcon"> <LocationIcon /> </div>
                    <div className="appBookingServiceAttrContent"> { service.location.name } </div>
                </div>
                { priceText(service.sku) && <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrContent"> { priceText(service.sku) } </div>
                </div> }
            </div>
        );
    }

    function contentForStep_dateAndTime(stepIndex) {
        let service = findSelectedService();
        return (<>
                { service && (
                    <SelectionCard title={getRawTextByKey('step.service.done')}>
                        <div className="appBookingSelectionHighlight"> { serviceTitle(service) } </div>
                        { serviceMeta(service) }
                    </SelectionCard> ) }
                <div className="appBookingStepTitle"> { stepTitle('step.slot', stepIndex) } </div>
                <ChooseAppSlot key={slotsRefreshKey} apiBase={apiBase} integrationId={bookingData.integrationId} skuId={bookingData.step_choose_service.skuId}
                                    specialistId={bookingData.step_choose_service.specialistId} scheduleIds={bookingData.step_choose_service.scheduleIds} organizationId={bookingData.organizationId}
                                    maxDaysToShow={ props.configs.maxDaysToShow ? props.configs.maxDaysToShow : 3 }
                                    initialSlotsPerDay={12}
                                    onSelectSlot={onSelectBookingSlot}
                                    selectedBookingSlot={bookingData.step_choose_slot.bookingSlot}
                                    notice={slotNotice ? getRawTextByKey(slotNotice) : null}
                                    ltext={ltext}
                                    rawTextByKey={getRawTextByKey}
                >
                    { reservationCountdown() }
                </ChooseAppSlot>
            </>);
    }

    function getSubmitBookingBtnStatus() {
        //take into consideration if name, email and mobile are mandatory
        return ( (bookingData.step_personal_data.name.length > 0) || (! mandatoryPersonalData.includes('name')) ) &&
                ((bookingData.step_personal_data.email.length > 0) || (! mandatoryPersonalData.includes('email')) ) &&
                ((bookingData.step_personal_data.mobile.length > 0) || (! mandatoryPersonalData.includes('mobile')) ) &&
                ((bookingData.step_personal_data.acceptTerms === true) &&
                (Object.keys(bookingData.step_personal_data.errors).length === 0) && ! bookingStatus.submit );
    }

    function selectedSlotCard() {
        let bookingSlot = bookingData.step_choose_slot.bookingSlot;
        let service = findSelectedService();
        if (!bookingSlot || !service) {
            return null;
        }
        let startDate = new Date(bookingSlot.slot.startDate);
        let owners = selectedSlotOwnerNames(service);
        return (
            <SelectionCard title={getRawTextByKey('step.slot.done')}>
                <div className="appBookingSelectionHighlight">
                    { ltext.textValue(getRawTextByKey('step.slot.dayAtTime'), formatLocalizedDayMonth(startDate, ltext.locale), format(startDate, 'HH:mm')) }
                </div>
                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrIcon"> <UserIcon /> </div>
                    <div className="appBookingServiceAttrContent"> { serviceTitle(service) } </div>
                </div>
                { serviceMeta(service) }
                { owners.length > 0 && <div className="appBookingServiceAttr appBookingServiceResources">
                    <div className="appBookingServiceAttrContent"> { getRawTextByKey('service.assigned') }: { owners.join(', ') } </div>
                </div> }
                { reservationCountdown() }
            </SelectionCard>
        );
    }

    function contentForStep_personalData(stepIndex) {
        return (<>
                { selectedSlotCard() }
                <div className="appBookingStepTitle"> { stepTitle('step.personalInfo', stepIndex) } </div>
                <StandardCustomerForm customerData={bookingData.step_personal_data} onChange={onChangeCustomerData} 
                                      onBlur={onBlurCustomerData} ltext={ltext} 
                                      rawTextByKey={getRawTextByKey}
                                      configs={props.configs} />
                { bookingStatus.status === 'error' && ( <div className="appBookingErrorText"> { getRawTextByKey('booking.error') } </div>) }
            </>);
    }

    function contentForStep_confirmation() {
        let service = findSelectedService();
        let bookingSlot = bookingData.step_choose_slot.bookingSlot;
        let personal = bookingData.step_personal_data;
        let rows = [];
        let departmentId = bookingData.step_choose_department.departmentId;
        let department = departmentId ? findDepartment(departmentId) : null;
        if (department) {
            rows.push({ id: 'department', label: getRawTextByKey('summary.department'), value: department.name });
        }
        if (service) {
            let owners = selectedSlotOwnerNames(service);
            rows.push({ id: 'service', label: getRawTextByKey('summary.service'),
                        value: [ service.sku.name,
                                 (service.specialist && showSpecialistName()) ? getSpecialistFullName(service.specialist) : null,
                                 owners.length > 0 ? owners.join(', ') : null ] });
            rows.push({ id: 'location', label: getRawTextByKey('service.address'), value: service.location.name });
        }
        if (bookingSlot) {
            let startDate = new Date(bookingSlot.slot.startDate);
            let time = format(startDate, 'HH:mm') + (service ? ` (${minutesText(service.sku.duration)})` : '');
            rows.push({ id: 'dateTime', label: getRawTextByKey('summary.dateTime'), value: [ formatLocalizedLongDate(startDate, ltext.locale), time ] });
        }
        if (service && priceText(service.sku)) {
            rows.push({ id: 'price', label: getRawTextByKey('service.price'), value: priceText(service.sku) });
        }
        rows.push({ id: 'personal', label: getRawTextByKey('booking.details.personal'), value: [ personal.name, personal.mobile, personal.email ] });

        return (<>
                <div className="appBookingSuccessCard">
                    <div className="appBookingSuccessIcon"> <CheckCircleIcon /> </div>
                    <div className="appBookingSuccessTitle"> { getRawTextByKey('booking.success') } </div>
                    <div className="appBookingSuccessRefLabel"> { getRawTextByKey('booking.ref') } </div>
                    <div className="appBookingSuccessRef"> { bookingData.step_confirmation.bookingConfirmationId } </div>
                </div>
                <DetailsTable rows={rows} />
            </>);
    }

    function contentForStep(stepName, stepIndex) {
        switch (stepName) {
            case 'step_choose_department':
                return contentForStep_category(stepIndex);
            case 'step_choose_specialist':
                return contentForStep_specialist(stepIndex);
            case 'step_choose_service':
                return contentForStep_service(stepIndex);
            case 'step_choose_slot':
                return contentForStep_dateAndTime(stepIndex);
            case 'step_personal_data':
                return contentForStep_personalData(stepIndex);
            case 'step_confirmation':
                return contentForStep_confirmation(stepIndex);
            default:
                return null;
        }
    }

    function footerForStep() {
        if (bookingData.step === 'step_confirmation') {
            return ( <FrameNavigation nextLabel={getRawTextByKey('cta.newBooking')} onNext={onNewBooking} /> );
        }
        // the other steps move on as soon as an option is chosen
        let isPersonalData = bookingData.step === 'step_personal_data';
        if (!isPersonalData && (stepIndexOf(bookingData.step) <= 0)) {
            // no button to show, so no footer taking room at the bottom of the screen
            return null;
        }
        return ( <FrameNavigation backLabel={ stepIndexOf(bookingData.step) > 0 ? getRawTextByKey('cta.back') : null }
                                  onBack={onBack} backDisabled={bookingStatus.submit}
                                  nextLabel={isPersonalData ? getRawTextByKey('ctaBooking') : null}
                                  onNext={createBooking} nextDisabled={!getSubmitBookingBtnStatus()} /> );
    }

    function frame(content, stepper, footer, title, subtitle, summary, stepKey) {
        return (
            <WidgetFrame title={title || getRawTextByKey('booking.title')}
                         subtitle={subtitle !== undefined ? subtitle : getRawTextByKey('booking.subtitle')}
                         stepper={stepper} summary={summary} footer={footer} stepKey={stepKey}>
                { content }
            </WidgetFrame>
        );
    }

    function messageContent(keyText, isError) {
        return ( <div className={(isError ? "appBookingErrorText " : "appBookingTextNotImportant ") + "appBookingMessage"}> 
            { isError && <div className="appBokingErrorIcon"> <XCircle /> </div> }
            <div> { getRawTextByKey(keyText) } </div>
        </div> );
    }

    function getEventContent() {
        const title = getRawTextByKey('booking.details.title');
        const subtitle = getRawTextByKey('booking.details.subtitle');
        if (eventData.fetching || eventData.status === 'initial' || fetchData.fetching || fetchData.status === 'not_fetched') {
            return frame(messageContent('booking.details.loading', false), null, null, title, subtitle);
        }

        if (eventData.status === 'not_found') {
            return frame(messageContent('booking.details.notFound', true), null, null, title, subtitle);
        }

        if (eventData.status === 'error' || fetchData.status === 'error') {
            return frame(messageContent('booking.details.error', true), null, null, title, subtitle);
        }

        const baseDetails = buildEventDetails(eventData.data, fetchData.data);
        if (!baseDetails) {
            return frame(messageContent('booking.details.notFound', true), null, null, title, subtitle);
        }

        const startDateObj = new Date(baseDetails.startDate);
        const languageForDate = baseDetails.language || ltext.locale;

        const detailsWithFormatted = {
            ...baseDetails,
            prettyDateTime: formatLocalizedDateTime(startDateObj, languageForDate),
            longDate: formatLocalizedLongDate(startDateObj, languageForDate),
            timeStr: format(startDateObj, 'HH:mm')
        };

        if (eventMode === 'reschedule') {
            return (
                <RescheduleBooking
                    apiBase={apiBase}
                    eventDetails={detailsWithFormatted}
                    organizationId={bookingData.organizationId}
                    ltext={ltext}
                    getRawTextByKey={getRawTextByKey}
                    appBookingConfigs={props.configs}
                    onBack={() => setEventMode('view')}
                    onDone={onRescheduleDone}
                />
            );
        }

        return ( <BookingEventDetails
                    details={detailsWithFormatted}
                    ltext={ltext}
                    title={title}
                    subtitle={subtitle}
                    cancelState={cancelState}
                    onReschedule={onClickReschedule}
                    onCancel={onClickCancel}
                    onConfirmCancel={onConfirmCancel}
                    onDismissCancel={onDismissCancel}
                    getRawTextByKey={getRawTextByKey}
                    appBookingConfigs={props.configs}
                />
        );
    }

    function getMainContent() {
        if (eventMode !== 'standard') {
            return getEventContent();
        }

        if (fetchData.status === 'no_integrationIdParam') {
            return frame(<div className="appBookingErrorText appBookingMessage"> Invalid config params </div>);
        }
        if (fetchData.status === 'error') {
            return frame(messageContent('error.generic', true));
        }
        if ((fetchData.status !== 'success') || !bookingData.steps) {
            return frame(messageContent('loading', false));
        }

        const steps = bookingData.steps;
        const stepper = ( <Stepper steps={ steps.map( stepName => ({ id: stepName, label: getRawTextByKey('stepper.' + stepName), group: stepGroups[stepName] }) ) }
                                   groupLabels={{ service: getRawTextByKey('stepper.group.service'),
                                                  details: getRawTextByKey('stepper.group.details'),
                                                  confirmation: getRawTextByKey('stepper.group.confirmation') }}
                                   currentId={bookingData.step} /> );

        return frame(contentForStep(bookingData.step, stepIndexOf(bookingData.step)), stepper, footerForStep(), undefined, undefined,
                     choicesSummary(), bookingData.step);
    }


   return (
       <React.StrictMode>
           <div className="appBookingWidget" ref={widgetRef}>
             <div className="appBookingContainer">
               { getMainContent() }
             </div>
           </div>
       </React.StrictMode>
   );}
