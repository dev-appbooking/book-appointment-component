/*
A "− n +" picker of a number of places between props.min and props.max.
props: value, min, max, onChange(value), label, decreaseLabel, increaseLabel, disabled.
*/
export function QuantityPicker(props) {
    const min = props.min || 0;
    const max = Math.max(min, props.max || 0);
    const value = Math.min(Math.max(props.value || 0, min), max);

    function change(newValue) {
        if (!props.disabled && (newValue >= min) && (newValue <= max) && (newValue !== value)) {
            props.onChange(newValue);
        }
    }

    return (
        <div className="appBookingQuantity" role="group" aria-label={props.label}>
            <button type="button" className="appBookingQuantityButton" aria-label={props.decreaseLabel}
                    disabled={props.disabled || (value <= min)} onClick={ () => change(value - 1) }> − </button>
            <span className="appBookingQuantityValue" aria-live="polite"> { value } </span>
            <button type="button" className="appBookingQuantityButton" aria-label={props.increaseLabel}
                    disabled={props.disabled || (value >= max)} onClick={ () => change(value + 1) }> + </button>
        </div>
    );
}
