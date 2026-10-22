import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { LocalizationText } from '../LocalizationText';
import { httpRequest } from '../HttpRequest';
import { CustomList } from '../CustomList.jsx';
import { StandardCustomerForm } from '../StandardCustomerForm.jsx';
import { ReservationCountdown } from '../ReservationCountdown.jsx';
import { WidgetFrame, FrameNavigation } from '../WidgetFrame.jsx';
import { ChoicesSummary } from '../ChoicesSummary.jsx';
import { Stepper } from '../Stepper.jsx';
import { SelectionCard } from '../SelectionCard.jsx';
import { DetailsTable } from '../DetailsTable.jsx';
import { configurableText, ClockIcon, LocationIcon, XCircle, CheckCircleIcon } from '../utils/Utils.js';
import { formatLocalizedDayMonth, formatLocalizedLongDate } from '../utils/formatters';
import { emptyCustomerData, customerDataAfterChange, customerDataAfterBlur, isCustomerDataComplete } from '../utils/customerData.js';
import { deskLocalizationTexts } from './deskTexts.js';
import { deskOptionsFromCatalog, preselectDeskOption, deskPrice, lowestDeskPrice, hasSeveralPrices, priceLabel,
         dateOfDayKey, dayKeyIn, addMinutesToTime, timeIn } from './deskData.js';
import { ChooseDeskDays } from './ChooseDeskDays.jsx';
import { ChooseDesk } from './ChooseDesk.jsx';

// the steps grouped together by the compact stepper of narrow layouts
const stepGroups = {
    step_desk_service: 'desk',
    step_desk_days: 'details',
    step_desk_seat: 'details',
    step_personal_data: 'details',
    step_confirmation: 'confirmation'
};

function emptySelections() {
    return {
        optionId: null,
        days: [],
        // { time, starts, free, duration }: starts holds the UTC start of each of days, in the same order
        time: null,
        // { seat, area }
        desk: null
    };
}

