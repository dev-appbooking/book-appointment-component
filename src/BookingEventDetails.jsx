import * as React from 'react';

export function BookingEventDetails({ details, ltext, onReschedule, onCancel }) {
    if (!details) {
        return null;
    }

    const customer = details.customer || {};
    const specialistName = details.specialist
        ? `${details.specialist.title || ''} ${details.specialist.firstName || ''} ${details.specialist.lastName || ''}`.trim()
        : '-';
    const locationName = details.location
        ? `${details.location.name || ''}${details.location.city ? ' (' + details.location.city + ')' : ''}`
        : '-';
    const serviceName = details.service ? details.service.name : '-';

    return (
        <div className="appBookingContainer">
            <div className="appBookingEventHeader">
                <h2 className="appBookingTitle">{ltext.text('booking.title')}</h2>
                <p className="appBookingSubtitle">
                    {ltext.text('booking.details.greeting')}
                </p>
            </div>

            <div className="appBookingEventBody">
                <div className="appBookingEventSection">
                    <div className="appBookingSectionTitle">
                        {ltext.text('booking.details.customer')}
                    </div>
                    <div className="appBookingAttributesLine">
                        {ltext.text('customer.name')}: {customer.name || '-'}
                    </div>
                    <div className="appBookingAttributesLine">
                        {ltext.text('customer.email')}: {customer.email || '-'}
                    </div>
                    <div className="appBookingAttributesLine">
                        {ltext.text('customer.mobile')}: {customer.mobile || '-'}
                    </div>
                </div>

                <div className="appBookingEventSection">
                    <div className="appBookingSectionTitle">
                        {ltext.text('booking.details.appointment')}
                    </div>
                    <div className="appBookingAttributesLine">
                        {ltext.text('service.specialist')}: {specialistName}
                    </div>
                    <div className="appBookingAttributesLine">
                        {ltext.text('service.address')}: {locationName}
                    </div>
                    <div className="appBookingAttributesLine">
                        {ltext.text('service.duration')}: {details.duration} min
                    </div>
                    <div className="appBookingAttributesLine">
                        {ltext.text('service.price')}: {'-'}
                    </div>
                    <div className="appBookingAttributesLine">
                        {ltext.text('booking.details.dateTime')}: {details.prettyDateTime}
                    </div>
                    <div className="appBookingAttributesLine">
                        {ltext.textValue(ltext.text('step.slot.hour'), details.timeStr)}
                    </div>
                </div>
            </div>

            <div className="appBookingEventActions">
                {onReschedule && (
                    <button className="appBookingCtaButton" onClick={onReschedule}>
                        {ltext.text('cta.reschedule')}
                    </button>
                )}
                {onCancel && (
                    <button className="appBookingCtaButton" onClick={onCancel}>
                        {ltext.text('cta.cancel')}
                    </button>
                )}
            </div>
        </div>
    );
}
