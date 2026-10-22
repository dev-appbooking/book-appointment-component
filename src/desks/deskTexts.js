import { localizationTexts } from '../texts.js';

/*
The texts of the desk booking widget: the shared texts of the booking widget (form, calendar, buttons,
errors) plus the desk specific ones. Every key can be overridden through configs.text, as in the booking widget.
*/
const deskOnlyTexts = {
    'ro': {
        'desk.title': 'Rezervare birou',
        'desk.subtitle': 'Alege zilele, ora și biroul, apoi completează datele tale',

        'stepper.step_desk_service': 'Spațiu',
        'stepper.step_desk_days': 'Zile & ora',
        'stepper.step_desk_seat': 'Birou',
        'stepper.group.desk': 'Spațiu',

        'desk.step.service': 'Alege spațiul de lucru',
        'desk.step.service.done': 'Spațiul ales',
        'desk.service.unavailable': 'Indisponibil momentan',
        'desk.service.none': 'Nu există birouri disponibile pentru rezervare.',
        'desk.service.perDay': '{0} / zi',
        'desk.service.fromPerDay': 'de la {0} / zi',

        'desk.step.days': 'Alege zilele și ora de început',
        'desk.days.hint': 'Poți alege până la {0} zile. Biroul va fi același în toate zilele, la aceeași oră.',
        'desk.days.selected': 'Zile alese: {0}',
        'desk.days.clear': 'Șterge selecția',
        'desk.days.max': 'Ai ales numărul maxim de zile.',
        'desk.days.none': 'Alege cel puțin o zi din calendar.',
        'desk.days.free': '{0} birouri libere',
        'desk.days.noneFree': 'Niciun birou liber',
        'desk.days.count': '{0} zile',
        'desk.times.title': 'Ora de început',
        'desk.times.free': '{0} libere',
        'desk.times.noneFree': 'ocupat',
        'desk.times.noTimes': 'Nu există ore disponibile pentru toate zilele alese. Încearcă alte zile.',
        'desk.times.range': '{0} – {1}',

        'desk.step.seat': 'Alege biroul',
        'desk.step.seat.done': 'Biroul ales',
        'desk.seat.any': 'Orice birou liber',
        'desk.seat.standing': 'Birou cu înălțime reglabilă',
        'desk.seat.taken': 'Ocupat',
        'desk.seat.closed': 'Indisponibil',
        'desk.seat.noneFree': 'Nu mai este niciun birou liber pentru zilele și ora alese. Alege alte zile sau altă oră.',
        'desk.seat.unavailable': 'Biroul ales nu mai este liber în toate zilele alese, alege alt birou',
        'desk.seat.tooManyRequests': 'Prea multe încercări. Te rugăm să aștepți un minut și să încerci din nou.',
        'desk.reservationHeldFor': 'Biroul este rezervat pentru tine încă {0}. Finalizează rezervarea până atunci.',
        'desk.reservationExpired': 'Rezervarea biroului a expirat, alege din nou biroul',

        'desk.summary.service': 'Spațiu',
        'desk.summary.days': 'Zile',
        'desk.summary.time': 'Ora',
        'desk.summary.seat': 'Birou',
        'desk.summary.total': 'Total',
        'desk.cta.book': 'Rezervă biroul',
        'desk.cta.newBooking': 'Rezervare nouă',
        'desk.booking.error': 'Nu s-a putut crea rezervarea. Te rugăm să încerci din nou.',
        'desk.booking.success': 'Rezervarea biroului a fost creată!',
        'desk.booking.ref': 'Număr rezervare',
    },
    'en': {
        'desk.title': 'Book a desk',
        'desk.subtitle': 'Choose the days, the time and the desk, then fill in your details',

        'stepper.step_desk_service': 'Workspace',
        'stepper.step_desk_days': 'Days & time',
        'stepper.step_desk_seat': 'Desk',
        'stepper.group.desk': 'Workspace',

        'desk.step.service': 'Choose the workspace',
        'desk.step.service.done': 'Selected workspace',
        'desk.service.unavailable': 'Currently unavailable',
        'desk.service.none': 'There are no desks available for booking.',
        'desk.service.perDay': '{0} / day',
        'desk.service.fromPerDay': 'from {0} / day',

        'desk.step.days': 'Choose the days and the start time',
        'desk.days.hint': 'You can choose up to {0} days. You get the same desk on every day, at the same time.',
        'desk.days.selected': 'Selected days: {0}',
        'desk.days.clear': 'Clear selection',
        'desk.days.max': 'You have chosen the maximum number of days.',
        'desk.days.none': 'Choose at least one day in the calendar.',
        'desk.days.free': '{0} free desks',
        'desk.days.noneFree': 'No free desk',
        'desk.days.count': '{0} days',
        'desk.times.title': 'Start time',
        'desk.times.free': '{0} free',
        'desk.times.noneFree': 'full',
        'desk.times.noTimes': 'No start time is available on all the chosen days. Try other days.',
        'desk.times.range': '{0} – {1}',

        'desk.step.seat': 'Choose the desk',
        'desk.step.seat.done': 'Selected desk',
        'desk.seat.any': 'Any free desk',
        'desk.seat.standing': 'Standing desk',
        'desk.seat.taken': 'Taken',
        'desk.seat.closed': 'Unavailable',
        'desk.seat.noneFree': 'No desk is free anymore on the chosen days and time. Choose other days or another time.',
        'desk.seat.unavailable': 'The selected desk is no longer free on all the chosen days, choose another desk',
        'desk.seat.tooManyRequests': 'Too many attempts. Please wait a minute and try again.',
        'desk.reservationHeldFor': 'This desk is reserved for you for {0} more. Complete your booking before then.',
        'desk.reservationExpired': 'Your desk reservation expired, choose the desk again',

        'desk.summary.service': 'Workspace',
        'desk.summary.days': 'Days',
        'desk.summary.time': 'Time',
        'desk.summary.seat': 'Desk',
        'desk.summary.total': 'Total',
        'desk.cta.book': 'Book the desk',
        'desk.cta.newBooking': 'New booking',
        'desk.booking.error': 'Could not create the booking. Please try again.',
        'desk.booking.success': 'Your desk is booked!',
        'desk.booking.ref': 'Booking number',
    }
};

export const deskLocalizationTexts = {
    'ro': { ...localizationTexts.ro, ...deskOnlyTexts.ro },
    'en': { ...localizationTexts.en, ...deskOnlyTexts.en }
};
