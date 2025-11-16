import { BookingPageInternalApp } from "./BookingPageInternalApp.jsx";

export function AppBookingPublic (props) {
    let { integrationId, locale, appBookingApiBaseUrl, configs } = props;

    if ((configs && ! configs.step_personal_data) || (configs && configs.step_personal_data && !configs.step_personal_data.mandatory_data))  {
        configs.step_personal_data = { mandatory_data: ['name', 'mobile'] };
    }

    return (      
        <>
            <BookingPageInternalApp locale={locale} integrationId={integrationId} appBookingApiBaseUrl={appBookingApiBaseUrl} configs={configs} />
        </>
    )
}