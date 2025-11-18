
export function StandardCustomerForm(props) { 
const ltext = props.ltext;
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
                    { ltext.text(props.customerData.errors[property]) }
                </div> );
    }
}

function getTermsCheckboxLabelContent() {
    let rawTermsText = props.rawTextByKey('customer.acceptTerms');
    if (props.configs && props.configs.termsAndConditions) {
        let linksArray = props.configs.termsAndConditions.links;
        if (linksArray && Array.isArray(linksArray)) {
            //split the rawTermsText to tokens delimited by {0}, {1}, {2}, {3}...
            let strTokens = rawTermsText.split(/\{[0-9]*\}/);
            return ( strTokens.map( (token, index) => {
                return ( <> {token} { (index < linksArray.length ) && (<a href={linksArray[index].link} target="_new_blank"> { props.rawTextByKey(linksArray[index].label_key) }</a>)}&nbsp; </> )
            } ) )
        }
    }
    return (<span> { rawTermsText } </span>);
}

function fieldOptionalLabel(fieldName) {
    if (mandatoryProperties.includes(fieldName)) {
        return ltext.text('field.mandatory');
    } 
    return ltext.text('field.optional');
}

return (
    <div>
            <fieldset className="appBookingFormFieldSet">
                <label htmlFor="name" className="appBookingFormInputLabel"> { ltext.text('customer.name') }{fieldOptionalLabel('name') }</label>
                <div>
                    <input required className="appBookingFormInputText" type="text" 
                            value={props.customerData.name} name="name" onChange={ (e) => { onChange('name', e)}} 
                            onBlur={ (e) => { onBlur('name', e)}}
                    />
                </div>
                { getFieldErrorContent('name') }
            </fieldset>

            <fieldset className="appBookingFormFieldSet">
                <label htmlFor="mobile" className="appBookingFormInputLabel"> { ltext.text('customer.mobile') }{fieldOptionalLabel('mobile') } </label>
                <div>
                    <input required className="appBookingFormInputText" type="text" 
                            value={props.customerData.mobile} name="mobile" onChange={ (e) => { onChange('mobile', e)}}
                            onBlur={ (e) => { onBlur('mobile', e)}}
                            />
                </div>
                { getFieldErrorContent('mobile') }
            </fieldset>

            <fieldset className="appBookingFormFieldSet">
                <label htmlFor="email" className="appBookingFormInputLabel"> { ltext.text('customer.email') }{fieldOptionalLabel('email') } </label>
                <div>
                    <input required className="appBookingFormInputText" type="text" 
                            value={props.customerData.email} name="email" onChange={ (e) => { onChange('email', e)}}
                            onBlur={ (e) => { onBlur('email', e)}}
                    />
                </div>
                { getFieldErrorContent('email') }
            </fieldset>
            <fieldset className="appBookingFormFieldSet">
                <div className="appBookingFormFieldSetLine">
                    <input type="checkbox" checked={props.customerData.acceptTerms} name="acceptTerms" className="appBookingFormInputCheckbox"
                        onChange={ (e) => { onChange('acceptTerms', e)}}
                        onBlur={ (e) => { onBlur('acceptTerms', e)}}
                    /> 
                    <label class="appBookingFormTermsLabel" htmlFor="acceptTerms">
                    { getTermsCheckboxLabelContent() } 
                    </label>
                </div>
                { getFieldErrorContent('acceptTerms') }
            </fieldset>

    </div>)
}