/*
The highlighted card that recalls what was chosen in the previous steps.
*/
export function SelectionCard(props) {
    return (
        <div className={"appBookingSelectionCard" + (props.className ? " " + props.className : "")}>
            { props.title && <div className="appBookingSelectionCardTitle">{ props.title }</div> }
            { props.children }
        </div>
    );
}

/*
One "label: value" line of a SelectionCard.
*/
export function SelectionLine(props) {
    return (
        <div className="appBookingSelectionLine">
            <span className="appBookingSelectionLineLabel">{ props.label }:</span>
            <span className="appBookingSelectionLineValue">{ props.value }</span>
        </div>
    );
}
