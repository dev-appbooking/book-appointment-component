/*
The frame every view of the widget is rendered in: the header, an optional stepper,
the content of the current step and a footer with the navigation buttons.
*/
export function WidgetFrame(props) {
    return (
        <div className="appBookingFrame">
            <div className="appBookingHeader">
                <div className="appBookingTitle">{ props.title }</div>
                { props.subtitle && <div className="appBookingSubtitle">{ props.subtitle }</div> }
            </div>
            { props.stepper }
            <div className="appBookingBody">
                { props.children }
            </div>
            { props.footer && <div className="appBookingFooter">{ props.footer }</div> }
        </div>
    );
}

/*
The navigation buttons of the footer. A button is left out when its label is not given.
*/
export function FrameNavigation(props) {
    return (
        <>
            { props.backLabel
                ? <button type="button" className={"appBookingSecondaryButton" + (props.backDanger ? " appBookingSecondaryButtonDanger" : "")} onClick={props.onBack} disabled={props.backDisabled}>{ props.backLabel }</button>
                : <span></span> }
            { props.nextLabel &&
                <button type="button" className={"appBookingCtaButton" + (props.nextDanger ? " appBookingCtaButtonDanger" : "")}
                        onClick={props.onNext} disabled={props.nextDisabled}>{ props.nextLabel }</button> }
        </>
    );
}