/*
Books one desk for one or more days through the seating API: choose the desk service and floor, the days
and the start time, the desk, then fill in the personal data. The desk is held from the moment it is chosen
until the booking is made or the hold expires.
*/
export function DeskBookingApp(props) {

    const [ catalog, setCatalog ] = useState({ status: 'not_fetched', options: [], unavailableSkus: [] });
    const [ steps, setSteps ] = useState(null);
    const [ step, setStep ] = useState(null);
    const [ selections, setSelections ] = useState(emptySelections());
    const [ customerData, setCustomerData ] = useState(emptyCustomerData());
    const [ bookingStatus, setBookingStatus ] = useState({ submit: false, status: 'initial' });
    const [ booking, setBooking ] = useState(null);

    // the hold on the chosen desk: { id, expiresAt (ms), seatCode, startsKey, total, currency }
    const [ reservation, setReservation ] = useState(null);
    // text key of the warning shown on the desk or days step, e.g. when the hold expired
    const [ notice, setNotice ] = useState(null);
    // changing it reloads the free desks
    const [ desksRefreshKey, setDesksRefreshKey ] = useState(0);
    const reservingRef = useRef(false);
    const submittingRef = useRef(false);

    const apiBase = props.appBookingApiBaseUrl || 'https://www.appbooking.ro';
    const ltext = new LocalizationText(deskLocalizationTexts, props.locale || 'ro');
    const mandatoryPersonalData = props.configs.step_personal_data.mandatory_data;
    const integrationId = props.integrationId;
    const seatingUrl = apiBase + '/api/integration/' + integrationId + '/seating/';

    function stepsFor(withServiceStep) {
        let result = ['step_desk_days', 'step_desk_seat', 'step_personal_data', 'step_confirmation'];
        if (withServiceStep) {
            result.unshift('step_desk_service');
        }
        return result;
    }

    // the steps and the selections of a new booking; withPreselection applies the deep-link params
    function startBooking(options, withPreselection) {
        let preselection = preselectDeskOption(options, withPreselection ? props.preselectSkuId : null, withPreselection ? props.preselectVenueId : null);
        let newSteps = stepsFor(!preselection.option || (preselection.options.length > 1));
        setSteps(newSteps);
        setSelections({ ...emptySelections(), optionId: preselection.option ? preselection.option.id : null });
        setStep(preselection.option ? 'step_desk_days' : newSteps[0]);
        return preselection.options;
    }

    useEffect(() => {
        (async function() {
            if (!integrationId) {
                setCatalog({ status: 'no_integrationIdParam', options: [], unavailableSkus: [] });
                return;
            }
            try {
                setCatalog(prev => ({ ...prev, status: 'fetching' }));
                let response = await httpRequest('GET', seatingUrl + 'catalog');
                let { options, unavailableSkus } = deskOptionsFromCatalog(response.skus);
                let inScope = startBooking(options, true);
                setCatalog({ status: 'success', options: inScope, unavailableSkus: unavailableSkus });
            } catch (e) {
                setCatalog({ status: 'error', options: [], unavailableSkus: [] });
            }
        })();
    }, []);

    useEffect(() => {
        if (!reservation) {
            return;
        }
        let timer = setTimeout(() => {
            // a booking in flight settles it: success books the desk, a 409 sends the customer back
            if (submittingRef.current) {
                return;
            }
            returnToDeskStep('desk.reservationExpired');
        }, Math.max(0, reservation.expiresAt - Date.now()));
        return () => clearTimeout(timer);
    }, [reservation]);

    function getRawTextByKey(key) {
        return configurableText(key, props.configs, ltext);
    }

    function text(key, ...args) {
        return ltext.textValue(getRawTextByKey(key), ...args);
    }

    function selectedOption() {
        return catalog.options.find( option => option.id === selections.optionId ) || null;
    }

    function isReservationValid(res) {
        return !!res && (res.expiresAt > Date.now());
    }

    function releaseReservation(res) {
        if (!isReservationValid(res)) {
            return;
        }
        httpRequest('POST', apiBase + '/api/integration/' + integrationId + '/event/reservation/' + encodeURIComponent(res.id) + '/cancel', {}, { 'content-type': 'application/json' })
            .catch(() => { /* the hold expires on its own */ });
    }

    function dropReservation() {
        releaseReservation(reservation);
        setReservation(null);
        setNotice(null);
    }

    function returnToDeskStep(noticeKey) {
        setReservation(null);
        setNotice(noticeKey);
        setDesksRefreshKey(k => k + 1);
        setSelections(prev => ({ ...prev, desk: null }));
        setStep('step_desk_seat');
    }

    function stepIndexOf(stepName) {
        return (steps || []).indexOf(stepName);
    }

    function goBackToStep(stepName) {
        if (stepIndexOf(stepName) < stepIndexOf('step_desk_seat')) {
            // back to choosing the days or the floor: the held desk is let go
            dropReservation();
            setSelections(prev => ({ ...prev, desk: null }));
        }
        setStep(stepName);
    }

    function onBack() {
        let previousStep = steps[stepIndexOf(step) - 1];
        if (previousStep) {
            goBackToStep(previousStep);
        }
    }

    function onSelectOption(option) {
        if (option.id === selections.optionId) {
            setStep('step_desk_days');
            return;
        }
        dropReservation();
        setSelections({ ...emptySelections(), optionId: option.id });
        setStep('step_desk_days');
    }

    function onChangeDays(days) {
        dropReservation();
        setSelections(prev => ({ ...prev, days: days, time: null, desk: null }));
    }

    function onSelectTime(timeItem, days) {
        if (selections.time && (selections.time.time === timeItem.time) && (selections.days.join(',') === days.join(','))) {
            setStep('step_desk_seat');
            return;
        }
        dropReservation();
        setSelections(prev => ({ ...prev, days: days, time: timeItem, desk: null }));
        setStep('step_desk_seat');
    }

    /*
    Holds the chosen desk on every chosen day and moves to the personal data step. Any previous hold is released first.
    */
    async function onSelectDesk(desk) {
        if (reservingRef.current) {
            return;
        }
        let option = selectedOption();
        let starts = selections.time.starts;
        let startsKey = starts.join(',');
        if (isReservationValid(reservation) && (reservation.seatCode === desk.seat.code) && (reservation.startsKey === startsKey)) {
            // the customer picked the desk they already hold
            setNotice(null);
            setStep('step_personal_data');
            return;
        }

        reservingRef.current = true;
        releaseReservation(reservation);
        setReservation(null);
        setSelections(prev => ({ ...prev, desk: null }));
        try {
            let body = { serviceSkuId: option.sku.id, venueId: option.venue.id, items: [ { seatCode: desk.seat.code, starts: starts } ] };
            let res = await httpRequest('POST', seatingUrl + 'reservation', body, { 'content-type': 'application/json' });
            setReservation({ id: res.id, expiresAt: new Date(res.expires_at).getTime(), seatCode: desk.seat.code, startsKey: startsKey,
                             total: res.total, currency: res.currency });
            setNotice(null);
            setSelections(prev => ({ ...prev, desk: desk }));
            setStep('step_personal_data');
        } catch (e) {
            // 409: taken on at least one of the days, 400: a start is no longer bookable, 429: too many holds
            let status = e && e.status;
            let noticeKey = (status === 429) ? 'desk.seat.tooManyRequests' : ([400, 409].includes(status) ? 'desk.seat.unavailable' : 'error.generic');
            returnToDeskStep(noticeKey);
        } finally {
            reservingRef.current = false;
        }
    }

    function onChangeCustomerData(property, e) {
        setCustomerData(customerDataAfterChange(customerData, property, e));
    }

    function onBlurCustomerData(property, e) {
        setCustomerData(customerDataAfterBlur(customerData, property, e, mandatoryPersonalData));
    }

    async function createBooking() {
        if (!isReservationValid(reservation)) {
            returnToDeskStep('desk.reservationExpired');
            return;
        }
        try {
            submittingRef.current = true;
            setBookingStatus({ submit: true, status: 'not_created' });
            let body = {
                reservationId: reservation.id,
                customData: { name: customerData.name, mobile: customerData.mobile, email: customerData.email },
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: ltext.locale,
                utm_source: props.utm_params && props.utm_params.utm_source ? props.utm_params.utm_source : null,
                utm_medium: props.utm_params && props.utm_params.utm_medium ? props.utm_params.utm_medium : null,
                utm_campaign: props.utm_params && props.utm_params.utm_campaign ? props.utm_params.utm_campaign : null
            };
            let res = await httpRequest('POST', seatingUrl + 'fromReservation', body, { 'content-type': 'application/json' });
            setReservation(null);
            setBooking(res);
            setStep('step_confirmation');
            setBookingStatus({ submit: false, status: 'success' });
        } catch (e) {
            if ((e && e.status === 409) || !isReservationValid(reservation)) {
                // the hold expired, was released or a day can no longer be booked
                setBookingStatus({ submit: false, status: 'initial' });
                returnToDeskStep('desk.reservationExpired');
            } else {
                setBookingStatus({ submit: false, status: 'error' });
            }
        } finally {
            submittingRef.current = false;
        }
    }

    function onNewBooking() {
        dropReservation();
        setBooking(null);
        setCustomerData(emptyCustomerData());
        setBookingStatus({ submit: false, status: 'initial' });
        startBooking(catalog.options, false);
    }

    function stepTitle(key) {
        return ltext.textValue(getRawTextByKey(key), stepIndexOf(step) + 1);
    }

    function minutesText(duration) {
        return text('service.minutes', duration);
    }

    function optionTitle(option) {
        return option.sku.name + ' - ' + option.venue.name;
    }

    // "3 days" or the day, when only one is chosen
    function daysShortText(days) {
        if (days.length === 1) {
            return formatLocalizedDayMonth(dateOfDayKey(days[0]), ltext.locale);
        }
        return text('desk.days.count', days.length);
    }

    function timeRangeText(timeItem) {
        return text('desk.times.range', timeItem.time, addMinutesToTime(timeItem.time, timeItem.duration));
    }

    function optionPriceText(option) {
        let lowest = lowestDeskPrice(option);
        return text(hasSeveralPrices(option) ? 'desk.service.fromPerDay' : 'desk.service.perDay', priceLabel(lowest));
    }

    function reservationCountdown() {
        if (!reservation || (step === 'step_confirmation')) {
            return null;
        }
        return ( <ReservationCountdown expiresAt={reservation.expiresAt} text={getRawTextByKey('desk.reservationHeldFor')} /> );
    }

    // the line under the stepper recalling the choices of the previous steps; choosing one goes back to its step
    function choicesSummary() {
        if (step === 'step_confirmation') {
            return null;
        }
        let currentIndex = stepIndexOf(step);
        let items = [];
        function addItem(stepName, id, label, value) {
            let index = stepIndexOf(stepName);
            if ((index >= 0) && (index < currentIndex) && value) {
                items.push({ id: id, label: label, value: value, onSelect: () => { if (!bookingStatus.submit) { goBackToStep(stepName); } } });
            }
        }
        let option = selectedOption();
        addItem('step_desk_service', 'service', getRawTextByKey('desk.summary.service'), option && optionTitle(option));
        addItem('step_desk_days', 'days', getRawTextByKey('desk.summary.days'), selections.days.length > 0 && daysShortText(selections.days));
        addItem('step_desk_days', 'time', getRawTextByKey('desk.summary.time'), selections.time && selections.time.time);
        addItem('step_desk_seat', 'seat', getRawTextByKey('desk.summary.seat'), selections.desk && (selections.desk.seat.label || selections.desk.seat.code));
        return ( <ChoicesSummary items={items} label={getRawTextByKey('summary.label')}
                                 changeLabel={ (choice) => text('summary.change', choice) } /> );
    }

    // the duration, floor and price of the chosen service
    function optionMeta(option) {
        return (
            <div className="appBookingServiceMeta">
                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrIcon"> <ClockIcon /> </div>
                    <div className="appBookingServiceAttrContent"> { minutesText(option.sku.duration) } </div>
                </div>
                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrIcon"> <LocationIcon /> </div>
                    <div className="appBookingServiceAttrContent"> { [ option.venue.name, option.venue.location && option.venue.location.name ].filter(Boolean).join(', ') } </div>
                </div>
                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrContent"> { optionPriceText(option) } </div>
                </div>
            </div>
        );
    }

    function optionItemContent(option) {
        return (
            <div className="appBookingServiceContainer appBookingDeskOption">
                <div className="appBookingServiceHeader">
                    <div className="appBookingServiceLabel"> { option.sku.name } </div>
                </div>
                { option.venue.description && <div className="appBookingTextNotImportant"> { option.venue.description } </div> }
                { optionMeta(option) }
            </div>
        );
    }

    function contentForStep_service() {
        return (<>
                <div className="appBookingStepTitle"> { stepTitle('desk.step.service') } </div>
                { catalog.options.length === 0
                    ? <div className="appBookingWarningText appBookingMessage"> { getRawTextByKey('desk.service.none') } </div>
                    : <CustomList variant="cards" items={catalog.options} onSelectItem={onSelectOption}
                                  selectedId={selections.optionId} itemContent={optionItemContent} /> }
                { catalog.unavailableSkus.length > 0 && (
                    <div className="appBookingDeskUnavailable">
                        { catalog.unavailableSkus.map( sku => (
                            <div key={sku.id} className="appBookingDeskUnavailableItem appBookingTextNotImportant">
                                { sku.name }: { getRawTextByKey('desk.service.unavailable') }
                            </div>
                        )) }
                    </div>
                ) }
            </>);
    }

    function optionCard(option) {
        return (
            <SelectionCard title={getRawTextByKey('desk.step.service.done')}>
                <div className="appBookingSelectionHighlight"> { optionTitle(option) } </div>
                { optionMeta(option) }
            </SelectionCard>
        );
    }

    function contentForStep_days() {
        let option = selectedOption();
        if (!option) {
            return null;
        }
        return (<>
                { optionCard(option) }
                <div className="appBookingStepTitle"> { stepTitle('desk.step.days') } </div>
                <ChooseDeskDays apiBase={apiBase} integrationId={integrationId} option={option}
                                selectedDays={selections.days} selectedTime={selections.time}
                                onChangeDays={onChangeDays} onSelectTime={onSelectTime}
                                refreshKey={desksRefreshKey}
                                ltext={ltext} rawTextByKey={getRawTextByKey}>
                    { reservationCountdown() }
                </ChooseDeskDays>
            </>);
    }

    function contentForStep_seat() {
        let option = selectedOption();
        if (!option || !selections.time) {
            return null;
        }
        return (<>
                <SelectionCard title={getRawTextByKey('desk.step.service.done')}>
                    <div className="appBookingSelectionHighlight"> { optionTitle(option) } </div>
                    <div className="appBookingServiceAttr">
                        <div className="appBookingServiceAttrIcon"> <ClockIcon /> </div>
                        <div className="appBookingServiceAttrContent"> { daysShortText(selections.days) }, { timeRangeText(selections.time) } </div>
                    </div>
                </SelectionCard>
                <div className="appBookingStepTitle"> { stepTitle('desk.step.seat') } </div>
                <ChooseDesk apiBase={apiBase} integrationId={integrationId} option={option}
                            starts={selections.time.starts}
                            heldSeatCode={isReservationValid(reservation) ? reservation.seatCode : null}
                            selectedSeatCode={selections.desk ? selections.desk.seat.code : null}
                            onSelectDesk={onSelectDesk}
                            refreshKey={desksRefreshKey}
                            notice={notice ? getRawTextByKey(notice) : null}
                            ltext={ltext} rawTextByKey={getRawTextByKey}>
                    { reservationCountdown() }
                </ChooseDesk>
            </>);
    }

    function deskPriceText(option, desk) {
        return priceLabel(deskPrice(option, desk.seat.priceCategory || desk.area.priceCategory));
    }

    function totalText() {
        if (booking && booking.total) {
            return `${booking.total} ${booking.currency}`;
        }
        if (reservation && reservation.total) {
            return `${reservation.total} ${reservation.currency}`;
        }
        return null;
    }

    function daysLines(days) {
        return days.map( day => formatLocalizedLongDate(dateOfDayKey(day), ltext.locale) );
    }

    function selectedDeskCard() {
        let option = selectedOption();
        let desk = selections.desk;
        if (!option || !desk || !selections.time) {
            return null;
        }
        return (
            <SelectionCard title={getRawTextByKey('desk.step.seat.done')}>
                <div className="appBookingSelectionHighlight"> { desk.seat.label || desk.seat.code } </div>
                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrIcon"> <LocationIcon /> </div>
                    <div className="appBookingServiceAttrContent"> { [ optionTitle(option), desk.area.name ].filter(Boolean).join(', ') } </div>
                </div>
                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrIcon"> <ClockIcon /> </div>
                    <div className="appBookingServiceAttrContent"> { daysShortText(selections.days) }, { timeRangeText(selections.time) } </div>
                </div>
                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrContent">
                        { text('desk.service.perDay', deskPriceText(option, desk)) }{ totalText() ? ' · ' + getRawTextByKey('desk.summary.total') + ': ' + totalText() : '' }
                    </div>
                </div>
                { reservationCountdown() }
            </SelectionCard>
        );
    }

    function contentForStep_personalData() {
        return (<>
                { selectedDeskCard() }
                <div className="appBookingStepTitle"> { stepTitle('step.personalInfo') } </div>
                <StandardCustomerForm customerData={customerData} onChange={onChangeCustomerData}
                                      onBlur={onBlurCustomerData} ltext={ltext}
                                      rawTextByKey={getRawTextByKey}
                                      configs={props.configs} />
                { bookingStatus.status === 'error' && ( <div className="appBookingErrorText"> { getRawTextByKey('desk.booking.error') } </div>) }
            </>);
    }

    function contentForStep_confirmation() {
        let option = selectedOption();
        let desk = selections.desk;
        let seats = (booking && booking.seats) || [];
        let timeZone = option ? option.venue.timeZone : null;
        let rows = [];
        if (option) {
            rows.push({ id: 'service', label: getRawTextByKey('desk.summary.service'), value: [ option.sku.name, option.venue.name ] });
            if (option.venue.location && option.venue.location.name) {
                rows.push({ id: 'location', label: getRawTextByKey('service.address'), value: option.venue.location.name });
            }
        }
        if (desk) {
            rows.push({ id: 'seat', label: getRawTextByKey('desk.summary.seat'), value: [ desk.seat.label || desk.seat.code, desk.area.name ] });
        }
        if (seats.length > 0) {
            // the booked days, as the booking returned them
            rows.push({ id: 'days', label: getRawTextByKey('desk.summary.days'),
                        value: seats.map( seat => formatLocalizedLongDate(dateOfDayKey(dayKeyIn(timeZone, seat.startDate)), ltext.locale) + ', ' +
                                                  text('desk.times.range', timeIn(seat.startDate, timeZone), timeIn(seat.endDate, timeZone)) ) });
        } else if (selections.time) {
            rows.push({ id: 'days', label: getRawTextByKey('desk.summary.days'), value: daysLines(selections.days) });
            rows.push({ id: 'time', label: getRawTextByKey('desk.summary.time'), value: timeRangeText(selections.time) });
        }
        if (totalText()) {
            rows.push({ id: 'total', label: getRawTextByKey('desk.summary.total'), value: totalText() });
        }
        rows.push({ id: 'personal', label: getRawTextByKey('booking.details.personal'), value: [ customerData.name, customerData.mobile, customerData.email ] });

        return (<>
                <div className="appBookingSuccessCard">
                    <div className="appBookingSuccessIcon"> <CheckCircleIcon /> </div>
                    <div className="appBookingSuccessTitle"> { getRawTextByKey('desk.booking.success') } </div>
                    <div className="appBookingSuccessRefLabel"> { getRawTextByKey('desk.booking.ref') } </div>
                    <div className="appBookingSuccessRef"> { booking && booking.bookingId } </div>
                </div>
                <DetailsTable rows={rows} />
            </>);
    }

    function contentForStep() {
        switch (step) {
            case 'step_desk_service':
                return contentForStep_service();
            case 'step_desk_days':
                return contentForStep_days();
            case 'step_desk_seat':
                return contentForStep_seat();
            case 'step_personal_data':
                return contentForStep_personalData();
            case 'step_confirmation':
                return contentForStep_confirmation();
            default:
                return null;
        }
    }

    function footerForStep() {
        if (step === 'step_confirmation') {
            return ( <FrameNavigation nextLabel={getRawTextByKey('desk.cta.newBooking')} onNext={onNewBooking} /> );
        }
        // the other steps move on as soon as an option is chosen
        let isPersonalData = step === 'step_personal_data';
        if (!isPersonalData && (stepIndexOf(step) <= 0)) {
            return null;
        }
        return ( <FrameNavigation backLabel={ stepIndexOf(step) > 0 ? getRawTextByKey('cta.back') : null }
                                  onBack={onBack} backDisabled={bookingStatus.submit}
                                  nextLabel={isPersonalData ? getRawTextByKey('desk.cta.book') : null}
                                  onNext={createBooking}
                                  nextDisabled={!isCustomerDataComplete(customerData, mandatoryPersonalData) || bookingStatus.submit} /> );
    }

    function frame(content, stepper, footer, summary, stepKey) {
        return (
            <WidgetFrame title={getRawTextByKey('desk.title')} subtitle={getRawTextByKey('desk.subtitle')}
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

    function getMainContent() {
        if (catalog.status === 'no_integrationIdParam') {
            return frame(<div className="appBookingErrorText appBookingMessage"> Invalid config params </div>);
        }
        if (catalog.status === 'error') {
            return frame(messageContent('error.generic', true));
        }
        if ((catalog.status !== 'success') || !steps) {
            return frame(messageContent('loading', false));
        }
        if ((catalog.options.length === 0) && (catalog.unavailableSkus.length === 0)) {
            return frame(messageContent('desk.service.none', false));
        }
        const stepper = ( <Stepper steps={ steps.map( stepName => ({ id: stepName, label: getRawTextByKey('stepper.' + stepName), group: stepGroups[stepName] }) ) }
                                   groupLabels={{ desk: getRawTextByKey('stepper.group.desk'),
                                                  details: getRawTextByKey('stepper.group.details'),
                                                  confirmation: getRawTextByKey('stepper.group.confirmation') }}
                                   currentId={step} /> );
        return frame(contentForStep(), stepper, footerForStep(), choicesSummary(), step);
    }

    return (
        <React.StrictMode>
            <div className="appBookingWidget appBookingDeskWidget">
                <div className="appBookingContainer">
                    { getMainContent() }
                </div>
            </div>
        </React.StrictMode>
    );
}
