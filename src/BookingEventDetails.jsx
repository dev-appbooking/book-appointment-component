import { HorizontalBar } from './HorizontalBar.jsx';
import { StepSummary } from './StepSummary.jsx';
import { ClockIcon, LocationIcon, CalendarIcon } from './utils/Utils.js';

export function BookingEventDetails({ details, ltext, onReschedule, onCancel, getRawTextByKey, appBookingConfigs }) {
    if (!details) {
        return null;
    }

    const customer = details.customer || {};
    const specialistName = details.specialist
        ? `${details.specialist.title || ''} ${details.specialist.firstName || ''} ${details.specialist.lastName || ''}`.trim()
        : '-';
    const hideSpecialistName = appBookingConfigs.showSpecialistNameOnServiceItem === false ;

    const locationName = details.location ? `${details.location.name || ''}` : '-';
    
    const serviceName = details.service ? details.service.name : '-';
    const isPastEvent = ((new Date(details.startDate)) < (new Date()));
    return (
        <>
            <div className="appBookingTitle"> { getRawTextByKey('booking.details.title')} </div>
            
            <HorizontalBar />

            <div className="appBookingStepContainer">
                <StepSummary title={ getRawTextByKey('booking.details.dateTime') } showEdit={false} ltext={ltext}>
                    <div className="appBookingServiceContainer">
                        <div className="appBokingServiceLineItem appBookingServiceHeader"> 
                            { serviceName }
                        </div>

                        { (!hideSpecialistName) && ( <div className="appBokingServiceLineItem appBookingServiceSpecialist"> 
                            { specialistName }
                        </div> ) }
                        
                        <div className="appBokingServiceLineItem">
                            <div className="appBookingServiceAttr">
                                <div className="appBookingServiceAttrContent">
                                    { details.duration } minute
                                </div>
                            </div>

                            <div className="appBookingServiceAttr">
                                <div className="appBookingServiceAttrIcon">
                                    <LocationIcon />
                                </div>
                                <div className="appBookingServiceAttrContent">
                                    { locationName }
                                </div>
                            </div>
                        </div>
                    
                        <div className="appBokingServiceLineItem"> 
                            <div className="appBookingServiceAttr">
                                <div className="appBookingServiceAttrIcon">
                                    <CalendarIcon />
                                </div>
                                <div className="appBookingServiceAttrContent">
                                        {details.prettyDateTime}
                                </div>
                            </div>
                        </div>    
                        <div className="appBokingServiceLineItem">
                            <div className="appBookingServiceAttr">
                                <div className="appBookingServiceAttrIcon">
                                    <ClockIcon />
                                </div>
                                <div className="appBookingServiceAttrContent">
                                    { details.timeStr }
                                </div>
                            </div>
                        </div>
                    </div>
                </StepSummary>
            </div>

            <HorizontalBar />

            <div className="appBookingStepContainer">
                <StepSummary title={ getRawTextByKey('booking.details.status') } showEdit={false} ltext={ltext}>
                    <div className="appBokingServiceLineItem"> 
                        { getRawTextByKey(`booking.status.${details.status}`) } 
                    </div>    
                    
                </StepSummary>
            </div>

            <HorizontalBar />

            <div className="appBookingStepContainer">
                <StepSummary title={ getRawTextByKey('booking.details.personal') } showEdit={false} ltext={ltext}>
                    <div className="appBookingAttributesLine">
                        {ltext.text('customer.name')}: {customer.name || '-'}
                    </div>
                    <div className="appBookingAttributesLine">
                        {ltext.text('customer.email')}: {customer.email || '-'}
                    </div>
                    <div className="appBookingAttributesLine">
                        {ltext.text('customer.mobile')}: {customer.mobile || '-'}
                    </div>         
                </StepSummary>
            </div>


            <HorizontalBar />

            <div className="appBookingCtaContainer">
                {(onReschedule && (!isPastEvent)) && (
                    <button className="appBookingCtaButton" onClick={onReschedule}>
                        {ltext.text('cta.reschedule')}
                    </button>
                )}
                {(onCancel && (details.status !== 'canceled') && (!isPastEvent)) && (
                    <button className="appBookingCtaButton appBookingCtaButtonDanger" onClick={onCancel}>
                        {ltext.text('cta.cancel')}
                    </button>
                )}
            </div>
        </>
    );
}
