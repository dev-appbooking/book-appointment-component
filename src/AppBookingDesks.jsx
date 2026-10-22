import { DeskBookingApp } from "./desks/DeskBookingApp.jsx";

/*
The desk booking widget. initialSelections can preselect the desk service (skuid, the human-readable sku code)
and its floor (venue, the venue id).
*/
export function AppBookingDesks (props) {
    let { integrationId, locale, appBookingApiBaseUrl, initialSelections, utm_params } = props;
    let { skuid, venue } = initialSelections || {};
    let configs = props.configs || {};

    if (!configs.step_personal_data || !configs.step_personal_data.mandatory_data) {
        configs.step_personal_data = { mandatory_data: ['name', 'mobile'] };
    }

    return (
        <DeskBookingApp locale={locale} integrationId={integrationId} appBookingApiBaseUrl={appBookingApiBaseUrl} configs={configs}
                        preselectSkuId={skuid} preselectVenueId={venue} utm_params={utm_params} />
    )
}
