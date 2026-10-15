import { WidgetFrame, FrameNavigation } from './WidgetFrame.jsx';
import { DetailsTable } from './DetailsTable.jsx';
import { hasPrice, CheckCircleIcon, XCircle, XCircleSolidIcon } from './utils/Utils.js';

/*
The rows describing a booking, shared by the booking details and the reschedule views.
*/
export function eventDetailsRows(details, ltext, getRawTextByKey, appBookingConfigs) {
    const customer = details.customer || {};
    const hideSpecialistName = appBookingConfigs && appBookingConfigs.showSpecialistNameOnServiceItem === false;
    const specialistName = details.specialist
        ? `${details.specialist.title || ''} ${details.specialist.firstName || ''} ${details.specialist.lastName || ''}`.trim()
        : null;
    const assigned = (details.assignedNames || []).length > 0
        ? `${getRawTextByKey('service.assigned')}: ${details.assignedNames.join(', ')}`
        : null;
    const minutes = ltext.textValue(getRawTextByKey('service.minutes'), details.duration);

    return [
        { id: 'service', label: getRawTextByKey('summary.service'),
          value: [ details.service ? details.service.name : '-', hideSpecialistName ? null : specialistName, assigned ] },
        { id: 'location', label: getRawTextByKey('service.address'), value: details.location ? details.location.name : '-' },
        { id: 'dateTime', label: getRawTextByKey('summary.dateTime'), value: [ details.longDate, `${details.timeStr} (${minutes})` ] },
        details.service && hasPrice(details.service)
            ? { id: 'price', label: getRawTextByKey('service.price'), value: `${details.service.price} ${details.service.currency}` }
            : null,
        { id: 'personal', label: getRawTextByKey('booking.details.personal'), value: [ customer.name, customer.mobile, customer.email ] }
    ];
}

/*
The details of an existing booking with the reschedule and cancel actions.
Cancelling asks for a confirmation inside the widget (props.cancelState drives it).
*/
export function BookingEventDetails({ details, ltext, title, subtitle, cancelState, onReschedule, onCancel, onConfirmCancel, onDismissCancel, getRawTextByKey, appBookingConfigs }) {
    if (!details) {
        return null;
    }

    const isPastEvent = ((new Date(details.startDate)) < (new Date()));
    const isCanceled = details.status === 'canceled';
    const isConfirmingCancel = (cancelState === 'confirm') || (cancelState === 'submitting');

    // the status with its icon: green when the booking is valid, orange when it was canceled
    const statusValue = (
        <span className={"appBookingStatus " + (isCanceled ? "appBookingStatus_canceled" : "appBookingStatus_valid")}>
            <span className="appBookingStatusIcon"> { isCanceled ? <XCircleSolidIcon /> : <CheckCircleIcon /> } </span>
            { getRawTextByKey(`booking.status.${details.status}`) }
        </span>
    );

    const rows = [
        details.id ? { id: 'confirmationId', label: getRawTextByKey('booking.ref'), value: details.id } : null,
        { id: 'status', label: getRawTextByKey('summary.status'), value: statusValue },
        ...eventDetailsRows(details, ltext, getRawTextByKey, appBookingConfigs)
    ];

    function statusCard() {
        if (cancelState === 'success') {
            return (
                <div className="appBookingSuccessCard appBookingStatusCanceled">
                    <div className="appBookingSuccessIcon"> <CheckCircleIcon /> </div>
                    <div className="appBookingSuccessTitle"> { getRawTextByKey('cancel.success') } </div>
                </div>
            );
        }
        if (isConfirmingCancel) {
            return (
                <div className="appBookingConfirmPanel" role="alertdialog" aria-live="polite">
                    <div className="appBookingConfirmPanelIcon"> <XCircle /> </div>
                    <div className="appBookingConfirmPanelText"> { getRawTextByKey('cancel.confirm') } </div>
                </div>
            );
        }
        return null;
    }

    function footer() {
        if (isConfirmingCancel) {
            return ( <FrameNavigation backLabel={getRawTextByKey('cta.cancel.dismiss')} onBack={onDismissCancel} backDisabled={cancelState === 'submitting'}
                                      nextLabel={getRawTextByKey('cta.cancel.confirm')} onNext={onConfirmCancel} nextDisabled={cancelState === 'submitting'}
                                      nextDanger={true} /> );
        }
        const canCancel = onCancel && !isCanceled && !isPastEvent;
        const canReschedule = onReschedule && !isPastEvent;
        if (!canCancel && !canReschedule) {
            return null;
        }
        return ( <FrameNavigation backLabel={canCancel ? getRawTextByKey('cta.cancel') : null} onBack={onCancel} backDanger={true}
                                  nextLabel={canReschedule ? getRawTextByKey('cta.reschedule') : null} onNext={onReschedule} /> );
    }

    return (
        <WidgetFrame title={title} subtitle={subtitle} footer={footer()}
                     footerClassName={isConfirmingCancel ? "appBookingFooterStart" : "appBookingFooterStacked"}>
            { statusCard() }
            { (cancelState === 'error') && <div className="appBookingErrorText appBookingMessage"> { getRawTextByKey('cancel.error') } </div> }
            <DetailsTable rows={rows} />
        </WidgetFrame>
    );
}
