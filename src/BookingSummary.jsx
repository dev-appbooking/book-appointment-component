import { HorizontalBar } from './HorizontalBar.jsx';

export function BookingSummary(props) {

function getTitleValue() {
    const titleKey = "booking.title";
    if (props.configs && props.configs.text && props.configs.text[props.ltext.locale]) {
        // we have the texts for the current locale, check if we have the mentioned key
        if (titleKey in props.configs.text[props.ltext.locale]) {
            return props.configs.text[props.ltext.locale][titleKey];
        }
    }
    return props.ltext.text('booking.title');
}

return (<>
            <div className="appBookingTitle"> { getTitleValue() } </div>  
            { props.steps.map ( (stepName, stepIndex) => {
                return ( <div key={stepName}>
                            <HorizontalBar />
                            <div className="appBookingStepContainer"> { props.contentForStep(stepName, stepIndex) } </div>
                        </div>)
            }) }
        </>)
}