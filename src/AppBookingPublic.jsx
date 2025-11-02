import { BookingPageInternalApp } from "./BookingPageInternalApp.jsx";

export function AppBookingPublic (props) {
    let { integrationId, appBookingApiBaseUrl, configs } = props;
    return (      
        <>
            <BookingPageInternalApp integrationId={integrationId} appBookingApiBaseUrl={appBookingApiBaseUrl} configs={configs} />
        </>
    )
}