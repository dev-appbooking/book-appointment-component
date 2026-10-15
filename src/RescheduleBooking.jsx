import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { ChooseAppSlot } from './ChooseAppSlot.jsx';
import { httpRequest } from './HttpRequest';
import { format } from 'date-fns';
import { formatLocalizedDayMonth, formatLocalizedLongDate } from './utils/formatters';
import { CheckCircleIcon, UserIcon } from './utils/Utils.js';
import { ReservationCountdown } from './ReservationCountdown.jsx';
import { WidgetFrame, FrameNavigation } from './WidgetFrame.jsx';
import { Stepper } from './Stepper.jsx';
import { SelectionCard } from './SelectionCard.jsx';
import { DetailsTable } from './DetailsTable.jsx';
import { TermsLabel } from './StandardCustomerForm.jsx';
import { eventDetailsRows } from './BookingEventDetails.jsx';

const rescheduleSteps = ['reschedule_choose_slot', 'reschedule_confirmation'];

/*
Moves an existing booking to another slot: the new date & time (recalling the current booking), the confirmation.
onBack returns to the booking details, onDone is called once the user leaves the confirmation.
*/
export function RescheduleBooking({ apiBase, eventDetails, organizationId, ltext, getRawTextByKey, appBookingConfigs, onBack, onDone }) {
    const [rescheduleData, setRescheduleData] = useState({
        step: 'reschedule_choose_slot',
        selectedSlot: null,
        acceptTerms: false
    });

    const [rescheduleStatus, setRescheduleStatus] = useState({
        submit: false,
        status: 'initial',
        confirmationId: null
    });
    const hideSpecialistName = appBookingConfigs.showSpecialistNameOnServiceItem === false ;

    // the hold on the selected slot: { id, expiresAt (ms) }
    const [reservation, setReservation] = useState(null);
    // text key of the warning shown above the slots, e.g. when the hold expired
    const [slotNotice, setSlotNotice] = useState(null);
    // changing it reloads the available slots
    const [slotsRefreshKey, setSlotsRefreshKey] = useState(0);
    const reservingRef = useRef(false);
    const submittingRef = useRef(false);

    const integrationId = eventDetails.integrationId;

    useEffect(() => {
        if (!reservation) {
            return;
        }
        let timer = setTimeout(() => {
            // a reschedule in flight settles it: success moves the booking, a 409 sends the user back
            if (submittingRef.current) {
                return;
            }
            returnToSlotChoice('step.slot.reservationExpired');
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
        httpRequest('POST', apiBase + `/api/integration/${integrationId}/event/reservation/${encodeURIComponent(res.id)}/cancel`, {}, { 'content-type': 'application/json' })
            .catch(() => { /* the hold expires on its own */ });
    }

    function returnToSlotChoice(noticeKey) {
        setReservation(null);
        setSlotNotice(noticeKey);
        setSlotsRefreshKey(k => k + 1);
        setRescheduleData(prev => ({ ...prev, step: 'reschedule_choose_slot', selectedSlot: null }));
    }

    function isSameSlot(a, b) {
        const schedules = (slot) => (slot.scheduleIds || [slot.scheduleId]).join(',');
        return !!a && !!b && (a.slot.startDate === b.slot.startDate) && (schedules(a.slot) === schedules(b.slot));
    }

    /*
    Holds the chosen slot so the booking can be moved onto it. Any previous hold is released first.
    */
    async function onSelectSlot(slot) {
        if (reservingRef.current) {
            return;
        }
        if (isReservationValid(reservation) && isSameSlot(slot, rescheduleData.selectedSlot)) {
            return;
        }

        reservingRef.current = true;
        releaseReservation(reservation);
        setReservation(null);
        setRescheduleData(prev => ({ ...prev, selectedSlot: null }));
        try {
            let res = await httpRequest('POST', apiBase + `/api/integration/${integrationId}/event/reservation`, { token: slot.slot.token }, { 'content-type': 'application/json' });
            setReservation({ id: res.id, expiresAt: new Date(res.expires_at).getTime() });
            setSlotNotice(null);
            setRescheduleData(prev => ({ ...prev, selectedSlot: slot }));
        } catch (e) {
            // 409: taken or held by someone else, 400: the slot token is no longer valid
            returnToSlotChoice(([400, 409].includes(e && e.status)) ? 'step.slot.unavailable' : 'error.generic');
        } finally {
            reservingRef.current = false;
        }
    }

    function onToggleTerms(e) {
        const checked = e.target.checked;
        setRescheduleData(prev => ({ ...prev, acceptTerms: checked }));
    }

    function canSubmit() {
        return (
            !!rescheduleData.selectedSlot &&
            isReservationValid(reservation) &&
            rescheduleData.acceptTerms &&
            !rescheduleStatus.submit
        );
    }

    async function submitReschedule() {
        if (!rescheduleData.selectedSlot || !eventDetails) {
            return;
        }
        if (!isReservationValid(reservation)) {
            returnToSlotChoice('step.slot.reservationExpired');
            return;
        }

        try {
            submittingRef.current = true;
            setRescheduleStatus(prev => ({ ...prev, submit: true, status: 'not_created' }));

            const bodyReq = {
                reservationId: reservation.id,
                bookingDate: rescheduleData.selectedSlot.slot.startDate,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: ltext.locale
            };

            const res = await httpRequest(
                'POST',
                apiBase + `/api/integration/${integrationId}/event/booking/${eventDetails.id}/rescheduleFromReservation`,
                bodyReq,
                { 'content-type': 'application/json' }
            );
            setReservation(null);

            setRescheduleStatus({
                submit: false,
                status: 'success',
                confirmationId: res && res.id ? res.id : null
            });
            setRescheduleData(prev => ({ ...prev, step: 'reschedule_confirmation' }));
        } catch (e) {
            if ((e && e.status === 409) || !isReservationValid(reservation)) {
                // the hold expired or the slot can no longer be booked
                setRescheduleStatus({ submit: false, status: 'initial', confirmationId: null });
                returnToSlotChoice('step.slot.reservationExpired');
                return;
            }
            setRescheduleStatus({ submit: false, status: 'error', confirmationId: null });
        } finally {
            submittingRef.current = false;
        }
    }

    function serviceTitle() {
        let name = eventDetails.service ? eventDetails.service.name : '-';
        if (!hideSpecialistName && eventDetails.specialist) {
            const specialistName = `${eventDetails.specialist.title || ''} ${eventDetails.specialist.firstName || ''} ${eventDetails.specialist.lastName || ''}`.trim();
            if (specialistName) {
                name += ' - ' + specialistName;
            }
        }
        return name;
    }

    function slotDayAtTime(date) {
        return ltext.textValue(getRawTextByKey('step.slot.dayAtTime'), formatLocalizedDayMonth(date, ltext.locale), format(date, 'HH:mm'));
    }

    function contentForStep_newSlot() {
        return (
            <>
                <SelectionCard title={getRawTextByKey('reschedule.step.current')}>
                    <div className="appBookingSelectionHighlight">{ slotDayAtTime(new Date(eventDetails.startDate)) }</div>
                    <div className="appBookingServiceAttr">
                        <div className="appBookingServiceAttrIcon"> <UserIcon /> </div>
                        <div className="appBookingServiceAttrContent"> { serviceTitle() } </div>
                    </div>
                </SelectionCard>

                <div className="appBookingStepTitle">{ getRawTextByKey('reschedule.step.newSlot') }</div>
                <ChooseAppSlot
                    key={slotsRefreshKey}
                    apiBase={apiBase}
                    integrationId={eventDetails.integrationId}
                    skuId={eventDetails.service ? eventDetails.service.id : eventDetails.serviceSkuId}
                    specialistId={eventDetails.specialist ? eventDetails.specialist.id : eventDetails.specialistId}
                    scheduleIds={eventDetails.scheduleIds}
                    organizationId={organizationId}
                    maxDaysToShow={3}
                    initialSlotsPerDay={12}
                    onSelectSlot={onSelectSlot}
                    selectedBookingSlot={rescheduleData.selectedSlot}
                    notice={slotNotice ? getRawTextByKey(slotNotice) : null}
                    ltext={ltext}
                    rawTextByKey={getRawTextByKey}
                >
                    { reservation && (
                        <ReservationCountdown expiresAt={reservation.expiresAt} text={getRawTextByKey('step.slot.reservationHeldFor')} />
                    )}
                </ChooseAppSlot>

                <div className="appBookingForm">
                    <div className="appBookingFormField">
                        <div className="appBookingFormFieldSetLine">
                            <input type="checkbox" id="appBooking_rescheduleTerms" checked={rescheduleData.acceptTerms} name="acceptTerms" className="appBookingFormInputCheckbox"
                                onChange={ onToggleTerms } />
                            <label className="appBookingFormTermsLabel" htmlFor="appBooking_rescheduleTerms">
                                <TermsLabel configs={appBookingConfigs} rawTextByKey={getRawTextByKey} />
                            </label>
                        </div>
                    </div>
                </div>

                {rescheduleStatus.status === 'error' && (
                    <div className="appBookingErrorText">
                        {getRawTextByKey('reschedule.error')}
                    </div>
                )}
            </>
        );
    }

    function contentForStep_confirmation() {
        const newDate = rescheduleData.selectedSlot ? new Date(rescheduleData.selectedSlot.slot.startDate) : null;
        const rows = eventDetailsRows(eventDetails, ltext, getRawTextByKey, appBookingConfigs)
            .filter( row => row && (row.id !== 'dateTime') && (row.id !== 'personal') );
        rows.push({ id: 'oldDate', label: getRawTextByKey('reschedule.oldDate'),
                    value: <span className="appBookingTextStrike appBookingTextNotImportant">{ `${eventDetails.longDate}, ${eventDetails.timeStr}` }</span> });
        if (newDate) {
            rows.push({ id: 'newDate', label: getRawTextByKey('reschedule.newDate'),
                        value: `${formatLocalizedLongDate(newDate, ltext.locale)}, ${format(newDate, 'HH:mm')}` });
        }

        return (
            <>
                <div className="appBookingSuccessCard">
                    <div className="appBookingSuccessIcon"> <CheckCircleIcon /> </div>
                    <div className="appBookingSuccessTitle"> { getRawTextByKey('reschedule.success') } </div>
                    { rescheduleStatus.confirmationId && <>
                        <div className="appBookingSuccessRefLabel"> { getRawTextByKey('reschedule.ref') } </div>
                        <div className="appBookingSuccessRef"> { rescheduleStatus.confirmationId } </div>
                    </> }
                </div>
                <DetailsTable rows={rows} />
            </>
        );
    }

    // back to the booking details: the held slot is let go
    function onBackStep() {
        releaseReservation(reservation);
        setReservation(null);
        if (onBack) {
            onBack();
        }
    }

    function footer() {
        switch (rescheduleData.step) {
            case 'reschedule_choose_slot':
                return ( <FrameNavigation backLabel={getRawTextByKey('cta.back')} onBack={onBackStep} backDisabled={rescheduleStatus.submit}
                                          nextLabel={getRawTextByKey('reschedule.cta')} onNext={submitReschedule} nextDisabled={!canSubmit()} /> );
            default:
                return ( <FrameNavigation nextLabel={getRawTextByKey('cta.viewBooking')} onNext={onDone} /> );
        }
    }

    function content() {
        switch (rescheduleData.step) {
            case 'reschedule_choose_slot':
                return contentForStep_newSlot();
            default:
                return contentForStep_confirmation();
        }
    }

    const stepLabels = {
        reschedule_choose_slot: getRawTextByKey('reschedule.stepper.newSlot'),
        reschedule_confirmation: getRawTextByKey('reschedule.stepper.confirmation')
    };
    const stepper = ( <Stepper steps={ rescheduleSteps.map( id => ({ id: id, label: stepLabels[id], group: id }) ) } currentId={rescheduleData.step} /> );

    return (
        <WidgetFrame title={getRawTextByKey('reschedule.title')} subtitle={getRawTextByKey('reschedule.subtitle')}
                     stepper={stepper} footer={footer()} stepKey={rescheduleData.step}>
            { content() }
        </WidgetFrame>
    );
}
