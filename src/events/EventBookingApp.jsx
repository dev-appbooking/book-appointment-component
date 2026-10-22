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
import { formatLocalizedLongDate } from '../utils/formatters';
import { emptyCustomerData, customerDataAfterChange, customerDataAfterBlur, isCustomerDataComplete } from '../utils/customerData.js';
import { eventLocalizationTexts } from './eventTexts.js';
import { eventOptionsFromCatalog, preselectEventOption, hasNoVenue, unitPrice, priceLabel, sessionsOf, eventDayKeys,
         localDateOf, localTimeOf, selectedUnits, reservationItems, selectionWithoutConflicts, groupSeatItems } from './eventData.js';
import { ChooseSeats } from './ChooseSeats.jsx';
import { ChoosePlaces } from './ChoosePlaces.jsx';

// the steps grouped together by the compact stepper of narrow layouts
const stepGroups = {
    step_event: 'event',
    step_tickets: 'details',
    step_personal_data: 'details',
    step_confirmation: 'confirmation'
};

// what is chosen on the tickets step; see ChooseSeats and ChoosePlaces
function emptySelection(option) {
    return { seats: {}, standing: {}, quantity: (option && hasNoVenue(option.event)) ? 1 : 0 };
}

function itemsKey(items) {
    return JSON.stringify(items);
}

