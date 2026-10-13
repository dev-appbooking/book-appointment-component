import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { BookingSummary } from './BookingSummary.jsx';
import { StepSummary } from './StepSummary.jsx';
import { PublicNextAppSlot } from './PublicNextAppSlot.jsx';
import { ChooseAppSlot } from './ChooseAppSlot.jsx';
import { httpRequest } from './HttpRequest';
import { format } from 'date-fns';
import { formatLocalizedDateTime } from './utils/formatters';
import { ServicePrice, hasPrice } from './utils/Utils.js';
import { ReservationCountdown } from './ReservationCountdown.jsx';

export function RescheduleBooking({ apiBase, eventDetails, organizationId, ltext, getRawTextByKey, appBookingConfigs }) {
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

    function onBlurTerms(e) {

    }

    function canSubmit() {
        return (
            !!rescheduleData.selectedSlot &&
            !!reservation &&
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
            setRescheduleStatus({
                submit: false,
                status: 'error',
                confirmationId: null
            });
            setRescheduleData(prev => ({ ...prev, step: 'reschedule_confirmation' }));
        } finally {
            submittingRef.current = false;
        }
    }

    function contentForStep_current(stepIndex) {
        const customer = eventDetails.customer || {};
        const specialistName = eventDetails.specialist
            ? `${eventDetails.specialist.title || ''} ${eventDetails.specialist.firstName || ''} ${eventDetails.specialist.lastName || ''}`.trim()
            : '-';
        const locationName = eventDetails.location ? `${eventDetails.location.name || ''}` : '-';
        const serviceName = eventDetails.service ? eventDetails.service.name : '-';

        const title = ltext.textValue(ltext.text('reschedule.step.current'), stepIndex + 1);

        const dateTimeClass = "appBookingAttributesLine " + (rescheduleData.step === "reschedule_confirmation" ? "appBookingTextStrike appBookingTextNotImportant": "");
        return (
            <StepSummary title={title} showEdit={false} ltext={ltext}>
                <div className="appBokingServiceLineItem appBookingServiceHeader">
                    {serviceName}
                </div>
                { (!hideSpecialistName) && (eventDetails.specialist || eventDetails.specialistId) && <div className="appBokingServiceLineItem appBookingServiceSpecialist">
                   {specialistName}
                </div> }
                { (eventDetails.assignedNames || []).length > 0 && <div className="appBokingServiceLineItem appBookingAssignedResources">
                   {ltext.text('service.assigned')}: {eventDetails.assignedNames.join(', ')}
                </div> }

                { eventDetails.service && hasPrice(eventDetails.service) && <div className="appBokingServiceLineItem appBookingServiceSpecialist">
                        <ServicePrice sku={ eventDetails.service } />
                    </div> }
                <div className="appBokingServiceLineItem">
                    {ltext.text('customer.name')}: {customer.name || '-'}
                </div>
                <div className="appBookingAttributesLine">
                    {ltext.text('customer.email')}: {customer.email || '-'}
                </div>
                <div className="appBookingAttributesLine">
                    {ltext.text('customer.mobile')}: {customer.mobile || '-'}
                </div>
                <div className="appBookingAttributesLine">
                    {ltext.text('service.address')}: {locationName}
                </div>
                <div className={dateTimeClass}>
                     {ltext.textValue(ltext.text('step.slot.date'), eventDetails.prettyDateTime)}
                </div>
                <div className={dateTimeClass}>
                    {ltext.textValue(ltext.text('step.slot.hour'), eventDetails.timeStr)}
                </div>
            </StepSummary>
        );
    }

    function getTermsCheckboxLabelContent() {
        let rawTermsText = getRawTextByKey('customer.acceptTerms');
        if (appBookingConfigs && appBookingConfigs.termsAndConditions) {
            let linksArray = appBookingConfigs.termsAndConditions.links;
            if (linksArray && Array.isArray(linksArray)) {
                //split the rawTermsText to tokens delimited by {0}, {1}, {2}, {3}...
                let strTokens = rawTermsText.split(/\{[0-9]*\}/);
                return ( strTokens.map( (token, index) => {
                    return ( <> {token} { (index < linksArray.length ) && (<a href={linksArray[index].link} target="_new_blank"> { getRawTextByKey(linksArray[index].label_key) }</a>)}&nbsp; </> )
                } ) )
            }
        }
        return (<span> { rawTermsText } </span>);
    } 

    function contentForStep_newSlot(stepIndex) {
        // step activ: alegere slot + checkbox + buton
        if (rescheduleData.step === 'reschedule_choose_slot') {
            const title = ltext.textValue(ltext.text('reschedule.step.newSlot'), stepIndex + 1);

            return (
                <div>
                    <div className="appBookingStepTitle appBookingActiveStepTitle">{title}</div>
                    <ChooseAppSlot
                        key={slotsRefreshKey}
                        apiBase={apiBase}
                        integrationId={eventDetails.integrationId}
                        skuId={eventDetails.service ? eventDetails.service.id : eventDetails.serviceSkuId}
                        specialistId={eventDetails.specialist ? eventDetails.specialist.id : eventDetails.specialistId}
                        scheduleIds={eventDetails.scheduleIds}
                        organizationId={organizationId}
                        maxDaysToShow={3}
                        initialSlotsPerDay={10}
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

                    <div className="appBookingTermsContainer">
                        <fieldset className="appBookingFormFieldSet">
                            <div className="appBookingFormFieldSetLine">
                                <input type="checkbox" checked={rescheduleData.acceptTerms} name="acceptTerms" className="appBookingFormInputCheckbox"
                                    onChange={ onToggleTerms }
                                    onBlur={ onBlurTerms }
                                /> 
                                <label class="appBookingFormTermsLabel" htmlFor="acceptTerms">
                                { getTermsCheckboxLabelContent() } 
                                </label>
                            </div>
                        </fieldset>

                    </div>

                    {rescheduleStatus.status === 'error' && (
                        <div className="appBookingErrorText">
                            {ltext.text('reschedule.error')}
                        </div>
                    )}

                    <div className="appBookingCtaContainer">
                        <button
                            disabled={!canSubmit()}
                            className="appBookingCtaButton"
                            onClick={submitReschedule}
                        >
                            {ltext.text('reschedule.cta')}
                        </button>
                    </div>
                </div>
            );
        }

        // step deja completat – afișăm sumarul noului slot
        if (rescheduleData.selectedSlot) {
            const startDate = new Date(rescheduleData.selectedSlot.slot.startDate);
            const pretty = formatLocalizedDateTime(startDate, ltext.locale);
            const timeStr = ltext.textValue(
                ltext.text('step.slot.hour'),
                format(startDate, 'HH:mm')
            );
            const title = ltext.textValue(
                ltext.text('reschedule.step.newSlot.done'),
                stepIndex + 1
            );

            return (
                <StepSummary title={title} showEdit={false} ltext={ltext}>
                    <div className="appBookingAttributesLine">{pretty}</div>
                    <div className="appBookingAttributesLine">{timeStr}</div>
                </StepSummary>
            );
        }

        // încă nu există slot ales
        return (
            <div className="appBookingStepTitle">
                {ltext.textValue(ltext.text('reschedule.step.newSlot'), stepIndex + 1)}
            </div>
        );
    }

    function contentForStep_confirmation(stepIndex) {
        const title = ltext.textValue(
            ltext.text('reschedule.step.confirmation'),
            stepIndex + 1
        );

        if (rescheduleData.step === 'reschedule_confirmation') {
            if (!['success', 'error'].includes(rescheduleStatus.status)) {
                return null;
            }

            return (
                <StepSummary title={title} showEdit={false} ltext={ltext}>
                    {rescheduleStatus.status === 'success' && (
                        <>
                            <div className="appBookingAttributesLine">
                                {ltext.text('reschedule.success')}
                            </div>
                            {rescheduleStatus.confirmationId && (
                                <div className="appBookingAttributesLine">
                                    {ltext.text('reschedule.ref')}{' '}
                                    <span className="text-xl">
                                        {rescheduleStatus.confirmationId}
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                    {rescheduleStatus.status === 'error' && (
                        <div className="appBookingErrorText">
                            {ltext.text('reschedule.error')}
                        </div>
                    )}
                </StepSummary>
            );
        }

        return (
            <div className="appBookingStepTitle">
                {ltext.textValue(ltext.text('reschedule.step.confirmation'), stepIndex + 1)}
            </div>
        );
    }

    function contentForStep(stepName, stepIndex) {
        switch (stepName) {
            case 'reschedule_current':
                return contentForStep_current(stepIndex);
            case 'reschedule_choose_slot':
                return contentForStep_newSlot(stepIndex);
            case 'reschedule_confirmation':
                return contentForStep_confirmation(stepIndex);
            default:
                return null;
        }
    }

    const steps = ['reschedule_current', 'reschedule_choose_slot', 'reschedule_confirmation'];

    return (
        <BookingSummary
            contentForStep={contentForStep}
            steps={steps}
            ltext={ltext}
            appBookingConfigs={appBookingConfigs}
        />
    );
}
