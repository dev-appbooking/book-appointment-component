import { BookingPageInternalApp } from "./BookingPageInternalApp.jsx";

export function AppBookingPublic (props) {
    let { integrationId, locale, appBookingApiBaseUrl, configs } = props;
    return (      
        <>
            <BookingPageInternalApp locale={locale} integrationId={integrationId} appBookingApiBaseUrl={appBookingApiBaseUrl} configs={configs} />
        </>
    )
}