/*
Books tickets or places at a seat event through the seating API (ABB-150): choose the event, then the
seats and standing places (an event at a venue, e.g. a concert) or the number of places (an event with
no venue, e.g. a multi-day training), then fill in the personal data. The units are held for 10 minutes
from the moment the tickets step is confirmed until the booking is made or the hold expires.
*/
export function EventBookingApp(props) {

    const [ catalog, setCatalog ] = useState({ status: 'not_fetched', options: [] });
    const [ steps, setSteps ] = useState(null);
    const [ step, setStep ] = useState(null);
    const [ optionId, setOptionId ] = useState(null);
    const [ selection, setSelection ] = useState(emptySelection(null));
    const [ customerData, setCustomerData ] = useState(emptyCustomerData());
    const [ bookingStatus, setBookingStatus ] = useState({ submit: false, status: 'initial' });
    const [ booking, setBooking ] = useState(null);

    // the hold: { id, expiresAt (ms), itemsKey, items (SeatItem list), total, currency }
    const [ reservation, setReservation ] = useState(null);
    const [ reserving, setReserving ] = useState(false);
    // the warning shown on the tickets step: { key, args }
    const [ notice, setNotice ] = useState(null);
    // changing it reloads what is taken
    const [ refreshKey, setRefreshKey ] = useState(0);
    const reservingRef = useRef(false);
    const submittingRef = useRef(false);
    const reservationRef = useRef(null);

    const apiBase = props.appBookingApiBaseUrl || 'https://www.appbooking.ro';
    const ltext = new LocalizationText(eventLocalizationTexts, props.locale || 'ro');
    const mandatoryPersonalData = props.configs.step_personal_data.mandatory_data;
    const integrationId = props.integrationId;
    const integrationUrl = apiBase + '/api/integration/' + integrationId + '/';
    const seatingUrl = integrationUrl + 'seating/';

    function stepsFor(withEventStep) {
        let result = ['step_tickets', 'step_personal_data', 'step_confirmation'];
        if (withEventStep) {
            result.unshift('step_event');
        }
        return result;
    }

    // the steps and the selections of a new booking; withPreselection applies the deep-link params
    function startBooking(options, withPreselection) {
        let preselection = preselectEventOption(options, withPreselection ? props.preselectSkuId : null, withPreselection ? props.preselectEventId : null);
        let newSteps = stepsFor(!preselection.option || (preselection.options.length > 1));
        setSteps(newSteps);
        setOptionId(preselection.option ? preselection.option.id : null);
        setSelection(emptySelection(preselection.option));
        setNotice(null);
        setStep(preselection.option ? 'step_tickets' : newSteps[0]);
        return preselection.options;
    }

    useEffect(() => {
        (async function() {
            if (!integrationId) {
                setCatalog({ status: 'no_integrationIdParam', options: [] });
                return;
            }
            try {
                setCatalog(prev => ({ ...prev, status: 'fetching' }));
                let response = await httpRequest('GET', seatingUrl + 'catalog');
                let options = eventOptionsFromCatalog(response.skus, props.eventType);
                let inScope = startBooking(options, true);
                setCatalog({ status: 'success', options: inScope });
            } catch (e) {
                setCatalog({ status: 'error', options: [] });
            }
        })();
    }, []);

    useEffect(() => {
        reservationRef.current = reservation;
        if (!reservation) {
            return;
        }
        let timer = setTimeout(() => {
            // a booking in flight settles it: success books the units, a 409 sends the customer back
            if (submittingRef.current) {
                return;
            }
            returnToTicketsStep({ key: 'events.reservationExpired' });
        }, Math.max(0, reservation.expiresAt - Date.now()));
        return () => clearTimeout(timer);
    }, [reservation]);

    useEffect(() => {
        // a customer leaving the page lets the held units go at once instead of after 10 minutes
        function onPageHide() {
            let res = reservationRef.current;
            if (isReservationValid(res) && window.fetch) {
                window.fetch(cancelReservationUrl(res), { method: 'POST', keepalive: true, body: '{}' }).catch(() => {});
            }
        }
        window.addEventListener('pagehide', onPageHide);
        return () => window.removeEventListener('pagehide', onPageHide);
    }, []);

    function getRawTextByKey(key) {
        return configurableText(key, props.configs, ltext);
    }

    function text(key, ...args) {
        return ltext.textValue(getRawTextByKey(key), ...args);
    }

    function selectedOption() {
        return catalog.options.find( option => option.id === optionId ) || null;
    }

    // trainings (events with no venue) have their own wording
    function isTrainingMode() {
        let option = selectedOption();
        return option ? hasNoVenue(option.event) : (props.eventType === 'training');
    }

    function hasText(key) {
        let configTexts = props.configs.text && props.configs.text[ltext.locale];
        return !!(configTexts && (key in configTexts)) || (key in eventLocalizationTexts[ltext.locale]);
    }

    // the key, or its .training variant for a training
    function kindKey(key) {
        return (isTrainingMode() && hasText(key + '.training')) ? key + '.training' : key;
    }

    function kindRaw(key) {
        return getRawTextByKey(kindKey(key));
    }

    function isReservationValid(res) {
        return !!res && (res.expiresAt > Date.now());
    }

    function cancelReservationUrl(res) {
        return integrationUrl + 'event/reservation/' + encodeURIComponent(res.id) + '/cancel';
    }

    // lets the held units go; resolves once they are free again (or failed to be released: they expire on their own)
    function releaseReservation(res) {
        if (!isReservationValid(res)) {
            return Promise.resolve();
        }
        return httpRequest('POST', cancelReservationUrl(res), {}, { 'content-type': 'application/json' })
            .catch(() => { /* the hold expires on its own */ });
    }

    function stepIndexOf(stepName) {
        return (steps || []).indexOf(stepName);
    }

    // the hold is gone (expired, released or already booked): the customer chooses again from scratch,
    // since the seats chosen before may have been taken by someone else meanwhile
    function returnToTicketsStep(newNotice) {
        setReservation(null);
        setSelection(emptySelection(selectedOption()));
        setNotice(newNotice);
        setRefreshKey(k => k + 1);
        setStep('step_tickets');
    }

    function goBackToStep(stepName) {
        if (stepIndexOf(stepName) <= stepIndexOf('step_tickets')) {
            // back to the choice of the event or the tickets: the hold is let go, and what is taken is
            // reloaded once the held units are free again
            let res = reservation;
            setReservation(null);
            setNotice(null);
            releaseReservation(res).then(() => setRefreshKey(k => k + 1));
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
        if (!option.event.onSale) {
            return;
        }
        if (option.id !== optionId) {
            setOptionId(option.id);
            setSelection(emptySelection(option));
            setNotice(null);
        }
        setStep('step_tickets');
    }

    // keepNotice: an adjustment made by the step itself, e.g. fewer places left, keeps the warning shown
    function onChangeSelection(newSelection, keepNotice) {
        setSelection(newSelection);
        if (!keepNotice) {
            setNotice(null);
        }
    }

    function noticeFor409(newSelection, conflicts) {
        if ((conflicts || []).some( conflict => conflict.seatCode )) {
            return { key: 'events.conflict.seats' };
        }
        let available = (conflicts || []).map( conflict => conflict.available ).find( value => (value !== undefined) && (value !== null) );
        if ((available === undefined) || (selectedUnits(newSelection) === 0)) {
            return { key: 'events.conflict.full' };
        }
        return { key: 'events.conflict.places', args: [ available ] };
    }

    /*
    Holds the chosen units for 10 minutes and moves to the personal data step. Any previous hold is
    released first: a hold can't be edited.
    */
    async function onReserve() {
        let option = selectedOption();
        let items = reservationItems(selection);
        if (reservingRef.current || !option || (items.length === 0)) {
            return;
        }
        let key = itemsKey(items);
        if (isReservationValid(reservation) && (reservation.itemsKey === key)) {
            // the customer came back without changing anything
            setStep('step_personal_data');
            return;
        }

        reservingRef.current = true;
        setReserving(true);
        let previous = reservation;
        setReservation(null);
        try {
            await releaseReservation(previous);
            let res = await httpRequest('POST', seatingUrl + 'reservation', { seatEventId: option.event.id, items: items }, { 'content-type': 'application/json' });
            setReservation({ id: res.id, expiresAt: new Date(res.expires_at).getTime(), itemsKey: key,
                             items: res.items || [], total: res.total, currency: res.currency });
            setNotice(null);
            setStep('step_personal_data');
        } catch (e) {
            let status = e && e.status;
            if (status === 409) {
                // nothing was held: drop what is taken and let the customer choose again
                let newSelection = selectionWithoutConflicts(selection, e.body && e.body.conflicts);
                setSelection(newSelection);
                setNotice(noticeFor409(newSelection, e.body && e.body.conflicts));
            } else if (status === 429) {
                setNotice({ key: 'events.error.tooManyRequests' });
            } else if (status === 400) {
                // not on sale anymore, sales closed or already started, or a code the layout no longer has
                setNotice({ key: 'events.error.notBookable' });
            } else {
                setNotice({ key: 'error.generic' });
            }
            setRefreshKey(k => k + 1);
        } finally {
            reservingRef.current = false;
            setReserving(false);
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
            returnToTicketsStep({ key: 'events.reservationExpired' });
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
                // the hold expired, was released or already booked
                setBookingStatus({ submit: false, status: 'initial' });
                returnToTicketsStep({ key: 'events.reservationExpired' });
            } else {
                setBookingStatus({ submit: false, status: 'error' });
            }
        } finally {
            submittingRef.current = false;
        }
    }

    function onNewBooking() {
        releaseReservation(reservation);
        setReservation(null);
        setBooking(null);
        setCustomerData(emptyCustomerData());
        setBookingStatus({ submit: false, status: 'initial' });
        setRefreshKey(k => k + 1);
        startBooking(catalog.options, false);
    }

    function stepTitle(key) {
        return ltext.textValue(kindRaw(key), stepIndexOf(step) + 1);
    }

    function longDate(event, dateTime) {
        return formatLocalizedLongDate(localDateOf(event, dateTime), ltext.locale);
    }

    // "Tuesday, 10 November 2026, 09:00 – 17:00", or both ends in full when the session runs over several days
    function sessionText(event, session) {
        let start = localTimeOf(event, session.startDate);
        let end = localTimeOf(event, session.endDate);
        if (eventDayKeys({ ...event, sessions: [ session ] }).length > 1) {
            return text('events.time.range', longDate(event, session.startDate) + ', ' + start, longDate(event, session.endDate) + ', ' + end);
        }
        return longDate(event, session.startDate) + ', ' + text('events.time.range', start, end);
    }

    // when the event takes place: one line for a single session, the first and last day for several
    function eventWhenText(event) {
        let sessions = sessionsOf(event);
        if (sessions.length === 1) {
            return sessionText(event, sessions[0]);
        }
        let days = eventDayKeys(event).length;
        return text('events.time.range', longDate(event, event.startDate), longDate(event, event.endDate)) + ' · ' + text('events.event.days', days);
    }

    function eventWhereText(event) {
        let location = event.location || {};
        return [ event.venueName, location.name, location.city ].filter(Boolean).join(', ');
    }

    function eventPriceText(option) {
        let event = option.event;
        if (hasNoVenue(event)) {
            return text('events.event.perPlace', priceLabel(event.fromPrice || unitPrice(option, null)));
        }
        let prices = Object.values(event.pricing || {}).map( p => parseFloat(p.price) );
        let several = new Set(prices.concat([ parseFloat((event.fromPrice || {}).price) ]).filter( p => !isNaN(p) )).size > 1;
        let price = priceLabel(event.fromPrice || unitPrice(option, null));
        return several ? text('events.event.from', price) : price;
    }

    // why an event can't be booked, or null when it is on sale
    function notOnSaleText(event) {
        if (event.onSale) {
            return null;
        }
        if (event.status === 'sold_out') {
            return kindRaw('events.event.soldOut');
        }
        let now = Date.now();
        if (event.salesStart && (new Date(event.salesStart).getTime() > now)) {
            return text('events.event.salesStart', longDate(event, event.salesStart) + ', ' + localTimeOf(event, event.salesStart));
        }
        if (event.salesEnd && (new Date(event.salesEnd).getTime() <= now)) {
            return getRawTextByKey('events.event.salesEnded');
        }
        // on sale but every place is taken
        return kindRaw('events.event.soldOut');
    }

    function unitsText(units) {
        return units > 0 ? String(units) : null;
    }

    function reservationCountdown() {
        if (!reservation || (step === 'step_confirmation')) {
            return null;
        }
        return ( <ReservationCountdown expiresAt={reservation.expiresAt} text={getRawTextByKey('events.reservationHeldFor')} /> );
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
                items.push({ id: id, label: label, value: value, onSelect: () => { if (!bookingStatus.submit && !reserving) { goBackToStep(stepName); } } });
            }
        }
        let option = selectedOption();
        addItem('step_event', 'event', kindRaw('events.summary.event'), option && option.event.name);
        addItem('step_tickets', 'tickets', kindRaw('events.summary.tickets'), unitsText(reservation ? reservation.items.length : selectedUnits(selection)));
        return ( <ChoicesSummary items={items} label={getRawTextByKey('summary.label')}
                                 changeLabel={ (choice) => text('summary.change', choice) } /> );
    }

    function eventSchedule(event) {
        let sessions = sessionsOf(event);
        if (sessions.length < 2) {
            return null;
        }
        return (
            <div className="appBookingEventSchedule">
                <div className="appBookingEventScheduleTitle"> { getRawTextByKey('events.event.schedule') } </div>
                <ol className="appBookingEventSessions">
                    { sessions.map( (session, index) => (
                        <li key={session.id || index} className="appBookingEventSession">
                            <span className="appBookingEventSessionLabel"> { text('events.event.session', index + 1) } </span>
                            <span className="appBookingEventSessionWhen"> { sessionText(event, session) } </span>
                        </li>
                    )) }
                </ol>
            </div>
        );
    }

    // the date, place and price of an event
    function eventMeta(option, withPrice) {
        let event = option.event;
        let where = eventWhereText(event);
        return (
            <div className="appBookingServiceMeta">
                <div className="appBookingServiceAttr">
                    <div className="appBookingServiceAttrIcon"> <ClockIcon /> </div>
                    <div className="appBookingServiceAttrContent"> { eventWhenText(event) } </div>
                </div>
                { where && (
                    <div className="appBookingServiceAttr">
                        <div className="appBookingServiceAttrIcon"> <LocationIcon /> </div>
                        <div className="appBookingServiceAttrContent"> { where } </div>
                    </div>
                ) }
                { withPrice && (
                    <div className="appBookingServiceAttr">
                        <div className="appBookingServiceAttrContent"> { eventPriceText(option) } </div>
                    </div>
                ) }
            </div>
        );
    }

    function optionItemContent(option) {
        let event = option.event;
        let unavailable = notOnSaleText(event);
        return (
            <div className="appBookingServiceContainer appBookingEventOption">
                <div className="appBookingServiceHeader">
                    <span className="appBookingEventName"> { event.name } </span>
                    { unavailable && <span className="appBookingEventBadge"> { unavailable } </span> }
                </div>
                { (option.sku.name && (option.sku.name !== event.name)) && <div className="appBookingTextNotImportant"> { option.sku.name } </div> }
                { eventMeta(option, true) }
            </div>
        );
    }

    function contentForStep_event() {
        return (<>
                <div className="appBookingStepTitle"> { stepTitle('events.step.event') } </div>
                <CustomList variant="cards" items={catalog.options} onSelectItem={onSelectOption}
                            isItemDisabled={ (option) => !option.event.onSale }
                            selectedId={optionId} itemContent={optionItemContent} />
            </>);
    }

    function eventCard(option, children) {
        return (
            <SelectionCard title={kindRaw('events.step.event.done')}>
                <div className="appBookingSelectionHighlight"> { option.event.name } </div>
                { eventMeta(option, !hasNoVenue(option.event)) }
                { children }
            </SelectionCard>
        );
    }

    function noticeText() {
        if (!notice) {
            return null;
        }
        return text(notice.key, ...(notice.args || []));
    }

    function contentForStep_tickets() {
        let option = selectedOption();
        if (!option) {
            return null;
        }
        let common = { apiBase: apiBase, integrationId: integrationId, option: option, selection: selection,
                       onChangeSelection: onChangeSelection, refreshKey: refreshKey, notice: noticeText(),
                       ltext: ltext, rawTextByKey: getRawTextByKey };
        return (<>
                { eventCard(option, hasNoVenue(option.event) ? eventSchedule(option.event) : null) }
                <div className="appBookingStepTitle"> { stepTitle('events.step.tickets') } </div>
                { hasNoVenue(option.event)
                    ? <ChoosePlaces {...common} />
                    : <ChooseSeats {...common} /> }
            </>);
    }

    // the held or booked units, one line per seat and one per standing area / event with no venue
    function unitLines(items) {
        return groupSeatItems(items).map( line => {
            let price = line.price ? priceLabel({ price: line.price, currency: line.currency }) : '';
            if (line.isPlaces) {
                return `${line.label} × ${line.count}` + (price ? ` (${price})` : '');
            }
            return line.label + (price ? ` · ${price}` : '');
        });
    }

    function totalText() {
        let source = booking || reservation;
        return (source && source.total) ? priceLabel({ price: source.total, currency: source.currency }) : null;
    }

    function heldCard() {
        let option = selectedOption();
        if (!option || !reservation) {
            return null;
        }
        return (
            <SelectionCard title={kindRaw('events.summary.tickets')}>
                <div className="appBookingSelectionHighlight"> { option.event.name } </div>
                { eventMeta(option, false) }
                <ul className="appBookingEventUnits">
                    { unitLines(reservation.items).map( (line, index) => ( <li key={index}> { line } </li> )) }
                </ul>
                { totalText() && <div className="appBookingEventTotal"> { getRawTextByKey('events.summary.total') }: { totalText() } </div> }
                { reservationCountdown() }
            </SelectionCard>
        );
    }

    function contentForStep_personalData() {
        return (<>
                { heldCard() }
                <div className="appBookingStepTitle"> { stepTitle('step.personalInfo') } </div>
                <StandardCustomerForm customerData={customerData} onChange={onChangeCustomerData}
                                      onBlur={onBlurCustomerData} ltext={ltext}
                                      rawTextByKey={getRawTextByKey}
                                      configs={props.configs} />
                { bookingStatus.status === 'error' && ( <div className="appBookingErrorText"> { getRawTextByKey('events.booking.error') } </div>) }
            </>);
    }

    function contentForStep_confirmation() {
        let option = selectedOption();
        let rows = [];
        if (option) {
            let event = option.event;
            rows.push({ id: 'event', label: kindRaw('events.summary.event'), value: [ event.name, option.sku.name !== event.name ? option.sku.name : null ] });
            rows.push({ id: 'date', label: getRawTextByKey('events.summary.date'), value: sessionsOf(event).map( session => sessionText(event, session) ) });
            if (eventWhereText(event)) {
                rows.push({ id: 'venue', label: getRawTextByKey('service.address'), value: eventWhereText(event) });
            }
        }
        rows.push({ id: 'tickets', label: kindRaw('events.summary.tickets'), value: unitLines(booking && booking.seats) });
        if (totalText()) {
            rows.push({ id: 'total', label: getRawTextByKey('events.summary.total'), value: totalText() });
        }
        rows.push({ id: 'personal', label: getRawTextByKey('booking.details.personal'), value: [ customerData.name, customerData.mobile, customerData.email ] });

        return (<>
                <div className="appBookingSuccessCard">
                    <div className="appBookingSuccessIcon"> <CheckCircleIcon /> </div>
                    <div className="appBookingSuccessTitle"> { getRawTextByKey('events.booking.success') } </div>
                    <div className="appBookingSuccessRefLabel"> { getRawTextByKey('events.booking.ref') } </div>
                    <div className="appBookingSuccessRef"> { booking && booking.bookingId } </div>
                    <div className="appBookingTextNotImportant appBookingEventKeepRef"> { getRawTextByKey('events.booking.keepRef') } </div>
                </div>
                <DetailsTable rows={rows} />
            </>);
    }

    function contentForStep() {
        switch (step) {
            case 'step_event':
                return contentForStep_event();
            case 'step_tickets':
                return contentForStep_tickets();
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
            return ( <FrameNavigation nextLabel={getRawTextByKey('events.cta.newBooking')} onNext={onNewBooking} /> );
        }
        if (step === 'step_event') {
            // the event step moves on as soon as an event is chosen
            return null;
        }
        let backLabel = stepIndexOf(step) > 0 ? getRawTextByKey('cta.back') : null;
        if (step === 'step_tickets') {
            return ( <FrameNavigation backLabel={backLabel} onBack={onBack} backDisabled={reserving}
                                      nextLabel={getRawTextByKey('events.cta.continue')} onNext={onReserve}
                                      nextDisabled={(selectedUnits(selection) === 0) || reserving} /> );
        }
        return ( <FrameNavigation backLabel={backLabel} onBack={onBack} backDisabled={bookingStatus.submit}
                                  nextLabel={getRawTextByKey('events.cta.book')} onNext={createBooking}
                                  nextDisabled={!isCustomerDataComplete(customerData, mandatoryPersonalData) || bookingStatus.submit} /> );
    }

    function frame(content, stepper, footer, summary, stepKey) {
        return (
            <WidgetFrame title={kindRaw('events.title')} subtitle={kindRaw('events.subtitle')}
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
        if (catalog.options.length === 0) {
            return frame(messageContent(kindKey('events.event.none'), false));
        }
        const stepLabel = (stepName) => kindRaw('stepper.' + stepName);
        const stepper = ( <Stepper steps={ steps.map( stepName => ({ id: stepName, label: stepLabel(stepName), group: stepGroups[stepName] }) ) }
                                   groupLabels={{ event: kindRaw('stepper.group.event'),
                                                  details: getRawTextByKey('stepper.group.details'),
                                                  confirmation: getRawTextByKey('stepper.group.confirmation') }}
                                   currentId={step} /> );
        return frame(contentForStep(), stepper, footerForStep(), choicesSummary(), step);
    }

    return (
        <React.StrictMode>
            <div className="appBookingWidget appBookingEventWidget">
                <div className="appBookingContainer">
                    { getMainContent() }
                </div>
            </div>
        </React.StrictMode>
    );
}
