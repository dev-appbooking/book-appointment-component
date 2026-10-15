import { useEffect, useRef } from 'react';

/*
Brings the top of the widget back on screen when it was scrolled out of view and moves the focus
to the title of the current step, so screen readers announce the new step.
Host pages with a fixed header set --appBookingScrollOffset (the widget's scroll-margin-top).
*/
export function bringStepIntoView(element) {
    let widget = element && element.closest && element.closest('.appBookingWidget');
    if (!widget) {
        return;
    }
    let offset = parseFloat(window.getComputedStyle(widget).scrollMarginTop) || 0;
    let top = widget.getBoundingClientRect().top;
    if ((top < offset) || (top > window.innerHeight)) {
        let reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        widget.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    let title = widget.querySelector('.appBookingBody .appBookingStepTitle, .appBookingBody .appBookingSuccessTitle') ||
                widget.querySelector('.appBookingTitle');
    if (title) {
        title.setAttribute('tabindex', '-1');
        title.focus({ preventScroll: true });
    }
}

/*
The frame every view of the widget is rendered in: the header, an optional stepper and summary of the
previous choices, the content of the current step and a footer with the navigation buttons.
props.footerClassName adds a class to the footer, e.g. appBookingFooterStacked.
props.stepKey identifies the current step: when it changes, the new step is brought into view.
*/
export function WidgetFrame(props) {
    const frameRef = useRef(null);
    const shownStepRef = useRef(props.stepKey);

    useEffect(() => {
        let previousStep = shownStepRef.current;
        shownStepRef.current = props.stepKey;
        // the first step shown, e.g. once the widget has loaded, leaves the page and the focus alone
        if ((previousStep === props.stepKey) || (previousStep === undefined) || (previousStep === null)) {
            return;
        }
        bringStepIntoView(frameRef.current);
    }, [props.stepKey]);

    return (
        <div className="appBookingFrame" ref={frameRef}>
            <div className="appBookingHeader">
                <div className="appBookingTitle">{ props.title }</div>
                { props.subtitle && <div className="appBookingSubtitle">{ props.subtitle }</div> }
            </div>
            { props.stepper }
            { props.summary }
            <div className="appBookingBody">
                { props.children }
            </div>
            { props.footer && <div className={"appBookingFooter" + (props.footerClassName ? " " + props.footerClassName : "")}>{ props.footer }</div> }
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
