/*
The terms checkbox label: the customer.acceptTerms text with its {0}, {1}... placeholders replaced
by the links of configs.termsAndConditions.links.
*/
export function TermsLabel(props) {
    let rawTermsText = props.rawTextByKey('customer.acceptTerms');
    let linksArray = props.configs && props.configs.termsAndConditions && props.configs.termsAndConditions.links;
    if (!linksArray || !Array.isArray(linksArray)) {
        return (<span> { rawTermsText } </span>);
    }
    let strTokens = rawTermsText.split(/\{[0-9]*\}/);
    return ( strTokens.map( (token, index) => {
        return ( <span key={index}>{token}{ (index < linksArray.length ) && (index < strTokens.length - 1) && (<a href={linksArray[index].link} target="_blank" rel="noopener noreferrer">{ props.rawTextByKey(linksArray[index].label_key) }</a>)}</span> )
    } ) );
}

export function StandardCustomerForm(props) { 
let mandatoryProperties = props.configs.step_personal_data.mandatory_data;

function onChange(property, e) {
    if (props.onChange) {
        props.onChange(property, e);
    }
}

function onBlur(property, e) {
    if (props.onBlur) {
        props.onBlur(property, e);
    }
}

function getFieldErrorContent(property) {
    if (property in props.customerData.errors) {
        return ( <div className="appBookingFormErrorText">
                    { props.rawTextByKey(props.customerData.errors[property]) }
                </div> );
    }
}

function fieldOptionalLabel(fieldName) {
    if (mandatoryProperties.includes(fieldName)) {
        return props.rawTextByKey('field.mandatory');
    } 
    return props.rawTextByKey('field.optional');
}

function textField(property, inputType) {
    const inputId = 'appBooking_' + property;
    let className = "appBookingFormField" + ((property in props.customerData.errors) ? " appBookingFormFieldInvalid" : "");
    return (
        <div className={className}>
            <div className="appBookingFormFieldBox">
                <label htmlFor={inputId} className="appBookingFormInputLabel">{ props.rawTextByKey('customer.' + property) }{ fieldOptionalLabel(property) }</label>
                <input id={inputId} className="appBookingFormInputText" type={inputType} name={property}
                       required={mandatoryProperties.includes(property)}
                       value={props.customerData[property]}
                       onChange={ (e) => { onChange(property, e) } }
                       onBlur={ (e) => { onBlur(property, e) } } />
            </div>
            { getFieldErrorContent(property) }
        </div>
    );
}

return (
    <div className="appBookingForm">
            <div className="appBookingFormRow">
                { textField('name', 'text') }
                { textField('mobile', 'tel') }
            </div>
            <div className="appBookingFormRow">
                { textField('email', 'email') }
            </div>
            <div className="appBookingFormField">
                <div className="appBookingFormFieldSetLine">
                    <input type="checkbox" id="appBooking_acceptTerms" checked={props.customerData.acceptTerms} name="acceptTerms" className="appBookingFormInputCheckbox"
                        onChange={ (e) => { onChange('acceptTerms', e)}}
                        onBlur={ (e) => { onBlur('acceptTerms', e)}}
                    /> 
                    <label className="appBookingFormTermsLabel" htmlFor="appBooking_acceptTerms">
                    <TermsLabel configs={props.configs} rawTextByKey={props.rawTextByKey} /> 
                    </label>
                </div>
                { getFieldErrorContent('acceptTerms') }
            </div>
    </div>)
}
