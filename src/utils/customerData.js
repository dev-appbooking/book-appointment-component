/*
The personal data form of a booking: { name, mobile, email, acceptTerms, errors }.
errors holds, per field, the text key of its error.
*/
export function emptyCustomerData() {
    return { name: '', mobile: '', email: '', acceptTerms: false, errors: { } };
}

// the text key of the error of a text field, or null when the value is valid
function textFieldError(property, value, mandatoryProperties) {
    value = value.trim();
    if (property === 'name') {
        if ((value.length < 3) && mandatoryProperties.includes(property)) {
            return 'error.name_empty';
        } else if (value.length > 30) {
            return 'error.name_too_long';
        } else if (false === (/^[a-zA-Z\-''_0-9 ]{3,}$/.test(value))) {
            return 'error.name_invalid';
        }
    } else if (property === 'email') {
        if (value.length === 0) {
            if (mandatoryProperties.includes(property)) {
                return 'error.email_empty';
            }
        } else if (false === (/^[a-zA-Z\-\.0-9_\+]{1,64}@[a-zA-Z\-\.0-9_\+]{3,100}$/.test(value))) {
            return 'error.email_invalid';
        }
    } else if (property === 'mobile') {
        if (value.length === 0) {
            if (mandatoryProperties.includes(property)) {
                return 'error.mobile_empty';
            }
        } else {
            let sanitizedValue = '';
            for(let x = 0; x < value.length; x++) {
                if (((value[x] >= '0') && (value[x] <= '9')) || (value[x] === '+')) {
                    sanitizedValue = sanitizedValue + value[x];
                }
            }
            if  (false === (/^\+{0,1}([0-9]){9,14}$/.test(sanitizedValue))) {
                return 'error.mobile_invalid';
            }
        }
    }
    return null;
}

/*
The form after a field changed: typing into a field, or ticking the terms, clears its error.
*/
export function customerDataAfterChange(customerData, property, e) {
    let value = e.target.value;
    let errors = JSON.parse(JSON.stringify(customerData.errors));
    if (property === 'acceptTerms') {
        value = ! customerData.acceptTerms;
        if (e.target.checked === true) {
            delete errors[property];
        }
    } else {
        if (value.length > 0) {
            delete errors[property];
        }
    }
    return { ...customerData, [property]: value, errors: errors };
}

/*
The form after a field lost the focus: its value is checked and an error is added when it is invalid.
*/
export function customerDataAfterBlur(customerData, property, e, mandatoryProperties) {
    let errors = JSON.parse(JSON.stringify(customerData.errors));
    if (property === 'acceptTerms') {
        if (e.target.checked === false) {
            errors['acceptTerms'] = 'error.terms_not_accepted';
        }
    } else {
        let error = textFieldError(property, e.target.value, mandatoryProperties);
        if (error) {
            errors[property] = error;
        }
    }
    return { ...customerData, errors: errors };
}

// true when the mandatory fields are filled in, the terms accepted and no field has an error
export function isCustomerDataComplete(customerData, mandatoryProperties) {
    return ( (customerData.name.length > 0) || (! mandatoryProperties.includes('name')) ) &&
            ((customerData.email.length > 0) || (! mandatoryProperties.includes('email')) ) &&
            ((customerData.mobile.length > 0) || (! mandatoryProperties.includes('mobile')) ) &&
            (customerData.acceptTerms === true) &&
            (Object.keys(customerData.errors).length === 0);
}
