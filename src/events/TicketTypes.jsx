import { priceLabel, typePrice, quotaLeft, isTypeAvailable } from './eventData.js';

/*
The ticket types of an event (ABB-162): name, price, the areas they sell (by the areas' price category and
colour) and whether they can be bought now. Shown above the seats so the customer knows which seats each
type is for.
props: option, liveTypes (seating/availability ticketTypes), areas (the layout's areas, or none),
statusText(type) (why a type can't be bought, or null), rawTextByKey, text(key, ...args).
*/
export function TicketTypesLegend(props) {
    const option = props.option;
    const areas = props.areas || [];
    if (option.ticketTypes.length < 2) {
        return null;
    }

    function areasOf(type) {
        let categories = type.priceCategories || [];
        if (categories.length === 0) {
            return [];
        }
        return areas.filter( area => area.priceCategory && categories.includes(area.priceCategory) );
    }

    return (
        <div className="appBookingTicketTypes">
            <div className="appBookingTicketTypesTitle"> { props.rawTextByKey('events.ticketTypes.title') } </div>
            <ul className="appBookingTicketTypesList">
                { option.ticketTypes.map( type => {
                    let available = isTypeAvailable(type, props.liveTypes);
                    let status = available ? null : props.statusText(type);
                    let left = quotaLeft(type, props.liveTypes);
                    let typeAreas = areasOf(type);
                    return (
                        <li key={type.sku.id} className={"appBookingTicketType" + (available ? "" : " appBookingTicketTypeUnavailable")}
                            data-sku-id={type.sku.id}>
                            <span className="appBookingTicketTypeColors" aria-hidden="true">
                                { typeAreas.filter( area => area.color ).map( area => (
                                    <span key={area.code} className="appBookingDeskAreaColor" style={{ backgroundColor: area.color }}></span>
                                )) }
                            </span>
                            <span className="appBookingTicketTypeName"> { type.sku.name } </span>
                            <span className="appBookingTicketTypePrice"> { priceLabel(typePrice(type)) } </span>
                            <span className="appBookingTicketTypeInfo appBookingTextNotImportant">
                                { [ typeAreas.length > 0 ? typeAreas.map( area => area.name || area.code ).join(', ') : null,
                                    status,
                                    (available && (left !== null)) ? props.text('events.ticketType.left', left) : null,
                                    (available && type.maxPerBooking) ? props.text('events.ticketType.max', type.maxPerBooking) : null
                                  ].filter(Boolean).join(' · ') }
                            </span>
                        </li>
                    );
                }) }
            </ul>
        </div>
    );
}
