import * as React from 'react';
import { useState } from 'react';
import { BookingSummary } from './BookingSummary.jsx';
import { StepSummary } from './StepSummary.jsx';
import { PublicNextAppSlot } from './PublicNextAppSlot.jsx';
import { httpRequest } from './HttpRequest';
import { format } from 'date-fns';
import { formatLocalizedDateTime } from './utils/formatters';

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

    function onSelectSlot(slot) {
        setRescheduleData(prev => ({ ...prev, selectedSlot: slot }));
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
            rescheduleData.acceptTerms &&
            !rescheduleStatus.submit
        );
    }

    async function submitReschedule() {
        if (!rescheduleData.selectedSlot || !eventDetails) {
            return;
        }

        try {
            setRescheduleStatus(prev => ({ ...prev, submit: true, status: 'not_created' }));

            const bodyReq = {
                integrationId: eventDetails.integrationId,
                serviceSkuId: eventDetails.serviceSkuId,
                specialistId: eventDetails.specialistId,
                scheduleId: rescheduleData.selectedSlot.slot.scheduleId,
                bookingDate: rescheduleData.selectedSlot.slot.startDate,
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            };


            const res = await httpRequest(
                'POST',
                apiBase + `/api/event/booking/${eventDetails.id}/reschedule`,
                bodyReq,
                { 'content-type': 'application/json' }
            );

            setRescheduleStatus({
                submit: false,
                status: 'success',
                confirmationId: res && res.id ? res.id : null
            });
            setRescheduleData(prev => ({ ...prev, step: 'reschedule_confirmation' }));
        } catch (e) {
            setRescheduleStatus({
                submit: false,
                status: 'error',
                confirmationId: null
            });
            setRescheduleData(prev => ({ ...prev, step: 'reschedule_confirmation' }));
        }
    }

    function contentForStep_current(stepIndex) {
        const customer = eventDetails.customer || {};
        const specialistName = eventDetails.specialist
            ? `${eventDetails.specialist.title || ''} ${eventDetails.specialist.firstName || ''} ${eventDetails.specialist.lastName || ''}`.trim()
            : '-';
        const locationName = eventDetails.location
            ? `${eventDetails.location.name || ''}${eventDetails.location.city ? ' (' + eventDetails.location.city + ')' : ''}`
            : '-';

        const title = ltext.textValue(ltext.text('reschedule.step.current'), stepIndex + 1);

        return (
            <StepSummary title={title} showEdit={false} ltext={ltext}>
                <div className="appBookingAttributesLine">
                    {ltext.text('customer.name')}: {customer.name || '-'}
                </div>
                <div className="appBookingAttributesLine">
                    {ltext.text('customer.email')}: {customer.email || '-'}
                </div>
                <div className="appBookingAttributesLine">
                    {ltext.text('customer.mobile')}: {customer.mobile || '-'}
                </div>
                <div className="appBookingAttributesLine">
                    {ltext.text('service.specialist')}: {specialistName}
                </div>
                <div className="appBookingAttributesLine">
                    {ltext.text('service.address')}: {locationName}
                </div>
                <div className="appBookingAttributesLine">
                    {ltext.text('booking.details.dateTime')}: {eventDetails.prettyDateTime}
                </div>
                <div className="appBookingAttributesLine">
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
                    <PublicNextAppSlot
                        apiBase={apiBase}
                        skuId={eventDetails.service ? eventDetails.service.id : eventDetails.serviceSkuId}
                        specialistId={eventDetails.specialist ? eventDetails.specialist.id : eventDetails.specialistId}
                        locationId={eventDetails.location ? eventDetails.location.id : eventDetails.locationId}
                        organizationId={organizationId}
                        maxDaysToShow={3}
                        initialSlotsPerDay={5}
                        onSelectSlot={onSelectSlot}
                        selectedBookingSlot={rescheduleData.selectedSlot}
                        ltext={ltext}
                        rawTextByKey={getRawTextByKey}
                    />

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
