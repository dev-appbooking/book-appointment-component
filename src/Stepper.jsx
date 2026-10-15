import { CheckIcon } from './utils/Utils.js';

/*
The progress of the flow. steps: [ { id, label, group } ], currentId: the id of the active step.
Wide layouts show every step; narrow layouts show the steps merged by group (groupLabels: { group: label }).
*/
export function Stepper(props) {
    const currentIndex = props.steps.findIndex( step => step.id === props.currentId );

    let groups = [];
    props.steps.forEach( (step, index) => {
        let last = groups[groups.length - 1];
        if (last && last.id === step.group) {
            last.lastIndex = index;
        } else {
            groups.push({ id: step.group, label: (props.groupLabels || {})[step.group] || step.label, firstIndex: index, lastIndex: index });
        }
    });

    function stateFor(firstIndex, lastIndex) {
        if (currentIndex > lastIndex) {
            return 'done';
        }
        return (currentIndex >= firstIndex) ? 'active' : 'todo';
    }

    function item(key, label, number, state, isLast) {
        return (
            <li key={key} className={`appBookingStepperItem appBookingStepper_${state}`} aria-current={state === 'active' ? 'step' : undefined}>
                <span className="appBookingStepperBullet">{ state === 'done' ? <CheckIcon /> : number }</span>
                <span className="appBookingStepperLabel">{ label }</span>
                { !isLast && <span className="appBookingStepperLine"></span> }
            </li>
        );
    }

    return (
        <div className="appBookingStepper">
            <ol className="appBookingStepperFull">
                { props.steps.map( (step, index) => item(step.id, step.label, index + 1, stateFor(index, index), index === props.steps.length - 1) ) }
            </ol>
            <ol className="appBookingStepperCompact">
                { groups.map( (group, index) => item(group.id, group.label, index + 1, stateFor(group.firstIndex, group.lastIndex), index === groups.length - 1) ) }
            </ol>
        </div>
    );
}
