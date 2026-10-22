import { EventBookingApp } from "./events/EventBookingApp.jsx";

/*
The event booking widget: concert tickets (events at a venue) and trainings (events with no venue).
props.eventType ('concert' | 'training') lists only that kind of event; initialSelections can limit it to
one ticket service (skuid, the human-readable sku code) and preselect an event (event, the seat event id).
*/
export function AppBookingEvents (props) {
    let { integrationId, locale, appBookingApiBaseUrl, initialSelections, utm_params, eventType } = props;
    let { skuid, event } = initialSelections || {};
    let configs = props.configs || {};

    if (!configs.step_personal_data || !configs.step_personal_data.mandatory_data) {
        configs.step_personal_data = { mandatory_data: ['name', 'mobile'] };
    }

    return (
        <EventBookingApp locale={locale} integrationId={integrationId} appBookingApiBaseUrl={appBookingApiBaseUrl} configs={configs}
                         eventType={eventType} preselectSkuId={skuid} preselectEventId={event} utm_params={utm_params} />
    )
}
