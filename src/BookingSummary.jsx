import { HorizontalBar } from './HorizontalBar.jsx';
import { configurableText } from './utils/Utils.js';

export function BookingSummary(props) {

return (<>
            <div className="appBookingTitle"> { configurableText('booking.title', props.appBookingConfigs, props.ltext) } </div>  
            { props.steps.map ( (stepName, stepIndex) => {
                return ( <div key={stepName}>
                            <HorizontalBar />
                            <div className="appBookingStepContainer"> { props.contentForStep(stepName, stepIndex) } </div>
                        </div>)
            }) }
        </>)
}