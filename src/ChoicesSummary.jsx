/*
One line under the stepper recalling the choices of the previous steps, e.g. "Service · Specialist · Date, time".
items: [ { id, label, value, onSelect } ]; choosing an item goes back to the step it was chosen in.
*/
export function ChoicesSummary(props) {
    if (!props.items || props.items.length === 0) {
        return null;
    }
    return (
        <nav className="appBookingChoicesSummary" aria-label={props.label}>
            <div className="appBookingChoicesSummaryChip">
                { props.items.map( (item, index) => (
                    <span key={item.id} className="appBookingChoicesSummaryEntry">
                        { index > 0 && <span className="appBookingChoicesSummarySeparator" aria-hidden="true">·</span> }
                        <button type="button" className="appBookingChoicesSummaryItem" onClick={item.onSelect}
                                title={item.label + ': ' + item.value} aria-label={props.changeLabel(item.label + ': ' + item.value)}>
                            { item.value }
                        </button>
                    </span>
                )) }
            </div>
        </nav>
    );
}
